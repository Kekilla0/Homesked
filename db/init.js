const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/homesked.db');

let db;

function getDB() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const db = getDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS homes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      home_id INTEGER NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      make TEXT,
      model TEXT,
      serial_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      frequency_value INTEGER NOT NULL DEFAULT 1,
      frequency_unit TEXT NOT NULL DEFAULT 'month',
      last_completed_at DATETIME,
      next_due_at DATETIME,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      completed_by INTEGER REFERENCES users(id),
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );
  `);
  console.log('[DB] Initialized at', DB_PATH);
}

module.exports = { getDB, initDB };
