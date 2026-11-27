import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

/**
 * Inicializa la base de datos SQLite de Ecosfera, aplica pragmas y ejecuta DDL/DML idempotentes.
 * @param {string} dbPath
 * @returns {DatabaseSync}
 */
export function initDatabase(dbPath) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec("PRAGMA foreign_keys = ON;");

  const existingTracksTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'music_tracks'")
    .get();

  if (
    existingTracksTable?.sql &&
    (!existingTracksTable.sql.includes("'instrumental'") ||
      !existingTracksTable.sql.includes("embedding_dimensions"))
  ) {
    db.exec("DROP TABLE IF EXISTS music_tracks;");
  }

  const schemaSql = fs.readFileSync(
    path.join(PROJECT_ROOT, "sql", "ddl", "001_schema.sql"),
    "utf8"
  );
  const seedSql = fs.readFileSync(
    path.join(PROJECT_ROOT, "sql", "dml", "001_seed_music.sql"),
    "utf8"
  );
  const tracksSeedSql = fs.readFileSync(
    path.join(PROJECT_ROOT, "sql", "dml", "002_seed_tracks.sql"),
    "utf8"
  );

  db.exec(schemaSql);
  db.exec(seedSql);
  db.exec(tracksSeedSql);

  return db;
}
