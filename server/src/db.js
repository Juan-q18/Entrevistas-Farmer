import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'app.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS cv (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL DEFAULT '{}',
    template TEXT NOT NULL DEFAULT 'clasica',
    raw_text TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    keywords TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    geo_id TEXT NOT NULL DEFAULT '',
    experience_levels TEXT NOT NULL DEFAULT '[]',
    job_types TEXT NOT NULL DEFAULT '[]',
    work_types TEXT NOT NULL DEFAULT '[]',
    time_posted TEXT NOT NULL DEFAULT '',
    company_id TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_run_at TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    posted_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'nueva',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_searches (
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    search_id INTEGER NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, search_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES
    ('ai_provider', 'deepseek'),
    ('ai_model', 'deepseek-chat'),
    ('ai_api_key', ''),
    ('ai_base_url', '');

  INSERT OR IGNORE INTO cv (id, data) VALUES (1, '{}');
`);

const cvCols = db.prepare('PRAGMA table_info(cv)').all().map((c) => c.name);
if (!cvCols.includes('template')) {
  db.exec("ALTER TABLE cv ADD COLUMN template TEXT NOT NULL DEFAULT 'clasica'");
}
if (!cvCols.includes('raw_text')) {
  db.exec("ALTER TABLE cv ADD COLUMN raw_text TEXT NOT NULL DEFAULT ''");
}

const searchCols = db.prepare('PRAGMA table_info(searches)').all().map((c) => c.name);
if (!searchCols.includes('countries')) {
  db.exec("ALTER TABLE searches ADD COLUMN countries TEXT NOT NULL DEFAULT '[]'");
}

const jobCols = db.prepare('PRAGMA table_info(jobs)').all().map((c) => c.name);
if (!jobCols.includes('remote')) {
  db.exec('ALTER TABLE jobs ADD COLUMN remote INTEGER NOT NULL DEFAULT 0');
}
if (!jobCols.includes('country')) {
  db.exec("ALTER TABLE jobs ADD COLUMN country TEXT NOT NULL DEFAULT ''");
}

export default db;

export function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}