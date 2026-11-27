-- 1. Conteo de fichas por categoría y estado de vectorización
SELECT
  category,
  COUNT(*) AS total_documents,
  SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) AS vectors_ready,
  SUM(CASE WHEN embedding IS NULL THEN 1 ELSE 0 END) AS vectors_pending
FROM knowledge_documents
GROUP BY category
ORDER BY total_documents DESC, category ASC;

-- 2. Fichas pendientes de generar embedding
SELECT
  id,
  slug,
  title,
  category,
  created_at
FROM knowledge_documents
WHERE embedding IS NULL
ORDER BY id ASC;

-- 3. Historial reciente de consultas RAG con JOIN hacia la ficha principal
SELECT
  ql.id,
  ql.question,
  ql.top_similarity,
  ql.latency_ms,
  ql.created_at,
  kd.id AS top_document_id,
  kd.title AS top_document_title,
  kd.category AS top_document_category
FROM query_logs ql
LEFT JOIN knowledge_documents kd ON kd.id = ql.top_document_id
ORDER BY ql.id DESC
LIMIT 20;

-- 4. Conteo de músicas de YouTube por género, idioma y estado vectorial
SELECT
  genre,
  language,
  COUNT(*) AS total_tracks,
  SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) AS vectors_ready
FROM music_tracks
GROUP BY genre, language
ORDER BY genre ASC, language ASC;

-- 5. Listado de músicas disponibles en español, inglés o instrumental
SELECT
  id,
  title,
  artist,
  genre,
  language,
  youtube_id,
  release_year,
  (embedding IS NOT NULL) AS has_embedding
FROM music_tracks
ORDER BY genre ASC, title ASC;
