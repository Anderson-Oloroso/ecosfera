import crypto from "node:crypto";
import { blobToVector, vectorToBlob } from "./knowledgeRepository.js";

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const SUPPORTED_LANGUAGES = new Set(["es", "en", "instrumental"]);

/**
 * Extrae el identificador de 11 caracteres de YouTube desde un ID directo o URL soportada.
 * @param {string} rawInput
 * @returns {string | null}
 */
export function extractYouTubeId(rawInput) {
  if (typeof rawInput !== "string") {
    return null;
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = "";

  if (host === "youtu.be") {
    candidate = parsed.pathname.split("/").filter(Boolean)[0] || "";
  } else if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    if (parsed.pathname === "/watch") {
      candidate = parsed.searchParams.get("v") || "";
    } else {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        parts.length >= 2 &&
        (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live")
      ) {
        candidate = parts[1];
      }
    }
  } else {
    return null;
  }

  return YOUTUBE_ID_REGEX.test(candidate) ? candidate : null;
}

function slugifyTrack(title, artist) {
  const normalized = `${title}-${artist}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "pista-musical";
}

function mapTrackRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    language: row.language,
    youtubeId: row.youtube_id,
    youtubeUrl: `https://www.youtube.com/watch?v=${row.youtube_id}`,
    embedUrl: `https://www.youtube.com/embed/${row.youtube_id}?rel=0`,
    thumbnailUrl: `https://i.ytimg.com/vi/${row.youtube_id}/hqdefault.jpg`,
    releaseYear: row.release_year ?? null,
    notes: row.notes || "",
    hasEmbedding: Boolean(row.has_embedding),
    dimensions: Number(row.embedding_dimensions ?? 0),
    createdAt: row.created_at,
  };
}

/**
 * Repositorio SQLite para el catálogo musical vectorial y reproducción YouTube.
 * @param {import("node:sqlite").DatabaseSync} db
 */
