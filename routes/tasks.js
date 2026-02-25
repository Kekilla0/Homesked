const express = require('express');
const { getDB } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── Helpers ─────────────────────────────────────────────────
function calcNextDue(fromDate, frequencyValue, frequencyUnit) {
  const d = new Date(fromDate);
  switch (frequencyUnit) {
    case 'day':   d.setDate(d.getDate() + frequencyValue); break;
    case 'week':  d.setDate(d.getDate() + frequencyValue * 7); break;
    case 'month': d.setMonth(d.getMonth() + frequencyValue); break;
    case 'year':  d.setFullYear(d.getFullYear() + frequencyValue); break;
    default:      d.setMonth(d.getMonth() + frequencyValue);
  }
  return d.toISOString();
}

// Recalculate and persist a task's last_completed_at + next_due fields
// based on its current completion history
function resyncTask(db, taskId) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const lastEntry = db.prepare(`
    SELECT * FROM task_completions
    WHERE task_id = ?
    ORDER BY completed_at DESC
    LIMIT 1
  `).get(taskId);

  if (task.trigger_type === 'usage') {
    if (lastEntry) {
      const nextDueUsage = (lastEntry.usage_value || 0) + (task.usage_interval || 0);
      db.prepare(`
        UPDATE tasks SET last_completed_at=?, last_usage_value=?, next_due_usage=? WHERE id=?
      `).run(lastEntry.completed_at, lastEntry.usage_value || 0, nextDueUsage, taskId);
    } else {
      db.prepare(`UPDATE tasks SET last_completed_at=NULL, last_usage_value=NULL, next_due_usage=? WHERE id=?`)
        .run(task.usage_interval || 0, taskId);
    }
  } else {
    if (lastEntry) {
      const nextDue = calcNextDue(lastEntry.completed_at, task.frequency_value, task.frequency_unit);
      db.prepare(`UPDATE tasks SET last_completed_at=?, next_due_at=? WHERE id=?`)
        .run(lastEntry.completed_at, nextDue, taskId);
    } else {
      const nextDue = calcNextDue(task.created_at, task.frequency_value, task.frequency_unit);
      db.prepare(`UPDATE tasks SET last_completed_at=NULL, next_due_at=? WHERE id=?`)
        .run(nextDue, taskId);
    }
  }
}

// Attach computed status to time-based tasks
function attachStatus(task, equipmentCurrentUsage) {
  if (task.trigger_type === 'usage') {
    const current = equipmentCurrentUsage ?? 0;
    const nextDue = task.next_due_usage ?? 0;
    const interval = task.usage_interval || 1;
    if (current >= nextDue) {
      task.status = 'overdue';
    } else if (current >= nextDue - Math.ceil(interval * 0.1)) {
      task.status = 'due_soon';
    } else {
      task.status = 'ok';
    }
  } else {
    const now = new Date();
    const due = task.next_due_at ? new Date(task.next_due_at) : null;
    if (!due) { task.status = 'ok'; }
    else if (due < now) { task.status = 'overdue'; }
    else if (due <= new Date(now.getTime() + 7 * 86400000)) { task.status = 'due_soon'; }
    else { task.status = 'ok'; }
  }
  return task;
}

// ── List tasks ───────────────────────────────────────────────
router.get('/', (req, res) => {
  const { equipment_id, room_id } = req.query;
  if (!equipment_id && !room_id) return res.status(400).json({ error: 'equipment_id or room_id required' });

  const db = getDB();
  let tasks, equipmentCurrentUsage = null;

  if (equipment_id) {
    const eq = db.prepare('SELECT current_usage FROM equipment WHERE id = ?').get(equipment_id);
    equipmentCurrentUsage = eq ? eq.current_usage : null;
    tasks = db.prepare(`
      SELECT t.*, u.username as created_by_name
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.equipment_id = ?
      ORDER BY t.trigger_type ASC, t.next_due_at ASC
    `).all(equipment_id);
  } else {
    tasks = db.prepare(`
      SELECT t.*, u.username as created_by_name
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.room_id = ? AND t.equipment_id IS NULL
      ORDER BY t.next_due_at ASC
    `).all(room_id);
  }

  res.json(tasks.map(t => attachStatus(t, equipmentCurrentUsage)));
});

