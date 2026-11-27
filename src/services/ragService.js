import { GoogleGenAI } from "@google/genai";
import { normalizeQueryKey } from "./embeddingService.js";

export const SYSTEM_PROMPT = [
  "Eres Ecosfera, asistente musical experto. Responde en español, claro y breve (máx. 110 palabras).",
  "Usa SOLO las fichas de teoría y canciones recuperadas de SQLite.",
  "Usa el prefijo [SIN_CONTEXTO] ÚNICAMENTE si la pregunta es totalmente ajena a la música (ej. cocina, programación, geografía).",
  "Si la pregunta es sobre música o artistas del contexto, responde directamente con los datos disponibles SIN usar [SIN_CONTEXTO], indicando si algún detalle específico no figura en la ficha.",
].join("\n");

const RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;
const NO_CONTEXT_PREFIX = "[SIN_CONTEXTO]";
const SYNC_CONCURRENCY = 5;

function truncateText(text, maxChars) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) {
    return clean;
  }
  return `${clean.slice(0, maxChars - 1).trimEnd()}…`;
}

function normalizeLexical(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function computeTrackLexicalBoost(queryText, track) {
  const q = normalizeLexical(queryText);
  if (!q) {
    return 0;
  }

  let boost = 0;
  const artist = normalizeLexical(track.artist);
  const title = normalizeLexical(track.title.split("(")[0]);
  const genre = normalizeLexical(track.genre);

  if (artist.length >= 3 && q.includes(artist)) {
    boost += 0.14;
  } else {
    const artistTokens = artist.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
    if (artistTokens.some((token) => q.includes(token))) {
      boost += 0.08;
    }
  }

  if (title.length >= 4 && q.includes(title.trim())) {
    boost += 0.14;
  }

  if (genre.length >= 3 && q.includes(genre)) {
    boost += 0.09;
  }

  const langWord =
    track.language === "es"
      ? "espanol"
      : track.language === "en"
        ? "ingles"
        : "instrumental";
  if (q.includes(langWord)) {
    boost += 0.04;
  }

  return Math.min(boost, 0.22);
}

async function runWithConcurrency(items, limit, worker) {
  if (items.length === 0) {
    return;
  }
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/**
 * Servicio RAG unificado de Ecosfera: combina conocimiento teórico y catálogo musical YouTube
 * con caché LRU en RAM y compactación de contexto para minimizar latencia y consumo de tokens.
 */
export function createRagService({ repo, trackRepo, embeddingService, config }) {
  const genClient = config.apiKey
    ? new GoogleGenAI({ apiKey: config.apiKey })
    : null;

  const rateLimitedUntil = new Map();
  const answerCache = new Map();
  let docsIndexCache = null;
  let tracksIndexCache = null;
  let answerCacheHits = 0;
  let answerCacheMisses = 0;

  function invalidateCaches() {
    docsIndexCache = null;
    tracksIndexCache = null;
    answerCache.clear();
  }

  function getDocsIndex() {
    if (!docsIndexCache) {
      docsIndexCache = repo.listAllWithEmbeddings();
    }
    return docsIndexCache;
  }

  function getTracksIndex() {
    if (!tracksIndexCache && trackRepo) {
      tracksIndexCache = trackRepo.listAllWithEmbeddings();
    }
    return tracksIndexCache || [];
  }

  function readAnswerCache(key) {
    if (!answerCache.has(key)) {
      return null;
    }
    const entry = answerCache.get(key);
    if (Date.now() - entry.createdAt > config.cacheTtlMs) {
      answerCache.delete(key);
      return null;
    }
    answerCache.delete(key);
    answerCache.set(key, entry);
    answerCacheHits += 1;
    return entry.value;
  }

  function writeAnswerCache(key, value) {
    const maxEntries = Math.max(16, Number(config.answerCacheSize) || 64);
    if (answerCache.has(key)) {
      answerCache.delete(key);
    } else if (answerCache.size >= maxEntries) {
      const oldestKey = answerCache.keys().next().value;
      if (oldestKey !== undefined) {
        answerCache.delete(oldestKey);
      }
    }
    answerCache.set(key, { createdAt: Date.now(), value });
  }

  async function syncMissingEmbeddings() {
    const missingDocs = repo.findMissingEmbeddings();
    const missingTracks = trackRepo ? trackRepo.findMissingEmbeddings() : [];

    await runWithConcurrency(missingDocs, SYNC_CONCURRENCY, async (doc) => {
      const formatted = embeddingService.formatDocumentForEmbedding(doc);
      const vector = await embeddingService.createEmbedding(formatted, { useCache: false });
      repo.updateEmbedding(doc.id, vector, config.embeddingModel);
    });

    await runWithConcurrency(missingTracks, SYNC_CONCURRENCY, async (track) => {
      const formatted = embeddingService.formatTrackForEmbedding(track);
      const vector = await embeddingService.createEmbedding(formatted, { useCache: false });
      trackRepo.updateEmbedding(track.id, vector, config.embeddingModel);
    });

    if (missingDocs.length > 0 || missingTracks.length > 0) {
      invalidateCaches();
    }

    const docStats = repo.getStats();
    const trackStats = trackRepo
      ? trackRepo.getStats()
      : { tracksTotal: 0, vectorsReady: 0, vectorsPending: 0 };

    return {
      synced: missingDocs.length + missingTracks.length,
      syncedDocuments: missingDocs.length,
      syncedTracks: missingTracks.length,
      totalDocuments: docStats.documentsTotal,
      vectorsReady: docStats.vectorsReady,
      tracksTotal: trackStats.tracksTotal,
      tracksVectorsReady: trackStats.vectorsReady,
    };
  }

  async function callSynthesisModel(promptWithContext) {
    if (!genClient) {
      const err = new Error("GEMINI_API_KEY no está configurada para generar la respuesta.");
      err.statusCode = 503;
      err.code = "AI_NOT_CONFIGURED";
      throw err;
    }

    const allCandidates = [
      ...new Set(
        [config.chatModel, ...(config.chatFallbackModels || [])].filter(Boolean)
      ),
    ];

    const now = Date.now();
    const activeCandidates = allCandidates.filter(
      (model) => (rateLimitedUntil.get(model) ?? 0) <= now
    );
    const candidateModels = activeCandidates.length > 0 ? activeCandidates : allCandidates;

    let lastChatError = null;
    let usedModel = config.chatModel;
    let usedFallback = false;
    let answer = "";

    for (let i = 0; i < candidateModels.length; i++) {
      const candidate = candidateModels[i];
      try {
        const interaction = await genClient.interactions.create({
          model: candidate,
          system_instruction: SYSTEM_PROMPT,
          input: promptWithContext,
        });

        answer =
          interaction?.output_text?.trim() ||
          "No se obtuvo una respuesta textual del modelo.";
        usedModel = candidate;
        usedFallback = candidate !== config.chatModel;
        lastChatError = null;
        break;
      } catch (error) {
        lastChatError = error;
        const status = error?.status ?? error?.statusCode;
        const isQuotaLimit =
          status === 429 ||
          /429|rate limit|quota/i.test(String(error?.message || ""));
        if (isQuotaLimit) {
          rateLimitedUntil.set(candidate, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        }
        const isRecoverable =
          isQuotaLimit ||
          status === 503 ||
          status === 404 ||
          /503|unavailable/i.test(String(error?.message || ""));
        if (isRecoverable && i < candidateModels.length - 1) {
          continue;
        }
        break;
      }
    }

    if (lastChatError) {
      const wrapped = new Error("No se pudo sintetizar la respuesta con el modelo de chat.");
      wrapped.statusCode = 502;
      wrapped.code = "CHAT_SYNTHESIS_FAILED";
      wrapped.cause = lastChatError;
      throw wrapped;
    }

    return { answer, usedModel, usedFallback };
  }

  function buildCompactContext(relevantDocs, relevantTracks) {
    const blocks = [];
    let currentChars = 0;
    const maxChars = Math.max(400, Number(config.maxContextChars) || 1400);

    for (const doc of relevantDocs) {
      const line = `[F:${doc.title}|${doc.category}] ${truncateText(doc.content, 260)}`;
      if (currentChars + line.length > maxChars && blocks.length > 0) {
        break;
      }
      blocks.push(line);
      currentChars += line.length;
    }

    for (const track of relevantTracks) {
      const lang =
        track.language === "es"
          ? "ES"
          : track.language === "en"
            ? "EN"
            : "INST";
      const line = `[M:${track.title} - ${track.artist}|${track.genre}|${lang}|${track.releaseYear || ""}] ${truncateText(track.notes, 180)}`;
      if (currentChars + line.length > maxChars && blocks.length > 0) {
        break;
      }
      blocks.push(line);
      currentChars += line.length;
    }

    return blocks.join("\n");
  }

  async function executeUnifiedRag(question, { topK = 3, history = [], mode = "studio" } = {}) {
    const totalStart = performance.now();
    const safeTopK = Math.min(Math.max(Math.trunc(Number(topK) || 3), 1), 5);
    const trimmedHistory = Array.isArray(history) ? history.slice(-4) : [];

    const historySignature = trimmedHistory
      .map((item) => `${item.role}:${normalizeQueryKey(item.text).slice(0, 60)}`)
      .join("|");
    const cacheKey = `${mode}::${safeTopK}::${normalizeQueryKey(question)}::${historySignature}`;

    const cachedResponse = readAnswerCache(cacheKey);
    if (cachedResponse) {
      const latencyMs = Math.max(1, Math.round(performance.now() - totalStart));
      return {
        ...cachedResponse,
        workflow: {
          ...cachedResponse.workflow,
          latencyMs,
        },
        optimization: {
          ...cachedResponse.optimization,
          cacheHit: true,
          latencyMs,
        },
      };
    }

    answerCacheMisses += 1;

    const docStats = repo.getStats();
    const trackStats = trackRepo ? trackRepo.getStats() : { vectorsPending: 0 };
    if (docStats.vectorsPending > 0 || trackStats.vectorsPending > 0) {
      await syncMissingEmbeddings();
    }

    const steps = [];
    const embedStart = performance.now();
    const { vector: queryVector, fromCache: embeddingCached } =
      await embeddingService.getEmbeddingWithMeta(question, { useCache: true });

    steps.push({
      step: "embed_query",
      status: "done",
      durationMs: Math.round(performance.now() - embedStart),
      detail: `${queryVector.length} dims (${config.embeddingModel})${embeddingCached ? " · caché" : ""}`,
    });

    const scanStart = performance.now();
    const vectorDocs = getDocsIndex().filter(
      (doc) => doc.vector && doc.vector.length === queryVector.length
    );
    const vectorTracks = getTracksIndex().filter(
      (track) => track.vector && track.vector.length === queryVector.length
    );
    steps.push({
      step: "sqlite_scan",
      status: "done",
      durationMs: Math.round(performance.now() - scanStart),
      detail: `${vectorDocs.length} fichas + ${vectorTracks.length} músicas en SQLite`,
    });

    const rankStart = performance.now();
    const rankedDocs = vectorDocs
      .map((doc) => {
        const rawSimilarity = embeddingService.cosineSimilarity(queryVector, doc.vector);
        return {
          id: doc.id,
          title: doc.title,
          category: doc.category,
          content: doc.content,
          tags: doc.tags,
          similarity: Number(rawSimilarity.toFixed(4)),
          aboveThreshold: rawSimilarity >= config.similarityThreshold,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, safeTopK);

    const relevantDocs = rankedDocs.filter((doc) => doc.aboveThreshold);

    const trackThreshold = Math.max(0.54, config.similarityThreshold - 0.04);
    const rankedTracks = vectorTracks
      .map((track) => {
        const semanticSim = embeddingService.cosineSimilarity(queryVector, track.vector);
        const boost = computeTrackLexicalBoost(question, track);
        const combined = Math.min(0.99, semanticSim + boost);
        return {
          id: track.id,
          title: track.title,
          artist: track.artist,
          genre: track.genre,
          language: track.language,
          youtubeId: track.youtubeId,
          youtubeUrl: track.youtubeUrl,
          embedUrl: track.embedUrl,
          thumbnailUrl: track.thumbnailUrl,
          releaseYear: track.releaseYear,
          notes: track.notes,
          similarity: Number(combined.toFixed(4)),
          aboveThreshold: combined >= trackThreshold,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);

    const relevantTracks = rankedTracks.filter((track) => track.aboveThreshold);

    steps.push({
      step: "cosine_rank",
      status: "done",
      durationMs: Math.round(performance.now() - rankStart),
      detail: `${relevantDocs.length} ficha(s) · ${relevantTracks.length} música(s) sobre umbral`,
    });

    const llmStart = performance.now();
    let answer = "";
    let grounded = false;
    let usedModel = config.chatModel;
    let promptChars = 0;

    if (relevantDocs.length > 0 || relevantTracks.length > 0) {
      const compactContext = buildCompactContext(relevantDocs, relevantTracks);
      const historyBlock = trimmedHistory.length
        ? `HISTORIAL:\n${trimmedHistory
            .map((turn) => `${turn.role === "user" ? "U" : "A"}: ${truncateText(turn.text, 160)}`)
            .join("\n")}\n\n`
        : "";

      const promptWithContext = `${historyBlock}CONTEXTO:\n${compactContext}\n\nPREGUNTA:\n${question}`;
      promptChars = SYSTEM_PROMPT.length + promptWithContext.length;

      const synth = await callSynthesisModel(promptWithContext);
      answer = synth.answer;
      usedModel = synth.usedModel;
      grounded = true;

      if (answer.startsWith(NO_CONTEXT_PREFIX)) {
        answer =
          answer.slice(NO_CONTEXT_PREFIX.length).trim() ||
          "No encontré información suficiente en la base musical de Ecosfera para responder esa consulta.";
        grounded = false;
      }

      const fallbackNote = synth.usedFallback ? " (respaldo por cuota)" : "";
      steps.push({
        step: "llm_synthesis",
        status: "done",
        durationMs: Math.round(performance.now() - llmStart),
        detail: grounded
          ? `${usedModel}${fallbackNote} · ${Math.ceil(promptChars / 4)} tok est.`
          : `Tema ajeno al archivo (${usedModel}); tarjetas ocultadas`,
      });
    } else {
      const thresholdPct = Math.round(config.similarityThreshold * 100);
      answer = `No encontré fichas técnicas ni canciones en SQLite que superen el umbral de relevancia (${thresholdPct}%) para responder con certeza. Puedes consultar sobre teoría musical, producción o sobre artistas y géneros del catálogo.`;
      grounded = false;

      steps.push({
        step: "llm_synthesis",
        status: "done",
        durationMs: Math.round(performance.now() - llmStart),
        detail: "0 tokens consumidos · sin coincidencias relevantes",
      });
    }

    const latencyMs = Math.round(performance.now() - totalStart);
    const returnedMatches = grounded ? relevantDocs : [];
    const returnedTracks = grounded ? relevantTracks : [];
    const topMatch = returnedMatches[0] ?? null;

    repo.insertQueryLog({
      question,
      answer,
      topDocumentId: topMatch?.id ?? null,
      topSimilarity: topMatch?.similarity ?? 0,
      latencyMs,
    });

    const responsePayload = {
      question,
      answer,
      grounded,
      model: usedModel,
      embeddingModel: config.embeddingModel,
      threshold: config.similarityThreshold,
      queryEmbedding: {
        dimensions: queryVector.length,
        norm: Number(embeddingService.vectorNorm(queryVector).toFixed(4)),
        preview: Array.from(queryVector.slice(0, 32), (v) => Number(v.toFixed(4))),
      },
      matches: returnedMatches,
      recommendedTracks: returnedTracks,
      topMatch,
      workflow: {
        latencyMs,
        scannedVectors: vectorDocs.length + vectorTracks.length,
        steps,
      },
      optimization: {
        cacheHit: false,
        embeddingCached,
        promptChars,
        estimatedInputTokens: Math.ceil(promptChars / 4),
        contextItems: returnedMatches.length + returnedTracks.length,
        latencyMs,
      },
    };

    writeAnswerCache(cacheKey, responsePayload);
    return responsePayload;
  }

  return {
    invalidateCaches,
    syncMissingEmbeddings,

    getOptimizationStats() {
      return {
        answerCache: {
          size: answerCache.size,
          hits: answerCacheHits,
          misses: answerCacheMisses,
        },
        embeddingCache: embeddingService.getCacheStats(),
      };
    },

    async createAndEmbedDocument({ title, category, content, tags = "" }) {
      let vector = null;
      if (config.apiKey) {
        const formatted = embeddingService.formatDocumentForEmbedding({
          title,
          category,
          tags,
          content,
        });
        vector = await embeddingService.createEmbedding(formatted, { useCache: false });
      }

      const created = repo.createDocument({ title, category, content, tags });
      if (vector) {
        repo.updateEmbedding(created.id, vector, config.embeddingModel);
      }
      invalidateCaches();
      return repo.findById(created.id);
    },

    async createAndEmbedTrack({ title, artist, genre, language, youtubeId, releaseYear = null, notes = "" }) {
      let vector = null;
      if (config.apiKey) {
        const formatted = embeddingService.formatTrackForEmbedding({
          title,
          artist,
          genre,
          language,
          releaseYear,
          notes,
        });
        vector = await embeddingService.createEmbedding(formatted, { useCache: false });
      }

      const created = trackRepo.createTrack({
        title,
        artist,
        genre,
        language,
        youtubeId,
        releaseYear,
        notes,
      });
      if (vector) {
        trackRepo.updateEmbedding(created.id, vector, config.embeddingModel);
      }
      invalidateCaches();
      return trackRepo.findById(created.id);
    },

    askMusicKnowledge(question, topK = 3) {
      return executeUnifiedRag(question, { topK, mode: "studio" });
    },

    chatMusic(message, { history = [], topK = 3 } = {}) {
      return executeUnifiedRag(message, { topK, history, mode: "chat" });
    },
  };
}
