import { GoogleGenAI } from "@google/genai";

const RETRY_DELAYS_MS = [300, 800];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error) {
  const status = error?.status ?? error?.statusCode ?? error?.code;
  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return true;
  }

  const networkCodes = new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNREFUSED",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ]);

  if (typeof error?.code === "string" && networkCodes.has(error.code)) {
    return true;
  }

  const message = String(error?.message ?? "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("503") ||
    message.includes("rate limit") ||
    message.includes("unavailable") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout")
  );
}

/**
 * Normaliza un texto para usar como clave estable en caché LRU.
 * @param {string} text
 * @returns {string}
 */
export function normalizeQueryKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Formatea una ficha musical de conocimiento para indexación vectorial uniforme.
 */
export function formatDocumentForEmbedding(doc) {
  return `title: ${doc.title}\ncategory: ${doc.category}\ntags: ${doc.tags || ""}\ntext: ${doc.content}`;
}

/**
 * Formatea una canción del catálogo YouTube para indexación vectorial en SQLite.
 */
export function formatTrackForEmbedding(track) {
  const langLabel =
    track.language === "es"
      ? "Español"
      : track.language === "en"
        ? "Inglés"
        : "Instrumental";

  return [
    `cancion: ${track.title}`,
    `artista: ${track.artist}`,
    `genero: ${track.genre}`,
    `idioma: ${langLabel}`,
    track.releaseYear ? `anio: ${track.releaseYear}` : "",
    track.notes ? `notas: ${track.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Calcula la norma euclidiana de un vector numérico.
 */
export function vectorNorm(vec) {
  if (!vec || vec.length === 0) {
    return 0;
  }
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  return Math.sqrt(sumSq);
}

/**
 * Calcula la similitud coseno segura entre dos vectores de igual dimensión.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let normASq = 0;
  let normBSq = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normASq += a * a;
    normBSq += b * b;
  }

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

/**
 * Crea el servicio de embeddings Gemini v1beta con caché LRU para reducir latencia y consumo.
 */
export function createEmbeddingService(config) {
  const embedClient = config.apiKey
    ? new GoogleGenAI({
        apiKey: config.apiKey,
        httpOptions: { apiVersion: "v1beta" },
      })
    : null;

  const maxEntries = Math.max(16, Number(config.embeddingCacheSize) || 128);
  const queryCache = new Map();
  let cacheHits = 0;
  let cacheMisses = 0;

  function readCache(key) {
    if (!queryCache.has(key)) {
      return null;
    }
    const vector = queryCache.get(key);
    queryCache.delete(key);
    queryCache.set(key, vector);
    cacheHits += 1;
    return vector;
  }

  function writeCache(key, vector) {
    if (!key) {
      return;
    }
    if (queryCache.has(key)) {
      queryCache.delete(key);
    } else if (queryCache.size >= maxEntries) {
      const oldestKey = queryCache.keys().next().value;
      if (oldestKey !== undefined) {
        queryCache.delete(oldestKey);
      }
    }
    queryCache.set(key, vector);
  }

  async function requestEmbeddingFromApi(text) {
    if (!embedClient) {
      const err = new Error(
        "GEMINI_API_KEY no está configurada para generar embeddings."
      );
      err.statusCode = 503;
      err.code = "AI_NOT_CONFIGURED";
      throw err;
    }

    let lastError;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await embedClient.models.embedContent({
          model: config.embeddingModel,
          contents: text,
          config: {
            outputDimensionality: config.embeddingDimensions,
          },
        });

        const values = response?.embeddings?.[0]?.values;
        if (!Array.isArray(values) || values.length === 0) {
          throw new Error("El servicio de embeddings devolvió una respuesta vacía.");
        }

        return Float32Array.from(values);
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_DELAYS_MS.length && isRetryableError(error)) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
    }

    const wrapped = new Error(
      "No se pudo generar el embedding con el proveedor de IA."
    );
    wrapped.statusCode = 502;
    wrapped.code = "EMBEDDING_FAILED";
    wrapped.cause = lastError;
    throw wrapped;
  }

  return {
    formatDocumentForEmbedding,
    formatTrackForEmbedding,
    cosineSimilarity,
    vectorNorm,

    getCacheStats() {
      return {
        size: queryCache.size,
        maxEntries,
        hits: cacheHits,
        misses: cacheMisses,
      };
    },

    async getEmbeddingWithMeta(text, { useCache = true } = {}) {
      const cacheKey = useCache ? normalizeQueryKey(text) : "";
      if (useCache && cacheKey) {
        const cached = readCache(cacheKey);
        if (cached) {
          return { vector: cached, fromCache: true };
        }
      }

      cacheMisses += 1;
      const vector = await requestEmbeddingFromApi(text);
      if (useCache && cacheKey) {
        writeCache(cacheKey, vector);
      }
      return { vector, fromCache: false };
    },

    async createEmbedding(text, options = {}) {
      const { vector } = await this.getEmbeddingWithMeta(text, options);
      return vector;
    },
  };
}
