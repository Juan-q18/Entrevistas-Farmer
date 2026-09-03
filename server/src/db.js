import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const localUrl = `file:${join(dataDir, 'app.db').replace(/\\/g, '/')}`;
const url = process.env.TURSO_DATABASE_URL || localUrl;

export const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
});

export async function exec(sql, args = []) {
  await client.execute({ sql, args });
}

export async function all(sql, args = []) {
  const res = await client.execute({ sql, args });
  return res.rows;
}

export async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0];
}

export async function run(sql, args = []) {
  const res = await client.execute({ sql, args });
  return { changes: Number(res.rowsAffected ?? 0), lastInsertRowid: Number(res.lastInsertRowid) };
}

export async function initSchema() {
  if (url === localUrl) {
    await exec('PRAGMA foreign_keys = ON');
  }

  // detectar schema viejo (sin users) → resetear (opción B: empezar de cero)
  const tables = await all("SELECT name FROM sqlite_master WHERE type = 'table'");
  const hasUsers = tables.some((t) => t.name === 'users');
  if (!hasUsers && tables.length > 0) {
    await exec('DROP TABLE IF EXISTS job_searches');
    await exec('DROP TABLE IF EXISTS jobs');
    await exec('DROP TABLE IF EXISTS searches');
    await exec('DROP TABLE IF EXISTS settings');
    await exec('DROP TABLE IF EXISTS cv');
    await exec('DROP TABLE IF EXISTS users');
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS cv (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL DEFAULT '{}',
      template TEXT NOT NULL DEFAULT 'clasica',
      raw_text TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      geo_id TEXT NOT NULL DEFAULT '',
      experience_levels TEXT NOT NULL DEFAULT '[]',
      job_types TEXT NOT NULL DEFAULT '[]',
      work_types TEXT NOT NULL DEFAULT '[]',
      countries TEXT NOT NULL DEFAULT '[]',
      remote_only INTEGER NOT NULL DEFAULT 0,
      time_posted TEXT NOT NULL DEFAULT '',
      company_id TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_run_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
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
      remote INTEGER NOT NULL DEFAULT 0,
      country TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS job_searches (
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      search_id INTEGER NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
      PRIMARY KEY (job_id, search_id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )`
  ];
  for (const stmt of statements) {
    await exec(stmt);
  }
}

export function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export default { exec, all, get, run, initSchema };