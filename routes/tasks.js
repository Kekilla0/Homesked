const express = require('express');
const { getDB } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Calculate next due date based on frequency
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

router.get('/', (req, res) => {
  const { equipment_id } = req.query;
  if (!equipment_id) return res.status(400).json({ error: 'equipment_id required' });
  const db = getDB();
  const tasks = db.prepare(`
    SELECT t.*,
      u.username as created_by_name,
      CASE
        WHEN t.next_due_at < datetime('now') THEN 'overdue'
        WHEN t.next_due_at <= datetime('now', '+7 days') THEN 'due_soon'
        ELSE 'ok'
      END as status
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.equipment_id = ?
    ORDER BY t.next_due_at ASC
  `).all(equipment_id);
  res.json(tasks);
});

router.post('/', (req, res) => {
  const { equipment_id, name, description, frequency_value, frequency_unit } = req.body;
  if (!equipment_id || !name) return res.status(400).json({ error: 'equipment_id and name required' });

  const fVal = parseInt(frequency_value) || 1;
  const fUnit = frequency_unit || 'month';
  const nextDue = calcNextDue(new Date().toISOString(), fVal, fUnit);

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO tasks (equipment_id, name, description, frequency_value, frequency_unit, next_due_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(equipment_id, name, description || null, fVal, fUnit, nextDue, req.user.id);

  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

router.put('/:id', (req, res) => {
  const { name, description, frequency_value, frequency_unit } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const db = getDB();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fVal = parseInt(frequency_value) || 1;
  const fUnit = frequency_unit || 'month';

  // Recalculate next_due from last_completed (or now if never completed)
  const base = existing.last_completed_at || existing.created_at;
  const nextDue = calcNextDue(base, fVal, fUnit);

  db.prepare(`
    UPDATE tasks SET name = ?, description = ?, frequency_value = ?, frequency_unit = ?, next_due_at = ? WHERE id = ?
  `).run(name, description || null, fVal, fUnit, nextDue, req.params.id);

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Mark a task as complete
router.post('/:id/complete', (req, res) => {
  const { notes } = req.body;
  const db = getDB();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  const nextDue = calcNextDue(now, task.frequency_value, task.frequency_unit);

  db.prepare(`
    UPDATE tasks SET last_completed_at = ?, next_due_at = ? WHERE id = ?
  `).run(now, nextDue, task.id);

  db.prepare(`
    INSERT INTO task_completions (task_id, completed_by, completed_at, notes) VALUES (?, ?, ?, ?)
  `).run(task.id, req.user.id, now, notes || null);

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
});

// Get completion history for a task
router.get('/:id/history', (req, res) => {
  const db = getDB();
  const history = db.prepare(`
    SELECT tc.*, u.username as completed_by_name
    FROM task_completions tc
    LEFT JOIN users u ON tc.completed_by = u.id
    WHERE tc.task_id = ?
    ORDER BY tc.completed_at DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(history);
});

module.exports = router;