// ── Create task ──────────────────────────────────────────────
router.post('/', (req, res) => {
  const { equipment_id, room_id, name, description,
          trigger_type, frequency_value, frequency_unit,
          usage_unit, usage_interval } = req.body;

  if (!name) return res.status(400).json({ error: 'name required' });
  if (!equipment_id && !room_id) return res.status(400).json({ error: 'equipment_id or room_id required' });

  const tType  = trigger_type || 'time';
  const fVal   = parseInt(frequency_value) || 1;
  const fUnit  = frequency_unit || 'month';
  const uInt   = parseInt(usage_interval) || null;

  const db = getDB();

  let nextDueAt = null, nextDueUsage = null, initialUsage = null;

  if (tType === 'usage') {
    // For usage tasks: get current equipment reading as starting point
    if (equipment_id) {
      const eq = db.prepare('SELECT current_usage FROM equipment WHERE id = ?').get(equipment_id);
      initialUsage = eq ? (eq.current_usage || 0) : 0;
    } else {
      initialUsage = 0;
    }
    nextDueUsage = initialUsage + (uInt || 0);
  } else {
    nextDueAt = calcNextDue(new Date().toISOString(), fVal, fUnit);
  }

  const result = db.prepare(`
    INSERT INTO tasks
      (equipment_id, room_id, name, description, trigger_type,
       frequency_value, frequency_unit, usage_unit, usage_interval,
       last_usage_value, next_due_usage, next_due_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    equipment_id || null, room_id || null, name, description || null,
    tType, fVal, fUnit, usage_unit || null, uInt,
    tType === 'usage' ? initialUsage : null,
    nextDueUsage, nextDueAt, req.user.id
  );

  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const task = getDB().prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

router.put('/:id', (req, res) => {
  const { name, description, trigger_type,
          frequency_value, frequency_unit,
          usage_unit, usage_interval } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const db = getDB();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const tType = trigger_type || existing.trigger_type || 'time';
  const fVal  = parseInt(frequency_value) || 1;
  const fUnit = frequency_unit || 'month';
  const uInt  = parseInt(usage_interval) || null;

  let nextDueAt = existing.next_due_at, nextDueUsage = existing.next_due_usage;

  if (tType === 'usage') {
    const base = existing.last_usage_value || 0;
    nextDueUsage = base + (uInt || 0);
    nextDueAt = null;
  } else {
    const base = existing.last_completed_at || existing.created_at;
    nextDueAt = calcNextDue(base, fVal, fUnit);
    nextDueUsage = null;
  }

  db.prepare(`
    UPDATE tasks SET name=?, description=?, trigger_type=?,
      frequency_value=?, frequency_unit=?, usage_unit=?, usage_interval=?,
      next_due_at=?, next_due_usage=? WHERE id=?
  `).run(name, description||null, tType, fVal, fUnit,
         usage_unit||null, uInt, nextDueAt, nextDueUsage, req.params.id);

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Complete a task ──────────────────────────────────────────
router.post('/:id/complete', (req, res) => {
  const { notes, usage_value, completed_at } = req.body;
  const db = getDB();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const completedAt = completed_at ? new Date(completed_at).toISOString() : new Date().toISOString();

  db.prepare(`
    INSERT INTO task_completions (task_id, completed_by, completed_at, usage_value, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(task.id, req.user.id, completedAt,
         usage_value !== undefined ? usage_value : null, notes || null);

  // If usage task, also update equipment's current_usage if new value is higher
  if (task.trigger_type === 'usage' && usage_value !== undefined && task.equipment_id) {
    const eq = db.prepare('SELECT current_usage FROM equipment WHERE id = ?').get(task.equipment_id);
    if (eq && (eq.current_usage === null || usage_value > eq.current_usage)) {
      db.prepare('UPDATE equipment SET current_usage = ? WHERE id = ?')
        .run(usage_value, task.equipment_id);
    }
  }

  resyncTask(db, task.id);

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
});

// ── Completion history ───────────────────────────────────────
router.get('/:id/history', (req, res) => {
  const db = getDB();
  const history = db.prepare(`
    SELECT tc.*, u.username as completed_by_name
    FROM task_completions tc
    LEFT JOIN users u ON tc.completed_by = u.id
    WHERE tc.task_id = ?
    ORDER BY tc.completed_at DESC
    LIMIT 100
  `).all(req.params.id);
  res.json(history);
});

// ── Edit a completion entry (for back-dating / correcting) ───
router.put('/:taskId/history/:completionId', (req, res) => {
  const { completed_at, notes, usage_value } = req.body;
  if (!completed_at) return res.status(400).json({ error: 'completed_at required' });

  const db = getDB();
  const entry = db.prepare('SELECT * FROM task_completions WHERE id = ? AND task_id = ?')
    .get(req.params.completionId, req.params.taskId);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE task_completions SET completed_at=?, notes=?, usage_value=? WHERE id=?
  `).run(new Date(completed_at).toISOString(),
         notes !== undefined ? notes : entry.notes,
         usage_value !== undefined ? usage_value : entry.usage_value,
         entry.id);

  resyncTask(db, parseInt(req.params.taskId));
  res.json(db.prepare('SELECT * FROM task_completions WHERE id = ?').get(entry.id));
});

// ── Delete a completion entry ────────────────────────────────
router.delete('/:taskId/history/:completionId', (req, res) => {
  const db = getDB();
  const entry = db.prepare('SELECT * FROM task_completions WHERE id = ? AND task_id = ?')
    .get(req.params.completionId, req.params.taskId);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM task_completions WHERE id = ?').run(entry.id);
  resyncTask(db, parseInt(req.params.taskId));
  res.json({ success: true });
});

module.exports = router;
