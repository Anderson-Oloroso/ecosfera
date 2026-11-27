import http from "node:http";
import { loadConfig } from "./config/env.js";
import { initDatabase } from "./db/sqlite.js";
import { createKnowledgeRepository } from "./repositories/knowledgeRepository.js";
import { createTrackRepository } from "./repositories/trackRepository.js";
import { createEmbeddingService } from "./services/embeddingService.js";
import { createRagService } from "./services/ragService.js";
import { createMusicController } from "./controllers/musicController.js";
import { createRouter } from "./routes/router.js";

/**
 * Ensambla todas las capas de Ecosfera y devuelve la instancia de servidor y dependencias.
 * @param {Record<string, unknown>} [overrides={}]
 */
export function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const db = initDatabase(config.dbPath);
  const repo = createKnowledgeRepository(db);
  const trackRepo = createTrackRepository(db);
  const embeddingService = createEmbeddingService(config);
  const ragService = createRagService({ repo, trackRepo, embeddingService, config });
  const controller = createMusicController({ repo, trackRepo, ragService, config });
  const requestHandler = createRouter({ controller, config });
  const server = http.createServer(requestHandler);

  let closed = false;
  async function close() {
    if (closed) {
      return;
    }
    closed = true;

    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        server.closeAllConnections?.();
      });
    }

    db.close();
  }

  return {
    server,
    db,
    repo,
    trackRepo,
    embeddingService,
    ragService,
    config,
    close,
  };
}
