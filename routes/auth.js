const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Register — first user becomes admin automatically
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const db = getDB();
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const role = userCount === 0 ? 'admin' : 'member';
  const hash = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(username, email || null, hash, role);

    const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
    throw err;
  }
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// List users (admin only, useful for the family overview)
router.get('/users', authenticate, (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

module.exports = router;
