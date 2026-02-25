const express = require('express');
const { getDB } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { home_id } = req.query;
  if (!home_id) return res.status(400).json({ error: 'home_id required' });
  const db = getDB();
  const rooms = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM equipment WHERE room_id = r.id) as equipment_count,
      (SELECT COUNT(*) FROM tasks WHERE room_id = r.id AND equipment_id IS NULL) as room_task_count,
      (SELECT COUNT(*) FROM tasks
        WHERE room_id = r.id AND equipment_id IS NULL
        AND trigger_type = 'time' AND next_due_at < datetime('now')) as room_task_overdue
    FROM rooms r
    WHERE r.home_id = ?
    ORDER BY r.name
  `).all(home_id);
  res.json(rooms);
});

router.post('/', (req, res) => {
  const { home_id, name, description } = req.body;
  if (!home_id || !name) return res.status(400).json({ error: 'home_id and name required' });
  const db = getDB();
  const result = db.prepare('INSERT INTO rooms (home_id, name, description) VALUES (?, ?, ?)')
    .run(home_id, name, description || null);
  res.status(201).json(db.prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const room = getDB().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });
  res.json(room);
});

router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDB();
  db.prepare('UPDATE rooms SET name = ?, description = ? WHERE id = ?')
    .run(name, description || null, req.params.id);
  res.json(db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
