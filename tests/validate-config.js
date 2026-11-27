import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";

const verbose = process.argv.includes("--verbose");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function logStep(label, ok, detail = "") {
  if (!verbose) {
    return;
  }
  const tag = ok ? "[OK]" : "[FAIL]";
  const suffix = detail ? ` - ${detail}` : "";
  process.stderr.write(`${tag} ${label}${suffix}\n`);
}

async function runValidation() {
  let app = null;
  const originalError = console.error;
  const originalWarn = console.warn;

  if (!verbose) {
    console.error = () => {};
    console.warn = () => {};
  }

  try {
    // 1. Verificar API Key
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    assert.ok(apiKey && apiKey.length > 10, "GEMINI_API_KEY no definida");
    logStep("Entorno GEMINI_API_KEY", true);

    // 2. Verificar package.json profesional y README con sección Creador
    const [pkgRaw, readme] = await Promise.all([
      fs.readFile(path.join(projectRoot, "package.json"), "utf8"),
      fs.readFile(path.join(projectRoot, "README.md"), "utf8"),
    ]);
    const pkg = JSON.parse(pkgRaw);
    assert.equal(pkg.name, "ecosfera", "package.json name debe ser ecosfera");
    assert.ok(pkg.engines?.node && pkg.repository?.url && pkg.author, "package.json incompleto");
    assert.ok(
      readme.includes("## Creador") && readme.includes("Henrik Anderson Oloroso García"),
      "README debe incluir sección Creador con el nombre del autor"
    );
    logStep("Empaquetado package.json y README Creador", true);

    // 3. Verificar UX Ecosfera: fondo negro puro, bordes rojo/naranja/amarillo y 2 vistas
    const [html, css, js] = await Promise.all([
      fs.readFile(path.join(projectRoot, "public", "index.html"), "utf8"),
      fs.readFile(path.join(projectRoot, "public", "styles.css"), "utf8"),
      fs.readFile(path.join(projectRoot, "public", "app.js"), "utf8"),
    ]);

    assert.ok(
      html.includes('id="view-chat"') &&
        html.includes('id="view-studio"') &&
        !html.includes('id="view-explore"') &&
        !html.includes('id="nav-explore-btn"'),
      "La UI debe tener únicamente App Chat e Interfaz App"
    );
    assert.ok(
      css.includes("--bg-canvas: #050506") &&
        css.includes("--bg-surface: #0C0C0E") &&
        css.includes("--bg-elevated: #141417") &&
        css.includes("--accent-primary: #E53935") &&
        css.includes("--accent-orange: #FF7A1A") &&
        css.includes("--accent-warm: #F5C542"),
      "Falta paleta negro puro + bordes rojo/naranja/amarillo en CSS"
    );
    assert.ok(
      js.includes("/api/chat") &&
        js.includes("/api/query") &&
        js.includes("/api/tracks") &&
        js.includes("youtube.com/embed/") &&
        js.includes("dom.matchesBlock.hidden = true"),
      "Falta integración de App Chat, YouTube u ocultamiento de matches en app.js"
    );
    logStep("UX Ecosfera negro puro, 2 vistas y YouTube integrado", true);

    // 4. Inicializar app y sincronizar embeddings (10 fichas + 27 canciones)
    app = createApp({ port: 0 });
    const docStats = app.repo.getStats();
    const trackStats = app.trackRepo.getStats();
    assert.ok(docStats.documentsTotal >= 10, `Fichas insuficientes: ${docStats.documentsTotal}`);
    assert.equal(trackStats.tracksTotal, 27, `Se esperaban 27 canciones, hay ${trackStats.tracksTotal}`);

    const syncResult = await app.ragService.syncMissingEmbeddings();
    assert.equal(syncResult.vectorsReady, syncResult.totalDocuments);
    assert.equal(syncResult.tracksVectorsReady, syncResult.tracksTotal);
    logStep(
      "SQLite + Vectores sincronizados",
      true,
      `${syncResult.vectorsReady} fichas · ${syncResult.tracksVectorsReady} canciones`
    );

    // 5. Levantar servidor HTTP efímero y probar endpoints
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const address = app.server.address();
    assert.ok(address && typeof address === "object" && address.port > 0);
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const [homeRes, healthRes, docsRes, tracksRes] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/api/documents`),
      fetch(`${baseUrl}/api/tracks`),
    ]);
    assert.equal(homeRes.status, 200);
    assert.equal(healthRes.status, 200);
    assert.equal(docsRes.status, 200);
    assert.equal(tracksRes.status, 200);

    const health = await healthRes.json();
    assert.equal(health.appName, "Ecosfera");
    assert.equal(health.tracksTotal, 27);
    assert.equal(health.vectorsPending, 0);
    assert.equal(health.tracksVectorsPending, 0);

    const tracksPayload = await tracksRes.json();
    assert.equal(tracksPayload.total, 27);
    assert.ok(tracksPayload.tracks.some((t) => t.language === "es"));
    assert.ok(tracksPayload.tracks.some((t) => t.language === "en"));
    assert.ok(tracksPayload.tracks.some((t) => t.language === "instrumental"));

    // CRUD temporal de tracks sin dejar basura
    const createTrackRes = await fetch(`${baseUrl}/api/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Ecosfera Track",
        artist: "Test Artist",
        genre: "Electrónica",
        language: "instrumental",
        youtubeUrl: "https://www.youtube.com/watch?v=gCYcHz2k5x0",
        releaseYear: 2024,
        notes: "Validación temporal.",
      }),
    });
    assert.equal(createTrackRes.status, 201);
    const createdTrack = await createTrackRes.json();
    assert.equal(createdTrack.track?.hasEmbedding, true);
    const delTrackRes = await fetch(`${baseUrl}/api/tracks/${createdTrack.track.id}`, {
      method: "DELETE",
    });
    assert.equal(delTrackRes.status, 200);
    logStep("HTTP endpoints + 27 canciones + CRUD YouTube", true);

    // 6. Probar App Chat (POST /api/chat) + caché LRU de tokens + Interfaz App (en tema / fuera de tema)
    const beforeMaxLog = app.db.prepare("SELECT COALESCE(MAX(id), 0) AS maxId FROM query_logs").get().maxId;

    const chatRes1 = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "¿Qué canciones de Rafa Espino tienes?",
        history: [],
        topK: 3,
      }),
    });
    assert.equal(chatRes1.status, 200);
    const chat1 = await chatRes1.json();
    assert.equal(chat1.grounded, true);
    assert.ok(Array.isArray(chat1.recommendedTracks) && chat1.recommendedTracks.length >= 1);
    assert.ok(chat1.optimization?.estimatedInputTokens > 0);

    // Segunda llamada idéntica -> cacheHit === true (0 tokens)
    const chatRes2 = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "¿Qué canciones de Rafa Espino tienes?",
        history: [],
        topK: 3,
      }),
    });
    assert.equal(chatRes2.status, 200);
    const chat2 = await chatRes2.json();
    assert.equal(chat2.optimization?.cacheHit, true);

    // Interfaz App en tema
    const queryRes = await fetch(`${baseUrl}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "¿Qué diferencia hay entre síntesis sustractiva y síntesis FM?",
        topK: 3,
      }),
    });
    assert.equal(queryRes.status, 200);
    const trace = await queryRes.json();
    assert.equal(trace.grounded, true);
    assert.ok(Array.isArray(trace.matches) && trace.matches.length >= 1);

    // Interfaz App fuera de tema -> grounded false y cero tarjetas
    const offTopicRes = await fetch(`${baseUrl}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "¿Cuál es la receta tradicional de lasaña boloñesa con queso?",
        topK: 3,
      }),
    });
    assert.equal(offTopicRes.status, 200);
    const offTopic = await offTopicRes.json();
    assert.equal(offTopic.grounded, false);
    assert.deepEqual(offTopic.matches, []);
    assert.deepEqual(offTopic.recommendedTracks, []);
    assert.equal(offTopic.topMatch, null);

    app.db.prepare("DELETE FROM query_logs WHERE id > ?").run(beforeMaxLog);
    logStep("App Chat + caché LRU + Interfaz App (en tema / fuera de tema)", true);

    return true;
  } catch (error) {
    logStep("Validación", false, error?.message || String(error));
    return false;
  } finally {
    if (app) {
      await app.close().catch(() => {});
    }
    console.error = originalError;
    console.warn = originalWarn;
  }
}

const ok = await runValidation();
process.stdout.write(ok ? "sí\n" : "no\n");
process.exitCode = ok ? 0 : 1;
