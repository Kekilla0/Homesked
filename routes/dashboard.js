const express = require('express');
const { getDB } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDB();

  // Time-based overdue (equipment tasks)
  const overdueTime = db.prepare(`
    SELECT t.id, t.name as task_name, t.next_due_at, t.frequency_value, t.frequency_unit,
      t.trigger_type,
      e.name as equipment_name, e.id as equipment_id,
      r.name as room_name, r.id as room_id,
      h.name as home_name, h.id as home_id
    FROM tasks t
    JOIN equipment e ON t.equipment_id = e.id
    JOIN rooms r ON e.room_id = r.id
    JOIN homes h ON r.home_id = h.id
    WHERE t.trigger_type = 'time' AND t.next_due_at < datetime('now')
    ORDER BY t.next_due_at ASC
    LIMIT 50
  `).all();

  // Usage-based overdue (compare next_due_usage against equipment.current_usage)
  const overdueUsage = db.prepare(`
    SELECT t.id, t.name as task_name, t.next_due_usage, t.usage_unit, t.usage_interval,
      t.trigger_type, t.last_usage_value,
      e.name as equipment_name, e.id as equipment_id, e.current_usage,
      r.name as room_name, r.id as room_id,
      h.name as home_name, h.id as home_id
    FROM tasks t
    JOIN equipment e ON t.equipment_id = e.id
    JOIN rooms r ON e.room_id = r.id
    JOIN homes h ON r.home_id = h.id
    WHERE t.trigger_type = 'usage'
      AND t.next_due_usage IS NOT NULL
      AND e.current_usage IS NOT NULL
      AND e.current_usage >= t.next_due_usage
    LIMIT 50
  `).all();

  // Room-level tasks overdue
  const overdueRoom = db.prepare(`
    SELECT t.id, t.name as task_name, t.next_due_at, t.frequency_value, t.frequency_unit,
      t.trigger_type,
      r.name as room_name, r.id as room_id,
      h.name as home_name, h.id as home_id,
      NULL as equipment_name, NULL as equipment_id
    FROM tasks t
    JOIN rooms r ON t.room_id = r.id
    JOIN homes h ON r.home_id = h.id
    WHERE t.equipment_id IS NULL
      AND t.trigger_type = 'time'
      AND t.next_due_at < datetime('now')
    ORDER BY t.next_due_at ASC
    LIMIT 50
  `).all();

  const overdue = [...overdueTime, ...overdueRoom, ...overdueUsage];

  // Upcoming time-based (equipment + room tasks)
  const upcoming = db.prepare(`
    SELECT t.id, t.name as task_name, t.next_due_at, t.frequency_value, t.frequency_unit,
      t.trigger_type,
      COALESCE(e.name, '') as equipment_name,
      e.id as equipment_id,
      r.name as room_name, r.id as room_id,
      h.name as home_name, h.id as home_id
    FROM tasks t
    LEFT JOIN equipment e ON t.equipment_id = e.id
    JOIN rooms r ON COALESCE(e.room_id, t.room_id) = r.id
    JOIN homes h ON r.home_id = h.id
    WHERE t.trigger_type = 'time'
      AND t.next_due_at BETWEEN datetime('now') AND datetime('now', '+14 days')
    ORDER BY t.next_due_at ASC
    LIMIT 50
  `).all();

  const usageOverdueCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks t
    JOIN equipment e ON t.equipment_id = e.id
    WHERE t.trigger_type = 'usage'
      AND t.next_due_usage IS NOT NULL
      AND e.current_usage IS NOT NULL
      AND e.current_usage >= t.next_due_usage
  `).get().cnt;

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM homes) as home_count,
      (SELECT COUNT(*) FROM rooms) as room_count,
      (SELECT COUNT(*) FROM equipment) as equipment_count,
      (SELECT COUNT(*) FROM tasks) as task_count,
      (SELECT COUNT(*) FROM tasks
        WHERE trigger_type='time' AND next_due_at < datetime('now')) as overdue_time_count,
      (SELECT COUNT(*) FROM tasks
        WHERE trigger_type='time'
        AND next_due_at BETWEEN datetime('now') AND datetime('now', '+14 days')) as upcoming_count,
      (SELECT COUNT(*) FROM task_completions
        WHERE completed_at >= datetime('now', '-30 days')) as completions_30d
  `).get();

  stats.overdue_count = stats.overdue_time_count + usageOverdueCount;

  const recentActivity = db.prepare(`
    SELECT tc.completed_at, tc.notes, tc.usage_value,
      u.username as completed_by_name,
      t.name as task_name, t.usage_unit,
      COALESCE(e.name, '') as equipment_name,
      r.name as room_name,
      h.name as home_name
    FROM task_completions tc
    JOIN tasks t ON tc.task_id = t.id
    LEFT JOIN equipment e ON t.equipment_id = e.id
    JOIN rooms r ON COALESCE(e.room_id, t.room_id) = r.id
    JOIN homes h ON r.home_id = h.id
    LEFT JOIN users u ON tc.completed_by = u.id
    ORDER BY tc.completed_at DESC
    LIMIT 10
  `).all();

  res.json({ overdue, upcoming, stats, recentActivity });
});

module.exports = router;
