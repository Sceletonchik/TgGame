const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { dbHelpers } = require('../database');

const VALID_GAMES = ['chess','checkers','battleship','gomoku','connect4'];

// GET /api/games/sessions/:gameType  — lobby list
router.get('/sessions/:gameType', (req, res) => {
  if (!VALID_GAMES.includes(req.params.gameType))
    return res.status(400).json({ error: 'Invalid game type' });

  const sessions = dbHelpers.getActiveSessions(req.params.gameType);
  res.json(sessions);
});

// POST /api/games/sessions  — create session
router.post('/sessions', (req, res) => {
  const { gameType, userId } = req.body;
  if (!VALID_GAMES.includes(gameType))
    return res.status(400).json({ error: 'Invalid game type' });

  const id = uuidv4();
  dbHelpers.createSession(id, gameType, parseInt(userId));
  const session = dbHelpers.getSession(id);
  res.json(session);
});

// GET /api/games/sessions/single/:id
router.get('/sessions/single/:id', (req, res) => {
  const session = dbHelpers.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

// GET /api/games/leaderboard/:gameType
router.get('/leaderboard/:gameType', (req, res) => {
  if (!VALID_GAMES.includes(req.params.gameType))
    return res.status(400).json({ error: 'Invalid game type' });
  const board = dbHelpers.getLeaderboard(req.params.gameType);
  res.json(board);
});

module.exports = router;
