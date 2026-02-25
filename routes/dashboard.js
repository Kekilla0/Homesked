const express = require('express');
const { getDB } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDB();

  const overdue = db.prepare(`
    SELECT t.id, t.name as task_name, t.next_due_at, t.frequency_value, t.frequency_unit,
      e.name as equipment_name, e.id as equipment_id,
      r.name as room_name, r.id as room_id,
      h.name as home_name, h.id as home_id
    FROM tasks t
    JOIN equipment e ON t.equipment_id = e.id
    JOIN rooms r ON e.room_id = r.id
    JOIN homes h ON r.home_id = h.id
    WHERE t.next_due_at < datetime('now')
    ORDER BY t.next_due_at ASC
    LIMIT 50
  `).all();

  const upcoming = db.prepare(`
    SELECT t.id, t.name as task_name, t.next_due_at, t.frequency_value, t.frequency_unit,
      e.name as equipment_name, e.id as equipment_id,
      r.name as room_name, r.id as room_id,
      h.name as home_name, h.id as home_id
    FROM tasks t
    JOIN equipment e ON t.equipment_id = e.id
    JOIN rooms r ON e.room_id = r.id
    JOIN homes h ON r.home_id = h.id
    WHERE t.next_due_at BETWEEN datetime('now') AND datetime('now', '+14 days')
    ORDER BY t.next_due_at ASC
    LIMIT 50
  `).all();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM homes) as home_count,
      (SELECT COUNT(*) FROM rooms) as room_count,
      (SELECT COUNT(*) FROM equipment) as equipment_count,
      (SELECT COUNT(*) FROM tasks) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE next_due_at < datetime('now')) as overdue_count,
      (SELECT COUNT(*) FROM tasks WHERE next_due_at BETWEEN datetime('now') AND datetime('now', '+14 days')) as upcoming_count,
      (SELECT COUNT(*) FROM task_completions WHERE completed_at >= datetime('now', '-30 days')) as completions_30d
  `).get();

  const recentActivity = db.prepare(`
    SELECT tc.completed_at, tc.notes,
      u.username as completed_by_name,
      t.name as task_name,
      e.name as equipment_name,
      r.name as room_name,
      h.name as home_name
    FROM task_completions tc
    JOIN tasks t ON tc.task_id = t.id
    JOIN equipment e ON t.equipment_id = e.id
    JOIN rooms r ON e.room_id = r.id
    JOIN homes h ON r.home_id = h.id
    LEFT JOIN users u ON tc.completed_by = u.id
    ORDER BY tc.completed_at DESC
    LIMIT 10
  `).all();

  res.json({ overdue, upcoming, stats, recentActivity });
});

module.exports = router;
