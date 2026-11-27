import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "../controllers/musicController.js";

const MAX_BODY_BYTES = 64 * 1024; // 64 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function isAllowedOrigin(origin, configuredOrigin) {
  if (!origin) {
    return false;
  }
  if (configuredOrigin && origin === configuredOrigin) {
    return true;
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function applyCorsHeaders(req, res, allowedOriginConfig) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin, allowedOriginConfig)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return true;
  }
  return false;
}

function createRateLimiter() {
  const buckets = new Map();

  return function checkRateLimit(req) {
    const now = Date.now();
    const ip = req.socket?.remoteAddress || "unknown";
    const entry = buckets.get(ip);

    if (!entry || now >= entry.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      if (buckets.size > 1000) {
        for (const [key, value] of buckets.entries()) {
          if (now >= value.resetAt) {
            buckets.delete(key);
          }
        }
      }
      return;
    }

    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
      throw new AppError(
        429,
        "Demasiadas peticiones desde esta dirección IP. Intenta nuevamente en un minuto.",
        "RATE_LIMIT_EXCEEDED"
      );
    }
  };
}

async function readJsonBody(req) {
  const declaredLength = Number(req.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new AppError(
      413,
      "El cuerpo de la petición excede el límite permitido de 64 KB.",
      "PAYLOAD_TOO_LARGE"
    );
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new AppError(
        413,
        "El cuerpo de la petición excede el límite permitido de 64 KB.",
        "PAYLOAD_TOO_LARGE"
      );
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    throw new AppError(400, "Se requiere un cuerpo JSON válido.", "INVALID_JSON");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(400, "El cuerpo no contiene JSON válido.", "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(
      400,
      "El cuerpo JSON debe ser un objeto válido.",
      "INVALID_JSON"
    );
  }

  return parsed;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

async function serveStaticFile(req, res, pathname, publicDir) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    throw new AppError(405, "Método no permitido.", "METHOD_NOT_ALLOWED");
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new AppError(400, "Ruta inválida.", "BAD_REQUEST");
  }

  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    throw new AppError(400, "Ruta inválida.", "BAD_REQUEST");
  }

  const targetRelative = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  if (!targetRelative || targetRelative.split("/").some((segment) => segment === "..")) {
    throw new AppError(403, "Acceso denegado.", "FORBIDDEN");
  }

  const resolvedPublicDir = path.resolve(publicDir);
  const resolvedFile = path.resolve(resolvedPublicDir, targetRelative);

  if (
    resolvedFile !== resolvedPublicDir &&
    !resolvedFile.startsWith(resolvedPublicDir + path.sep)
  ) {
    throw new AppError(403, "Acceso denegado.", "FORBIDDEN");
  }

  let stat;
  try {
    stat = await fs.stat(resolvedFile);
  } catch {
    throw new AppError(404, "Recurso no encontrado.", "NOT_FOUND");
  }

  if (!stat.isFile()) {
    throw new AppError(404, "Recurso no encontrado.", "NOT_FOUND");
  }

  const ext = path.extname(resolvedFile).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = await fs.readFile(resolvedFile);

  const headers = {
    "Content-Type": contentType,
    "Content-Length": content.length,
    "X-Content-Type-Options": "nosniff",
  };

  if (ext === ".html" || ext === ".js" || ext === ".css") {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  }

  res.writeHead(200, headers);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  res.end(content);
}

function sanitizeErrorMessage(error, apiKey) {
  const raw = String(error?.message || "Error interno del servidor.");
  return apiKey ? raw.split(apiKey).join("[REDACTED]") : raw;
}

/**
 * Crea el enrutador HTTP principal con CORS, rate limit, validación y manejo central de errores.
 */
export function createRouter({ controller, config }) {
  const publicDir = path.join(config.projectRoot, "public");
  const checkRateLimit = createRateLimiter();

  return async function handleRequest(req, res) {
    try {
      applyCorsHeaders(req, res, config.allowedOrigin);

      const url = new URL(req.url || "/", "http://localhost");
      const pathname = url.pathname;
      const method = (req.method || "GET").toUpperCase();

      if (pathname.startsWith("/api/")) {
        if (method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        checkRateLimit(req);

        if (method === "GET" && pathname === "/api/health") {
          const result = await controller.health();
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "GET" && pathname === "/api/documents") {
          const result = await controller.listDocuments({
            searchParams: url.searchParams,
          });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "POST" && pathname === "/api/documents") {
          const body = await readJsonBody(req);
          const result = await controller.createDocument({ body });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        const deleteMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
        if (method === "DELETE" && deleteMatch) {
          const result = await controller.deleteDocument({
            idParam: deleteMatch[1],
          });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "POST" && pathname === "/api/sync-embeddings") {
          const result = await controller.syncEmbeddings();
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "POST" && pathname === "/api/query") {
          const body = await readJsonBody(req);
          const result = await controller.query({ body });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "POST" && pathname === "/api/chat") {
          const body = await readJsonBody(req);
          const result = await controller.chat({ body });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "GET" && pathname === "/api/history") {
          const result = await controller.listHistory({
            searchParams: url.searchParams,
          });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "GET" && pathname === "/api/tracks") {
          const result = await controller.listTracks({
            searchParams: url.searchParams,
          });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        if (method === "POST" && pathname === "/api/tracks") {
          const body = await readJsonBody(req);
          const result = await controller.createTrack({ body });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        const deleteTrackMatch = pathname.match(/^\/api\/tracks\/([^/]+)$/);
        if (method === "DELETE" && deleteTrackMatch) {
          const result = await controller.deleteTrack({
            idParam: deleteTrackMatch[1],
          });
          sendJson(res, result.statusCode, result.body);
          return;
        }

        throw new AppError(404, "Endpoint de API no encontrado.", "NOT_FOUND");
      }

      await serveStaticFile(req, res, pathname, publicDir);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }

      if (error instanceof AppError) {
        sendJson(res, error.statusCode, {
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500;
      const code = typeof error?.code === "string" ? error.code : "INTERNAL_ERROR";
      const safeMessage =
        statusCode === 500
          ? "Error interno al procesar la solicitud."
          : sanitizeErrorMessage(error, config.apiKey);

      console.error("[HTTP Error]", code, sanitizeErrorMessage(error, config.apiKey));

      sendJson(res, statusCode, {
        error: {
          code,
          message: safeMessage,
        },
      });
    }
  };
}
