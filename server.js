const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const db = new Database(process.env.DATABASE_PATH || './queue.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_number TEXT NOT NULL,
    site_id INTEGER,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  );

  CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sequence INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_name TEXT NOT NULL,
    site_id INTEGER,
    room_id INTEGER,
    step_id INTEGER,
    status TEXT DEFAULT 'waiting',
    call_count INTEGER DEFAULT 0,
    called_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (step_id) REFERENCES steps(id)
  );
`);

// Migration: Add call_count column if it doesn't exist
try {
  db.prepare('ALTER TABLE queue ADD COLUMN call_count INTEGER DEFAULT 0').run();
} catch (err) {
  // Column already exists, ignore
}

// Migration: Add status_changed_at column if it doesn't exist
try {
  db.prepare('ALTER TABLE queue ADD COLUMN status_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
} catch (err) {
  // Column already exists, ignore
}

// Seed default data if empty
const siteCount = db.prepare('SELECT COUNT(*) as count FROM sites').get();
if (siteCount.count === 0) {
  const insertSite = db.prepare('INSERT INTO sites (name) VALUES (?)');
  ['Clark', 'Makati', 'Cebu', 'Davao', 'Iloilo'].forEach(site => insertSite.run(site));

  const insertStep = db.prepare('INSERT INTO steps (name, sequence) VALUES (?, ?)');
  [
    ['Initial Interview', 1],
    ['Skills Assessment', 2],
    ['Typing Test', 3],
    ['Final Interview', 4],
    ['Job Offer', 5],
    ['Requirements Submission', 6]
  ].forEach(([name, seq]) => insertStep.run(name, seq));

  const insertRoom = db.prepare('INSERT INTO rooms (room_number, site_id, description) VALUES (?, ?, ?)');
  const sites = db.prepare('SELECT id FROM sites').all();
  sites.forEach(site => {
    ['101', '102', '103', '104', '201', '202'].forEach(room => {
      insertRoom.run(room, site.id, `Interview Room ${room}`);
    });
  });
}

// ============ API ROUTES ============

// ----- SITES -----
app.get('/api/sites', (req, res) => {
  const sites = db.prepare('SELECT * FROM sites WHERE is_active = 1 ORDER BY name').all();
  res.json(sites);
});

app.get('/api/sites/all', (req, res) => {
  const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
  res.json(sites);
});

app.post('/api/sites', (req, res) => {
  const { name } = req.body;
  try {
    const result = db.prepare('INSERT INTO sites (name) VALUES (?)').run(name);
    res.json({ id: result.lastInsertRowid, name, is_active: 1 });
  } catch (err) {
    res.status(400).json({ error: 'Site already exists or invalid data' });
  }
});

app.put('/api/sites/:id', (req, res) => {
  const { name, is_active } = req.body;
  db.prepare('UPDATE sites SET name = ?, is_active = ? WHERE id = ?').run(name, is_active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/sites/:id', (req, res) => {
  db.prepare('UPDATE sites SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ----- ROOMS -----
app.get('/api/rooms', (req, res) => {
  const { site_id } = req.query;
  let query = `
    SELECT r.*, s.name as site_name
    FROM rooms r
    LEFT JOIN sites s ON r.site_id = s.id
    WHERE r.is_active = 1
  `;
  let params = [];
  if (site_id) {
    query += ` AND r.site_id = ?`;
    params.push(site_id);
  }
  query += ' ORDER BY r.site_id, r.room_number';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/rooms/all', (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, s.name as site_name 
    FROM rooms r 
    LEFT JOIN sites s ON r.site_id = s.id 
    ORDER BY s.name, r.room_number
  `).all();
  res.json(rooms);
});

