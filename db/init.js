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

// Safe migration helper — silently ignores "column already exists" errors
function addColumn(db, table, col, def) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
}

// Check whether a column exists in a table
function hasColumn(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(r => r.name === col);
}

// Recreate the tasks table to drop the NOT NULL on equipment_id.
// This is needed when upgrading from v1 where equipment_id was NOT NULL,
// which prevents room tasks (equipment_id = NULL) from being inserted.
function migrateTasksTableIfNeeded(db) {
  const cols = db.prepare('PRAGMA table_info(tasks)').all();
  const equipCol = cols.find(c => c.name === 'equipment_id');

  // notnull === 1 means the column has a NOT NULL constraint
  if (!equipCol || equipCol.notnull !== 1) {
    return; // already correct, nothing to do
  }

  console.log('[DB] Migrating tasks table: removing NOT NULL from equipment_id...');

  // Must disable foreign keys for the recreation, then re-enable
  db.pragma('foreign_keys = OFF');

  db.transaction(() => {
    db.exec(`
      -- Step 1: rename old table
      ALTER TABLE tasks RENAME TO tasks_old;

      -- Step 2: create new table with equipment_id nullable
      CREATE TABLE tasks (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id      INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        room_id           INTEGER REFERENCES rooms(id)    ON DELETE CASCADE,
        name              TEXT    NOT NULL,
        description       TEXT,
        trigger_type      TEXT    NOT NULL DEFAULT 'time',
        frequency_value   INTEGER NOT NULL DEFAULT 1,
        frequency_unit    TEXT    NOT NULL DEFAULT 'month',
        usage_unit        TEXT,
        usage_interval    INTEGER,
        last_usage_value  INTEGER,
        next_due_usage    INTEGER,
        last_completed_at DATETIME,
        next_due_at       DATETIME,
        created_by        INTEGER REFERENCES users(id),
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Step 3: copy all existing data, defaulting new columns
      INSERT INTO tasks (
        id, equipment_id, room_id, name, description,
        trigger_type, frequency_value, frequency_unit,
        usage_unit, usage_interval, last_usage_value, next_due_usage,
        last_completed_at, next_due_at, created_by, created_at
      )
      SELECT
        id,
        equipment_id,
        CASE WHEN typeof(room_id) = 'integer' THEN room_id ELSE NULL END,
        name,
        description,
        COALESCE(trigger_type, 'time'),
        COALESCE(frequency_value, 1),
        COALESCE(frequency_unit, 'month'),
        usage_unit,
        usage_interval,
        last_usage_value,
        next_due_usage,
        last_completed_at,
        next_due_at,
        created_by,
        created_at
      FROM tasks_old;

      -- Step 4: drop old table
      DROP TABLE tasks_old;
    `);
  })();

  db.pragma('foreign_keys = ON');
  console.log('[DB] Tasks table migration complete.');
}

function initDB() {
  const db = getDB();

  // ── Core tables (new installs) ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL COLLATE NOCASE,
      email         TEXT,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'member',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS homes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      address    TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      home_id     INTEGER NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      description TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id        INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name           TEXT    NOT NULL,
      description    TEXT,
      make           TEXT,
      model          TEXT,
      serial_number  TEXT,
      notes          TEXT,
      preset_type    TEXT,
      current_usage  INTEGER,
      usage_unit     TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id      INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
      room_id           INTEGER REFERENCES rooms(id)    ON DELETE CASCADE,
      name              TEXT    NOT NULL,
      description       TEXT,
      trigger_type      TEXT    NOT NULL DEFAULT 'time',
      frequency_value   INTEGER NOT NULL DEFAULT 1,
      frequency_unit    TEXT    NOT NULL DEFAULT 'month',
      usage_unit        TEXT,
      usage_interval    INTEGER,
      last_usage_value  INTEGER,
      next_due_usage    INTEGER,
      last_completed_at DATETIME,
      next_due_at       DATETIME,
      created_by        INTEGER REFERENCES users(id),
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      completed_by INTEGER REFERENCES users(id),
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      usage_value  INTEGER,
      notes        TEXT
    );
  `);

  // ── Migrations for existing databases ───────────────────────

  // MUST run before addColumn calls — removes NOT NULL from equipment_id
  // which blocks room tasks (equipment_id = null) on databases created pre-v2
  migrateTasksTableIfNeeded(db);

  // equipment columns added in v2
  addColumn(db, 'equipment', 'preset_type',   'TEXT');
  addColumn(db, 'equipment', 'current_usage', 'INTEGER');
  addColumn(db, 'equipment', 'usage_unit',    'TEXT');

  // tasks columns added in v2 — room_id omits REFERENCES (not supported in ALTER TABLE)
  addColumn(db, 'tasks', 'room_id',          'INTEGER');
  addColumn(db, 'tasks', 'trigger_type',     "TEXT NOT NULL DEFAULT 'time'");
  addColumn(db, 'tasks', 'usage_unit',       'TEXT');
  addColumn(db, 'tasks', 'usage_interval',   'INTEGER');
  addColumn(db, 'tasks', 'last_usage_value', 'INTEGER');
  addColumn(db, 'tasks', 'next_due_usage',   'INTEGER');

  // task_completions columns added in v2
  addColumn(db, 'task_completions', 'usage_value', 'INTEGER');

  console.log('[DB] Initialized at', DB_PATH);
}

module.exports = { getDB, initDB };
