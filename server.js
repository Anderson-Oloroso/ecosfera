import { createApp } from "./src/app.js";

const app = createApp();

try {
  const syncResult = await app.ragService.syncMissingEmbeddings();
  if (syncResult.synced > 0) {
    console.log(
      `[Ecosfera] Embeddings sincronizados: ${syncResult.syncedDocuments} fichas y ${syncResult.syncedTracks} músicas (${syncResult.vectorsReady}/${syncResult.totalDocuments} fichas · ${syncResult.tracksVectorsReady}/${syncResult.tracksTotal} pistas).`
    );
  } else {
    console.log(
      `[Ecosfera] Índices listos en SQLite (${syncResult.vectorsReady}/${syncResult.totalDocuments} fichas · ${syncResult.tracksVectorsReady}/${syncResult.tracksTotal} pistas).`
    );
  }
} catch (error) {
  console.warn(
    `[Ecosfera] Aviso al sincronizar embeddings iniciales (${error.message}). El servidor continuará disponible.`
  );
}

app.server.listen(app.config.port, () => {
  console.log(`[Ecosfera] Servidor activo en http://localhost:${app.config.port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`\n[Ecosfera] Señal ${signal} recibida. Cerrando servidor y SQLite...`);
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error("[Ecosfera] Error al cerrar recursos:", error.message);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
