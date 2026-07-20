import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 数据库是一个本地文件：server/data/moji.db（已被 .gitignore 排除，日记不进 git）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'moji.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    name TEXT,
    entry TEXT NOT NULL,
    tone TEXT NOT NULL,
    mood TEXT NOT NULL,
    reflection TEXT NOT NULL
  )
`);

export function saveEntry({ name, entry, tone, mood, reflection }) {
  const stmt = db.prepare(
    'INSERT INTO entries (created_at, name, entry, tone, mood, reflection) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(new Date().toISOString(), name ?? null, entry, tone, mood, reflection);
  return info.lastInsertRowid;
}

export function countEntries() {
  return db.prepare('SELECT COUNT(*) AS n FROM entries').get().n;
}
