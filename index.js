// backend/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();

app.use(cors());
app.use(express.json());

const db = new Database('data.db');

// Create the habits table if it does not already exist.
db.prepare(`
CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
)
`).run();

// Create the checkins table if it does not already exist.
db.prepare(`
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  UNIQUE(habit_id, date)
)
`).run();

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// Count consecutive daily check-ins, starting from today if present,
// otherwise yesterday if today has not been checked in yet.
function calculateStreak(habitId) {
  const rows = db.prepare(
    `SELECT date FROM checkins
     WHERE habit_id = ?
     ORDER BY date DESC`
  ).all(habitId);

  const dates = new Set(rows.map(r => r.date));

  const today = new Date();
  const todayStr = formatDate(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  let current;

  if (dates.has(todayStr)) {
    current = new Date(today);
  } else if (dates.has(yesterdayStr)) {
    current = new Date(yesterday);
  } else {
    return 0;
  }

  let streak = 0;

  while (true) {
    const d = formatDate(current);

    if (!dates.has(d)) {
      break;
    }

    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

// Create a new habit.
app.post('/habits', (req, res) => {
  const name = (req.body.name || '').trim();

  if (!name) {
    return res.status(400).json({
      error: 'name is required'
    });
  }

  const created_at = new Date().toISOString();

  const result = db.prepare(
    `INSERT INTO habits (name, created_at)
     VALUES (?, ?)`
  ).run(name, created_at);

  const habit = db.prepare(
    `SELECT * FROM habits WHERE id = ?`
  ).get(result.lastInsertRowid);

  res.status(201).json({
    ...habit,
    streak: 0
  });
});

// List all habits with streaks.
app.get('/habits', (req, res) => {
  const habits = db.prepare(
    `SELECT *
     FROM habits
     ORDER BY created_at ASC`
  ).all();

  res.json(
    habits.map(h => ({
      ...h,
      streak: calculateStreak(h.id)
    }))
  );
});

// Record a habit check-in.
app.post('/habits/:id/checkin', (req, res) => {
  const id = Number(req.params.id);

  const habit = db.prepare(
    `SELECT * FROM habits WHERE id = ?`
  ).get(id);

  if (!habit) {
    return res.status(404).json({
      error: 'Habit not found'
    });
  }

  const date =
    req.body.date ||
    formatDate(new Date());

  const checked_at = new Date().toISOString();

  try {
    const result = db.prepare(
      `INSERT INTO checkins
      (habit_id, date, checked_at)
      VALUES (?, ?, ?)`
    ).run(id, date, checked_at);

    const checkin = db.prepare(
      `SELECT *
       FROM checkins
       WHERE id = ?`
    ).get(result.lastInsertRowid);

    res.status(201).json({
      ...checkin,
      streak: calculateStreak(id)
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'Already checked in for this date'
      });
    }

    throw err;
  }
});

// Return all check-in dates for a habit.
app.get('/habits/:id/checkins', (req, res) => {
  const id = Number(req.params.id);

  const habit = db.prepare(
    `SELECT * FROM habits WHERE id=?`
  ).get(id);

  if (!habit) {
    return res.status(404).json({
      error: 'Habit not found'
    });
  }

  const rows = db.prepare(
    `SELECT date
     FROM checkins
     WHERE habit_id=?
     ORDER BY date DESC`
  ).all(id);

  res.json(rows.map(r => r.date));
});

// Remove one specific check-in.
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const id = Number(req.params.id);
  const date = req.params.date;

  db.prepare(
    `DELETE FROM checkins
     WHERE habit_id=? AND date=?`
  ).run(id, date);

  res.json({
    message: 'Checkin removed'
  });
});

// Delete a habit and all of its check-ins.
app.delete('/habits/:id', (req, res) => {
  const id = Number(req.params.id);

  db.prepare(
    `DELETE FROM checkins
     WHERE habit_id=?`
  ).run(id);

  db.prepare(
    `DELETE FROM habits
     WHERE id=?`
  ).run(id);

  res.json({
    message: `Habit ${id} and its checkins deleted`
  });
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});