export function createTrackRepository(db) {
  const stmtStats = db.prepare(`
    SELECT
      COUNT(*) AS tracksTotal,
      COALESCE(SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END), 0) AS vectorsReady
    FROM music_tracks
  `);

  const stmtDistinctGenres = db.prepare(`
    SELECT DISTINCT genre
    FROM music_tracks
    ORDER BY genre ASC
  `);

  const stmtFindById = db.prepare(`
    SELECT
      id,
      slug,
      title,
      artist,
      genre,
      language,
      youtube_id,
      release_year,
      notes,
      (embedding IS NOT NULL) AS has_embedding,
      embedding_dimensions,
      created_at
    FROM music_tracks
    WHERE id = ?
  `);

  const stmtAllWithEmbeddings = db.prepare(`
    SELECT
      id,
      slug,
      title,
      artist,
      genre,
      language,
      youtube_id,
      release_year,
      notes,
      embedding,
      embedding_dimensions,
      embedding_model,
      created_at
    FROM music_tracks
    ORDER BY id ASC
  `);

  const stmtMissingEmbeddings = db.prepare(`
    SELECT
      id,
      slug,
      title,
      artist,
      genre,
      language,
      youtube_id,
      release_year,
      notes,
      created_at
    FROM music_tracks
    WHERE embedding IS NULL
    ORDER BY id ASC
  `);

  const stmtSlugExists = db.prepare(`
    SELECT 1 FROM music_tracks WHERE slug = ? LIMIT 1
  `);

  const stmtInsert = db.prepare(`
    INSERT INTO music_tracks (slug, title, artist, genre, language, youtube_id, release_year, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stmtUpdateEmbedding = db.prepare(`
    UPDATE music_tracks
    SET embedding = ?,
        embedding_dimensions = ?,
        embedding_model = ?
    WHERE id = ?
  `);

  const stmtDelete = db.prepare(`
    DELETE FROM music_tracks WHERE id = ?
  `);

  return {
    getCount() {
      const row = stmtStats.get();
      return Number(row?.tracksTotal ?? 0);
    },

    getStats() {
      const row = stmtStats.get();
      const tracksTotal = Number(row?.tracksTotal ?? 0);
      const vectorsReady = Number(row?.vectorsReady ?? 0);
      return {
        tracksTotal,
        vectorsReady,
        vectorsPending: Math.max(0, tracksTotal - vectorsReady),
      };
    },

    listTracks({ genre, language, q } = {}) {
      const conditions = [];
      const params = [];

      if (typeof genre === "string" && genre.trim()) {
        conditions.push("genre = ?");
        params.push(genre.trim());
      }

      const normalizedLang = typeof language === "string" ? language.trim().toLowerCase() : "";
      if (normalizedLang && SUPPORTED_LANGUAGES.has(normalizedLang)) {
        conditions.push("language = ?");
        params.push(normalizedLang);
      }

      if (typeof q === "string" && q.trim()) {
        const needle = `%${q.trim().toLowerCase()}%`;
        conditions.push(
          "(LOWER(title) LIKE ? OR LOWER(artist) LIKE ? OR LOWER(genre) LIKE ? OR LOWER(notes) LIKE ?)"
        );
        params.push(needle, needle, needle, needle);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const sql = `
        SELECT
          id,
          slug,
          title,
          artist,
          genre,
          language,
          youtube_id,
          release_year,
          notes,
          (embedding IS NOT NULL) AS has_embedding,
          embedding_dimensions,
          created_at
        FROM music_tracks
        ${whereClause}
        ORDER BY id ASC
      `;

      const rows = db.prepare(sql).all(...params);
      const genres = stmtDistinctGenres.all().map((row) => row.genre);

      return {
        tracks: rows.map(mapTrackRow),
        genres,
        languages: ["es", "en", "instrumental"],
        total: rows.length,
      };
    },

    listAllWithEmbeddings() {
      return stmtAllWithEmbeddings.all().map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        artist: row.artist,
        genre: row.genre,
        language: row.language,
        youtubeId: row.youtube_id,
        youtubeUrl: `https://www.youtube.com/watch?v=${row.youtube_id}`,
        embedUrl: `https://www.youtube.com/embed/${row.youtube_id}?rel=0`,
        thumbnailUrl: `https://i.ytimg.com/vi/${row.youtube_id}/hqdefault.jpg`,
        releaseYear: row.release_year ?? null,
        notes: row.notes || "",
        dimensions: Number(row.embedding_dimensions ?? 0),
        embeddingModel: row.embedding_model || "",
        vector: blobToVector(row.embedding),
        createdAt: row.created_at,
      }));
    },

    findMissingEmbeddings() {
      return stmtMissingEmbeddings.all().map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        artist: row.artist,
        genre: row.genre,
        language: row.language,
        youtubeId: row.youtube_id,
        releaseYear: row.release_year ?? null,
        notes: row.notes || "",
        createdAt: row.created_at,
      }));
    },

    findById(id) {
      const row = stmtFindById.get(id);
      return row ? mapTrackRow(row) : null;
    },

    createTrack({ title, artist, genre, language, youtubeId, releaseYear = null, notes = "" }) {
      const baseSlug = slugifyTrack(title, artist);
      let candidateSlug = baseSlug;

      while (stmtSlugExists.get(candidateSlug)) {
        const suffix = crypto.randomBytes(3).toString("hex");
        candidateSlug = `${baseSlug}-${suffix}`;
      }

      const result = stmtInsert.run(
        candidateSlug,
        title,
        artist,
        genre,
        language,
        youtubeId,
        releaseYear,
        notes
      );

      return this.findById(Number(result.lastInsertRowid));
    },

    updateEmbedding(id, vector, model) {
      const blob = vectorToBlob(vector);
      const dimensions = vector.length;
      const result = stmtUpdateEmbedding.run(blob, dimensions, model, id);
      return result.changes > 0;
    },

    deleteTrack(id) {
      const result = stmtDelete.run(id);
      return result.changes > 0;
    },
  };
}
