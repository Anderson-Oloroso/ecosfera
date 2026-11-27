import crypto from "node:crypto";

/**
 * Convierte un vector numérico en Uint8Array compatible con BLOB de SQLite.
 * @param {number[] | Float32Array} vector
 * @returns {Uint8Array}
 */
export function vectorToBlob(vector) {
  const float32 = Float32Array.from(vector);
  return new Uint8Array(
    float32.buffer.slice(float32.byteOffset, float32.byteOffset + float32.byteLength)
  );
}

/**
 * Reconstruye un Float32Array desde un BLOB (Uint8Array) leído de SQLite.
 * @param {Uint8Array | null | undefined} blob
 * @returns {Float32Array | null}
 */
export function blobToVector(blob) {
  if (!blob) {
    return null;
  }
  return new Float32Array(
    blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)
  );
}

/**
 * Genera un slug URL-safe en español a partir del título.
 * @param {string} title
 * @returns {string}
 */
function slugify(title) {
  const normalized = String(title)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "ficha-musical";
}

function mapPublicDocument(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    content: row.content,
    tags: row.tags,
    hasEmbedding: Boolean(row.has_embedding),
    dimensions: row.embedding_dimensions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Crea el repositorio de acceso a datos para fichas musicales y trazas de consulta.
 * @param {import("node:sqlite").DatabaseSync} db
 */
export function createKnowledgeRepository(db) {
  const stmtStats = db.prepare(`
    SELECT
      COUNT(*) AS documentsTotal,
      COALESCE(SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END), 0) AS vectorsReady
    FROM knowledge_documents
  `);

  const stmtListAll = db.prepare(`
    SELECT
      id,
      slug,
      title,
      category,
      content,
      tags,
      (embedding IS NOT NULL) AS has_embedding,
      embedding_dimensions,
      created_at,
      updated_at
    FROM knowledge_documents
    ORDER BY id DESC
  `);

  const stmtListByCategory = db.prepare(`
    SELECT
      id,
      slug,
      title,
      category,
      content,
      tags,
      (embedding IS NOT NULL) AS has_embedding,
      embedding_dimensions,
      created_at,
      updated_at
    FROM knowledge_documents
    WHERE category = ?
    ORDER BY id DESC
  `);

  const stmtDistinctCategories = db.prepare(`
    SELECT DISTINCT category
    FROM knowledge_documents
    ORDER BY category ASC
  `);

  const stmtAllWithEmbeddings = db.prepare(`
    SELECT
      id,
      slug,
      title,
      category,
      content,
      tags,
      embedding,
      embedding_dimensions,
      embedding_model,
      created_at,
      updated_at
    FROM knowledge_documents
    ORDER BY id ASC
  `);

  const stmtMissingEmbeddings = db.prepare(`
    SELECT
      id,
      slug,
      title,
      category,
      content,
      tags,
      created_at,
      updated_at
    FROM knowledge_documents
    WHERE embedding IS NULL
    ORDER BY id ASC
  `);

  const stmtFindById = db.prepare(`
    SELECT
      id,
      slug,
      title,
      category,
      content,
      tags,
      (embedding IS NOT NULL) AS has_embedding,
      embedding_dimensions,
      created_at,
      updated_at
    FROM knowledge_documents
    WHERE id = ?
  `);

  const stmtSlugExists = db.prepare(`
    SELECT 1 FROM knowledge_documents WHERE slug = ? LIMIT 1
  `);

  const stmtInsertDocument = db.prepare(`
    INSERT INTO knowledge_documents (slug, title, category, content, tags)
    VALUES (?, ?, ?, ?, ?)
  `);

  const stmtUpdateEmbedding = db.prepare(`
    UPDATE knowledge_documents
    SET embedding = ?,
        embedding_dimensions = ?,
        embedding_model = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  const stmtDeleteDocument = db.prepare(`
    DELETE FROM knowledge_documents WHERE id = ?
  `);

  const stmtInsertQueryLog = db.prepare(`
    INSERT INTO query_logs (question, answer, top_document_id, top_similarity, latency_ms)
    VALUES (?, ?, ?, ?, ?)
  `);

  const stmtListHistory = db.prepare(`
    SELECT
      ql.id,
      ql.question,
      ql.answer,
      ql.top_document_id,
      kd.title AS top_document_title,
      ql.top_similarity,
      ql.latency_ms,
      ql.created_at
    FROM query_logs ql
    LEFT JOIN knowledge_documents kd ON kd.id = ql.top_document_id
    ORDER BY ql.id DESC
    LIMIT ?
  `);

  return {
    getStats() {
      const row = stmtStats.get();
      const documentsTotal = Number(row?.documentsTotal ?? 0);
      const vectorsReady = Number(row?.vectorsReady ?? 0);
      return {
        documentsTotal,
        vectorsReady,
        vectorsPending: Math.max(0, documentsTotal - vectorsReady),
      };
    },

    listDocuments({ category } = {}) {
      const trimmedCategory = typeof category === "string" ? category.trim() : "";
      const rows = trimmedCategory
        ? stmtListByCategory.all(trimmedCategory)
        : stmtListAll.all();
      const categories = stmtDistinctCategories.all().map((row) => row.category);

      return {
        documents: rows.map(mapPublicDocument),
        categories,
      };
    },

    listAllWithEmbeddings() {
      return stmtAllWithEmbeddings.all().map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        category: row.category,
        content: row.content,
        tags: row.tags,
        dimensions: row.embedding_dimensions,
        embeddingModel: row.embedding_model,
        vector: blobToVector(row.embedding),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    findMissingEmbeddings() {
      return stmtMissingEmbeddings.all().map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        category: row.category,
        content: row.content,
        tags: row.tags,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    findById(id) {
      const row = stmtFindById.get(id);
      return row ? mapPublicDocument(row) : null;
    },

    createDocument({ title, category, content, tags = "" }) {
      const baseSlug = slugify(title);
      let candidateSlug = baseSlug;

      while (stmtSlugExists.get(candidateSlug)) {
        const suffix = crypto.randomBytes(3).toString("hex");
        candidateSlug = `${baseSlug}-${suffix}`;
      }

      const result = stmtInsertDocument.run(
        candidateSlug,
        title,
        category,
        content,
        tags
      );

      return this.findById(Number(result.lastInsertRowid));
    },

    updateEmbedding(id, vector, model) {
      const blob = vectorToBlob(vector);
      const dimensions = vector.length;
      const result = stmtUpdateEmbedding.run(blob, dimensions, model, id);
      return result.changes > 0;
    },

    deleteDocument(id) {
      const result = stmtDeleteDocument.run(id);
      return result.changes > 0;
    },

    insertQueryLog({
      question,
      answer,
      topDocumentId = null,
      topSimilarity = 0,
      latencyMs = 0,
    }) {
      const result = stmtInsertQueryLog.run(
        question,
        answer,
        topDocumentId,
        topSimilarity,
        Math.round(latencyMs)
      );
      return Number(result.lastInsertRowid);
    },

    listHistory(limit = 12) {
      const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
      return stmtListHistory.all(safeLimit).map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        topDocumentId: row.top_document_id,
        topDocumentTitle: row.top_document_title ?? null,
        topSimilarity: row.top_similarity,
        latencyMs: row.latency_ms,
        createdAt: row.created_at,
      }));
    },
  };
}
