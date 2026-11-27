CREATE TABLE IF NOT EXISTS knowledge_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  embedding BLOB,
  embedding_dimensions INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS query_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  top_document_id INTEGER REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  top_similarity REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_query_logs_created ON query_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS music_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('es', 'en', 'instrumental')),
  youtube_id TEXT NOT NULL,
  release_year INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  embedding BLOB,
  embedding_dimensions INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_music_tracks_genre ON music_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_music_tracks_language ON music_tracks(language);
