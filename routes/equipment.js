const express = require('express');
const { getDB } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { room_id } = req.query;
  if (!room_id) return res.status(400).json({ error: 'room_id required' });
  const db = getDB();
  const equipment = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM tasks WHERE equipment_id = e.id) as task_count,
      (SELECT COUNT(*) FROM tasks
        WHERE equipment_id = e.id
        AND trigger_type = 'time'
        AND next_due_at < datetime('now')) as overdue_count,
      (SELECT COUNT(*) FROM tasks
        WHERE equipment_id = e.id
        AND trigger_type = 'time'
        AND next_due_at BETWEEN datetime('now') AND datetime('now', '+7 days')) as due_soon_count
    FROM equipment e
    WHERE e.room_id = ?
    ORDER BY e.name
  `).all(room_id);

  // For equipment with usage tracking, calculate usage-based overdue
  for (const eq of equipment) {
    if (eq.current_usage !== null && eq.current_usage !== undefined) {
      const usageOverdue = db.prepare(`
        SELECT COUNT(*) as cnt FROM tasks
        WHERE equipment_id = ? AND trigger_type = 'usage'
        AND next_due_usage IS NOT NULL AND next_due_usage <= ?
      `).get(eq.id, eq.current_usage);
      eq.overdue_count = (eq.overdue_count || 0) + (usageOverdue.cnt || 0);
    }
  }

  res.json(equipment);
});

router.post('/', (req, res) => {
  const { room_id, name, description, make, model, serial_number, notes,
          preset_type, current_usage, usage_unit } = req.body;
  if (!room_id || !name) return res.status(400).json({ error: 'room_id and name required' });
  const db = getDB();
  const result = db.prepare(`
    INSERT INTO equipment (room_id, name, description, make, model, serial_number, notes,
                           preset_type, current_usage, usage_unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(room_id, name, description||null, make||null, model||null,
         serial_number||null, notes||null, preset_type||null,
         current_usage !== undefined ? current_usage : null, usage_unit||null);
  res.status(201).json(db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const item = getDB().prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/:id', (req, res) => {
  const { name, description, make, model, serial_number, notes,
          preset_type, current_usage, usage_unit } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDB();
  db.prepare(`
    UPDATE equipment SET name=?, description=?, make=?, model=?, serial_number=?,
      notes=?, preset_type=?, current_usage=?, usage_unit=? WHERE id=?
  `).run(name, description||null, make||null, model||null, serial_number||null,
         notes||null, preset_type||null,
         current_usage !== undefined ? current_usage : null, usage_unit||null,
         req.params.id);
  res.json(db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id));
});

// PATCH just the usage reading — separate lightweight endpoint
router.patch('/:id/usage', (req, res) => {
  const { current_usage } = req.body;
  if (current_usage === undefined) return res.status(400).json({ error: 'current_usage required' });
  const db = getDB();
  db.prepare('UPDATE equipment SET current_usage = ? WHERE id = ?').run(current_usage, req.params.id);
  res.json(db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
