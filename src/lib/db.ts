import Database from "better-sqlite3"
import path from "path"

const dbPath = path.join(process.cwd(), "data", "kumaview.db")

let db: Database.Database | null = null

export function getDb() {
  if (!db) {
    const fs = require("fs")
    const dataDir = path.join(process.cwd(), "data")

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    db = new Database(dbPath)
    initializeDatabase(db)
  }
  return db
}

function initializeDatabase(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS uptime_kuma_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(url, slug)
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER NOT NULL,
      source_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      type TEXT,
      interval INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id, source_id),
      FOREIGN KEY (source_id) REFERENCES uptime_kuma_sources(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_monitors_source ON monitors(source_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Migration: Add slug column if it doesn't exist and migrate data
  try {
    const columns = database.pragma("table_info(uptime_kuma_sources)") as any[]
    const hasSlug = columns.some((col: any) => col.name === "slug")

    if (!hasSlug) {
      database.exec(`
        ALTER TABLE uptime_kuma_sources ADD COLUMN slug TEXT;
        UPDATE uptime_kuma_sources SET slug = COALESCE(api_key, 'default') WHERE slug IS NULL;
      `)
    }
  } catch (error) {
    // Table might not exist yet, ignore
  }
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
