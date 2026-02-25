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
      (SELECT COUNT(*) FROM tasks WHERE equipment_id = e.id AND next_due_at < datetime('now')) as overdue_count,
      (SELECT COUNT(*) FROM tasks WHERE equipment_id = e.id AND next_due_at BETWEEN datetime('now') AND datetime('now', '+7 days')) as due_soon_count
    FROM equipment e
    WHERE e.room_id = ?
    ORDER BY e.name
  `).all(room_id);
  res.json(equipment);
});

router.post('/', (req, res) => {
  const { room_id, name, description, make, model, serial_number, notes } = req.body;
  if (!room_id || !name) return res.status(400).json({ error: 'room_id and name required' });
  const db = getDB();
  const result = db.prepare(
    'INSERT INTO equipment (room_id, name, description, make, model, serial_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(room_id, name, description || null, make || null, model || null, serial_number || null, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/:id', (req, res) => {
  const { name, description, make, model, serial_number, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDB();
  db.prepare(
    'UPDATE equipment SET name = ?, description = ?, make = ?, model = ?, serial_number = ?, notes = ? WHERE id = ?'
  ).run(name, description || null, make || null, model || null, serial_number || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
