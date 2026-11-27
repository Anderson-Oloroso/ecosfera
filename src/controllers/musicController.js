import { extractYouTubeId } from "../repositories/trackRepository.js";

export class AppError extends Error {
  constructor(statusCode, message, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validateStringField(value, fieldName, { min, max, required = true }) {
  if (value === undefined || value === null) {
    if (!required) {
      return "";
    }
    throw new AppError(400, `El campo '${fieldName}' es obligatorio.`, "VALIDATION_ERROR");
  }

  if (typeof value !== "string") {
    throw new AppError(
      400,
      `El campo '${fieldName}' debe ser una cadena de texto.`,
      "VALIDATION_ERROR"
    );
  }

  const trimmed = value.trim();
  if (required && trimmed.length < min) {
    throw new AppError(
      400,
      `El campo '${fieldName}' debe tener al menos ${min} caracteres.`,
      "VALIDATION_ERROR"
    );
  }

  if (trimmed.length > max) {
    throw new AppError(
      400,
      `El campo '${fieldName}' no puede superar los ${max} caracteres.`,
      "VALIDATION_ERROR"
    );
  }

  return trimmed;
}

/**
 * Controlador HTTP de Ecosfera para App Chat, Interfaz App, SQLite y catálogo musical.
 */
export function createMusicController({ repo, trackRepo, ragService, config }) {
  return {
    async health() {
      const docStats = repo.getStats();
      const trackStats = trackRepo
        ? trackRepo.getStats()
        : { tracksTotal: 0, vectorsReady: 0, vectorsPending: 0 };

      return {
        statusCode: 200,
        body: {
          ok: true,
          appName: config.appName,
          status: "ready",
          database: "sqlite",
          embeddingModel: config.embeddingModel,
          chatModel: config.chatModel,
          dimensions: config.embeddingDimensions,
          similarityThreshold: config.similarityThreshold,
          documentsTotal: docStats.documentsTotal,
          totalDocuments: docStats.documentsTotal,
          vectorsReady: docStats.vectorsReady,
          vectorsPending: docStats.vectorsPending,
          tracksTotal: trackStats.tracksTotal,
          tracksVectorsReady: trackStats.vectorsReady,
          tracksVectorsPending: trackStats.vectorsPending,
          cacheStats: ragService.getOptimizationStats(),
        },
      };
    },

    async listDocuments({ searchParams }) {
      const category = searchParams.get("category") ?? undefined;
      if (category !== undefined && category.trim().length > 60) {
        throw new AppError(
          400,
          "El parámetro 'category' no puede superar los 60 caracteres.",
          "VALIDATION_ERROR"
        );
      }

      const data = repo.listDocuments({ category });
      return {
        statusCode: 200,
        body: data,
      };
    },

    async createDocument({ body }) {
      const title = validateStringField(body.title, "title", { min: 3, max: 140 });
      const category = validateStringField(body.category, "category", {
        min: 2,
        max: 60,
      });
      const content = validateStringField(body.content, "content", {
        min: 15,
        max: 4000,
      });
      const tags = validateStringField(body.tags, "tags", {
        min: 0,
        max: 200,
        required: false,
      });

      const document = await ragService.createAndEmbedDocument({
        title,
        category,
        content,
        tags,
      });
      return {
        statusCode: 201,
        body: { document },
      };
    },

    async deleteDocument({ idParam }) {
      if (!/^\d+$/.test(idParam)) {
        throw new AppError(400, "El identificador debe ser un entero positivo.", "INVALID_ID");
      }

      const id = Number(idParam);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError(400, "El identificador debe ser un entero positivo.", "INVALID_ID");
      }

      const deleted = repo.deleteDocument(id);
      if (!deleted) {
        throw new AppError(404, "Ficha musical no encontrada.", "NOT_FOUND");
      }

      ragService.invalidateCaches();
      return {
        statusCode: 200,
        body: { deleted: true, id },
      };
    },

    async syncEmbeddings() {
      const result = await ragService.syncMissingEmbeddings();
      return {
        statusCode: 200,
        body: result,
      };
    },

    async query({ body }) {
      const question = validateStringField(body.question, "question", {
        min: 3,
        max: 600,
      });

      let topK = 3;
      if (body.topK !== undefined) {
        const parsedTopK = Number(body.topK);
        if (!Number.isInteger(parsedTopK) || parsedTopK < 1 || parsedTopK > 5) {
          throw new AppError(
            400,
            "El campo 'topK' debe ser un número entero entre 1 y 5.",
            "VALIDATION_ERROR"
          );
        }
        topK = parsedTopK;
      }

      const trace = await ragService.askMusicKnowledge(question, topK);
      return {
        statusCode: 200,
        body: trace,
      };
    },

    async chat({ body }) {
      const message = validateStringField(body.message ?? body.question, "message", {
        min: 2,
        max: 500,
      });

      let topK = 3;
      if (body.topK !== undefined) {
        const parsedTopK = Number(body.topK);
        if (!Number.isInteger(parsedTopK) || parsedTopK < 1 || parsedTopK > 5) {
          throw new AppError(
            400,
            "El campo 'topK' debe ser un entero entre 1 y 5.",
            "VALIDATION_ERROR"
          );
        }
        topK = parsedTopK;
      }

      let history = [];
      if (body.history !== undefined) {
        if (!Array.isArray(body.history)) {
          throw new AppError(400, "El campo 'history' debe ser un arreglo.", "VALIDATION_ERROR");
        }
        if (body.history.length > 8) {
          throw new AppError(400, "El historial no puede superar 8 turnos.", "VALIDATION_ERROR");
        }
        history = body.history.map((item, idx) => {
          if (!item || typeof item !== "object") {
            throw new AppError(400, `Turno inválido en history[${idx}].`, "VALIDATION_ERROR");
          }
          const role = item.role === "assistant" ? "assistant" : "user";
          const text = validateStringField(item.text, `history[${idx}].text`, {
            min: 1,
            max: 500,
          });
          return { role, text };
        });
      }

      const trace = await ragService.chatMusic(message, { history, topK });
      return {
        statusCode: 200,
        body: trace,
      };
    },

    async listHistory({ searchParams }) {
      const rawLimit = searchParams.get("limit");
      let limit = 12;

      if (rawLimit !== null && rawLimit !== "") {
        const parsed = Number(rawLimit);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
          throw new AppError(
            400,
            "El parámetro 'limit' debe ser un entero entre 1 y 50.",
            "VALIDATION_ERROR"
          );
        }
        limit = parsed;
      }

      const history = repo.listHistory(limit);
      return {
        statusCode: 200,
        body: { history },
      };
    },

    async listTracks({ searchParams }) {
      const genre = searchParams.get("genre") ?? undefined;
      const language = searchParams.get("language") ?? undefined;
      const q = searchParams.get("q") ?? undefined;

      if (genre !== undefined && genre.trim().length > 60) {
        throw new AppError(400, "El parámetro 'genre' es demasiado largo.", "VALIDATION_ERROR");
      }

      if (
        language !== undefined &&
        language.trim() !== "" &&
        language !== "es" &&
        language !== "en" &&
        language !== "instrumental"
      ) {
        throw new AppError(
          400,
          "El parámetro 'language' debe ser 'es', 'en' o 'instrumental'.",
          "VALIDATION_ERROR"
        );
      }

      if (q !== undefined && q.trim().length > 100) {
        throw new AppError(400, "La búsqueda 'q' no puede superar 100 caracteres.", "VALIDATION_ERROR");
      }

      const payload = trackRepo.listTracks({ genre, language, q });
      return {
        statusCode: 200,
        body: payload,
      };
    },

    async createTrack({ body }) {
      const title = validateStringField(body.title, "title", { min: 2, max: 140 });
      const artist = validateStringField(body.artist, "artist", { min: 2, max: 120 });
      const genre = validateStringField(body.genre, "genre", { min: 2, max: 60 });
      const language = validateStringField(body.language, "language", { min: 2, max: 15 }).toLowerCase();

      if (language !== "es" && language !== "en" && language !== "instrumental") {
        throw new AppError(
          400,
          "El campo 'language' debe ser 'es', 'en' o 'instrumental'.",
          "VALIDATION_ERROR"
        );
      }

      const rawYoutube = body.youtubeUrl ?? body.youtubeId;
      const youtubeInput = validateStringField(rawYoutube, "youtubeUrl", { min: 11, max: 300 });
      const youtubeId = extractYouTubeId(youtubeInput);

      if (!youtubeId) {
        throw new AppError(
          400,
          "Proporciona una URL válida de YouTube (youtube.com / youtu.be) o un ID de 11 caracteres.",
          "INVALID_YOUTUBE_URL"
        );
      }

      let releaseYear = null;
      if (body.releaseYear !== undefined && body.releaseYear !== null && body.releaseYear !== "") {
        const parsedYear = Number(body.releaseYear);
        if (!Number.isInteger(parsedYear) || parsedYear < 1700 || parsedYear > 2100) {
          throw new AppError(
            400,
            "El campo 'releaseYear' debe ser un año entero entre 1700 y 2100.",
            "VALIDATION_ERROR"
          );
        }
        releaseYear = parsedYear;
      }

      const notes = validateStringField(body.notes, "notes", {
        min: 0,
        max: 400,
        required: false,
      });

      const track = await ragService.createAndEmbedTrack({
        title,
        artist,
        genre,
        language,
        youtubeId,
        releaseYear,
        notes,
      });

      return {
        statusCode: 201,
        body: { track },
      };
    },

    async deleteTrack({ idParam }) {
      if (!/^\d+$/.test(idParam)) {
        throw new AppError(400, "El identificador debe ser un entero positivo.", "INVALID_ID");
      }

      const id = Number(idParam);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError(400, "El identificador debe ser un entero positivo.", "INVALID_ID");
      }

      const deleted = trackRepo.deleteTrack(id);
      if (!deleted) {
        throw new AppError(404, "Canción no encontrada en SQLite.", "NOT_FOUND");
      }

      ragService.invalidateCaches();
      return {
        statusCode: 200,
        body: { deleted: true, id },
      };
    },
  };
}
