const express = require('express');
const router  = express.Router();
const { dbHelpers, xpForLevel } = require('../database');

// POST /api/users/auth  — called on mini app open
router.post('/auth', (req, res) => {
  const { tg_id, username, first_name, last_name, photo_url } = req.body;
  if (!tg_id || !first_name) return res.status(400).json({ error: 'Missing required fields' });

  const user = dbHelpers.upsertUser({ id: tg_id, username, first_name, last_name, photo_url });
  const stats = dbHelpers.getAllStats(user.id);

  res.json({ user, stats });
});

// GET /api/users/:id/stats
router.get('/:id/stats', (req, res) => {
  const userId = parseInt(req.params.id);
  const stats  = dbHelpers.getAllStats(userId);

  const enriched = stats.map(s => ({
    ...s,
    xpNeeded: xpForLevel(s.level),
    progress: s.xp / xpForLevel(s.level),
  }));

  res.json(enriched);
});

// GET /api/users/:id/profile
router.get('/:id/profile', (req, res) => {
  const user = dbHelpers.getUserById(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });

  const stats = dbHelpers.getAllStats(user.id).map(s => ({
    ...s,
    xpNeeded: xpForLevel(s.level),
    progress: s.xp / xpForLevel(s.level),
  }));

  res.json({ user, stats });
});

// GET /api/users/search?q=…&excludeId=…
router.get('/search', (req, res) => {
  const { q, excludeId } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const results = dbHelpers.searchUsers(q, parseInt(excludeId) || 0);
  res.json(results);
});

// GET /api/users/leaderboard/:gameType
router.get('/leaderboard/:gameType', (req, res) => {
  const board = dbHelpers.getLeaderboard(req.params.gameType);
  res.json(board);
});

module.exports = router;
