import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

function resolveDbPath(rawPath) {
  if (rawPath === ":memory:") {
    return ":memory:";
  }
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(PROJECT_ROOT, rawPath);
}

function parseFallbackModels(rawValue) {
  const defaults = ["gemini-3.5-flash", "gemini-4-hydrogen"];
  const list = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === "string" && rawValue.trim()
      ? rawValue.split(",")
      : defaults;

  return list
    .map((item) => String(item).trim())
    .filter((item) => item && !/^gemini-(1\.5|2\.0|2\.5)-/i.test(item));
}

/**
 * Carga la configuración tipada de Ecosfera permitiendo sobreescrituras para pruebas.
 * @param {Record<string, unknown>} [overrides={}]
 */
export function loadConfig(overrides = {}) {
  const rawDbPath = overrides.dbPath ?? process.env.DB_PATH ?? "./data/music_knowledge.db";

  return {
    appName: "Ecosfera",
    projectRoot: PROJECT_ROOT,
    port: overrides.port ?? (Number(process.env.PORT) || 3000),
    dbPath: resolveDbPath(String(rawDbPath)),
    apiKey: String(overrides.apiKey ?? process.env.GEMINI_API_KEY ?? ""),
    embeddingModel: String(
      overrides.embeddingModel ?? process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2"
    ),
    chatModel: String(
      overrides.chatModel ?? process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite"
    ),
    chatFallbackModels: parseFallbackModels(
      overrides.chatFallbackModels ?? process.env.GEMINI_CHAT_FALLBACK_MODELS
    ),
    embeddingDimensions: Number(
      overrides.embeddingDimensions ?? (Number(process.env.EMBEDDING_DIMENSIONS) || 768)
    ),
    similarityThreshold: Number(
      overrides.similarityThreshold ?? (Number(process.env.SIMILARITY_THRESHOLD) || 0.60)
    ),
    maxContextChars: Number(
      overrides.maxContextChars ?? (Number(process.env.MAX_CONTEXT_CHARS) || 1400)
    ),
    cacheTtlMs: Number(
      overrides.cacheTtlMs ?? (Number(process.env.CACHE_TTL_MS) || 300000)
    ),
    embeddingCacheSize: Number(
      overrides.embeddingCacheSize ?? (Number(process.env.EMBEDDING_CACHE_SIZE) || 128)
    ),
    answerCacheSize: Number(
      overrides.answerCacheSize ?? (Number(process.env.ANSWER_CACHE_SIZE) || 64)
    ),
    allowedOrigin: String(overrides.allowedOrigin ?? process.env.ALLOWED_ORIGIN ?? ""),
  };
}
