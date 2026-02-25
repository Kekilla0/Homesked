const express = require('express');
const { getDB } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDB();
  const homes = db.prepare(`
    SELECT h.*, u.username as created_by_name,
      (SELECT COUNT(*) FROM rooms WHERE home_id = h.id) as room_count
    FROM homes h
    LEFT JOIN users u ON h.created_by = u.id
    ORDER BY h.created_at DESC
  `).all();
  res.json(homes);
});

router.post('/', (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDB();
  const result = db.prepare('INSERT INTO homes (name, address, created_by) VALUES (?, ?, ?)').run(name, address || null, req.user.id);
  const home = db.prepare('SELECT * FROM homes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(home);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const home = db.prepare('SELECT * FROM homes WHERE id = ?').get(req.params.id);
  if (!home) return res.status(404).json({ error: 'Not found' });
  res.json(home);
});

router.put('/:id', (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDB();
  db.prepare('UPDATE homes SET name = ?, address = ? WHERE id = ?').run(name, address || null, req.params.id);
  const home = db.prepare('SELECT * FROM homes WHERE id = ?').get(req.params.id);
  res.json(home);
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM homes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