app.post('/api/rooms', (req, res) => {
  const { room_number, site_id, description } = req.body;
  try {
    const result = db.prepare('INSERT INTO rooms (room_number, site_id, description) VALUES (?, ?, ?)').run(room_number, site_id, description);
    res.json({ id: result.lastInsertRowid, room_number, site_id, description, is_active: 1 });
  } catch (err) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

app.put('/api/rooms/:id', (req, res) => {
  const { room_number, site_id, description, is_active } = req.body;
  db.prepare('UPDATE rooms SET room_number = ?, site_id = ?, description = ?, is_active = ? WHERE id = ?')
    .run(room_number, site_id, description, is_active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/rooms/:id', (req, res) => {
  db.prepare('UPDATE rooms SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ----- STEPS -----
app.get('/api/steps', (req, res) => {
  const steps = db.prepare('SELECT * FROM steps WHERE is_active = 1 ORDER BY sequence').all();
  res.json(steps);
});

app.get('/api/steps/all', (req, res) => {
  const steps = db.prepare('SELECT * FROM steps ORDER BY sequence').all();
  res.json(steps);
});

app.post('/api/steps', (req, res) => {
  const { name, sequence } = req.body;
  try {
    const result = db.prepare('INSERT INTO steps (name, sequence) VALUES (?, ?)').run(name, sequence || 0);
    res.json({ id: result.lastInsertRowid, name, sequence, is_active: 1 });
  } catch (err) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

app.put('/api/steps/:id', (req, res) => {
  const { name, sequence, is_active } = req.body;
  db.prepare('UPDATE steps SET name = ?, sequence = ?, is_active = ? WHERE id = ?')
    .run(name, sequence, is_active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/steps/:id', (req, res) => {
  db.prepare('UPDATE steps SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ----- QUEUE -----
app.get('/api/queue', (req, res) => {
  const { site_id, status } = req.query;
  let query = `
    SELECT
      q.*,
      s.name as site_name,
      r.room_number,
      st.name as step_name
    FROM queue q
    LEFT JOIN sites s ON q.site_id = s.id
    LEFT JOIN rooms r ON q.room_id = r.id
    LEFT JOIN steps st ON q.step_id = st.id
    WHERE q.status != 'completed'
  `;
  let params = [];
  if (site_id) {
    query += ` AND q.site_id = ?`;
    params.push(site_id);
  }
  if (status) {
    query += ` AND q.status = ?`;
    params.push(status);
  }
  query += ' ORDER BY q.status DESC, q.created_at ASC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/queue', (req, res) => {
  const { candidate_name, site_id, room_id, step_id, status } = req.body;
  try {
    const result = db.prepare('INSERT INTO queue (candidate_name, site_id, room_id, step_id, status) VALUES (?, ?, ?, ?, ?)')
      .run(candidate_name, site_id, room_id, step_id, status || 'waiting');
    
    const newEntry = db.prepare(`
      SELECT q.*, s.name as site_name, r.room_number, st.name as step_name
      FROM queue q
      LEFT JOIN sites s ON q.site_id = s.id
      LEFT JOIN rooms r ON q.room_id = r.id
      LEFT JOIN steps st ON q.step_id = st.id
      WHERE q.id = ?
    `).get(result.lastInsertRowid);
    
    res.json(newEntry);
  } catch (err) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

app.put('/api/queue/:id/call', (req, res) => {
  db.prepare('UPDATE queue SET status = ?, call_count = call_count + 1, called_at = CURRENT_TIMESTAMP, status_changed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('called', req.params.id);
  res.json({ success: true });
});

app.put('/api/queue/:id/complete', (req, res) => {
  db.prepare('UPDATE queue SET status = ?, completed_at = CURRENT_TIMESTAMP, status_changed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('completed', req.params.id);
  res.json({ success: true });
});

// Bulk move selected candidates to specific step and room
app.post('/api/queue/bulk-move', (req, res) => {
  const { candidate_ids, step_id, room_id, status } = req.body;

  if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
    return res.status(400).json({ error: 'Candidate IDs are required' });
  }

  if (!step_id) {
    return res.status(400).json({ error: 'Step ID is required' });
  }

  if (!room_id) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  const targetStatus = status || 'called';

  try {
    let updated = 0;
    // Only set call_count and called_at if status is 'called'
    const updateStmt = targetStatus === 'called'
      ? db.prepare('UPDATE queue SET step_id = ?, room_id = ?, status = ?, call_count = call_count + 1, called_at = CURRENT_TIMESTAMP, status_changed_at = CURRENT_TIMESTAMP WHERE id = ?')
      : db.prepare('UPDATE queue SET step_id = ?, room_id = ?, status = ?, status_changed_at = CURRENT_TIMESTAMP WHERE id = ?');

    candidate_ids.forEach(id => {
      try {
        updateStmt.run(step_id, room_id, targetStatus, id);
        updated++;
      } catch (err) {
        console.error(`Failed to update candidate ${id}:`, err);
      }
    });

    // Get updated candidates info for TTS
    const placeholders = candidate_ids.map(() => '?').join(',');
    const movedCandidates = db.prepare(`
      SELECT q.candidate_name, r.room_number, st.name as step_name
      FROM queue q
      LEFT JOIN rooms r ON q.room_id = r.id
      LEFT JOIN steps st ON q.step_id = st.id
      WHERE q.id IN (${placeholders})
    `).all(...candidate_ids);

    res.json({
      message: `Successfully moved ${updated} candidate(s) to selected step`,
      updated,
      candidates: movedCandidates
    });
  } catch (err) {
    console.error('Bulk move error:', err);
    res.status(500).json({ error: 'Failed to move candidates' });
  }
});

app.put('/api/queue/:id/name', (req, res) => {
  const { candidate_name } = req.body;
  if (!candidate_name) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE queue SET candidate_name = ? WHERE id = ?').run(candidate_name, req.params.id);
  res.json({ success: true });
});

app.delete('/api/queue/:id', (req, res) => {
  db.prepare('DELETE FROM queue WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Clear old queue entries (older than 24 hours)
app.post('/api/queue/cleanup', (req, res) => {
  const result = db.prepare("DELETE FROM queue WHERE created_at < datetime('now', '-1 day')").run();
  res.json({ deleted: result.changes });
});

// Serve static files in production
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Auto-cleanup: remove completed entries older than 24 hours every hour
setInterval(() => {
  try {
    const result = db.prepare("DELETE FROM queue WHERE created_at < datetime('now', '-1 day')").run();
    if (result.changes > 0) console.log(`Auto-cleanup: removed ${result.changes} old queue entries`);
  } catch (err) {
    console.error('Auto-cleanup error:', err);
  }
}, 60 * 60 * 1000); // Every hour

app.listen(PORT, () => {
  console.log(`🚀 VXI Queue System running on port ${PORT}`);
});
