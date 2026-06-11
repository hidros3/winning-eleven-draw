const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./data.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    fixture_id INTEGER PRIMARY KEY,
    home TEXT,
    away TEXT
  )`);
});

app.get('/api/state', (req, res) => {
  db.get("SELECT value FROM config WHERE key = 'assignments'", [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const assignments = (row && row.value) ? JSON.parse(row.value) : {};
    const drawn = Object.keys(assignments).length > 0;

    db.all("SELECT fixture_id, home, away FROM scores", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const scores = {};
      (rows || []).forEach(r => {
        scores[r.fixture_id] = { home: r.home || '', away: r.away || '' };
      });
      res.json({ drawn, assignments, scores });
    });
  });
});

app.post('/api/draw', (req, res) => {
  const { assignments } = req.body;
  if (!assignments || typeof assignments !== 'object') {
    return res.status(400).json({ error: 'invalid assignments' });
  }
  db.run("INSERT OR REPLACE INTO config (key, value) VALUES ('assignments', ?)",
    [JSON.stringify(assignments)], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
});

app.post('/api/score/:fixtureId', (req, res) => {
  const fixtureId = parseInt(req.params.fixtureId, 10);
  const { home, away } = req.body;
  db.run("INSERT OR REPLACE INTO scores (fixture_id, home, away) VALUES (?, ?, ?)",
    [fixtureId, home !== '' ? home : null, away !== '' ? away : null], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
});

app.post('/api/reset', (req, res) => {
  db.run("DELETE FROM config WHERE key = 'assignments'", [], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run("DELETE FROM scores", [], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
