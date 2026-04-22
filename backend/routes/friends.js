const express = require('express');
const router  = express.Router();
const { dbHelpers } = require('../database');

// GET /api/friends/:userId
router.get('/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const friends  = dbHelpers.getFriends(userId);
  const incoming = dbHelpers.getPendingRequests(userId);
  const outgoing = dbHelpers.getSentRequests(userId);
  res.json({ friends, incoming, outgoing });
});

// POST /api/friends/request
router.post('/request', (req, res) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId || userId === friendId)
    return res.status(400).json({ error: 'Invalid request' });

  const result = dbHelpers.sendFriendRequest(parseInt(userId), parseInt(friendId));
  res.json(result);
});

// POST /api/friends/accept
router.post('/accept', (req, res) => {
  const { userId, requesterId } = req.body;
  dbHelpers.acceptFriendRequest(parseInt(userId), parseInt(requesterId));
  res.json({ ok: true });
});

// POST /api/friends/reject
router.post('/reject', (req, res) => {
  const { userId, requesterId } = req.body;
  dbHelpers.rejectFriendRequest(parseInt(userId), parseInt(requesterId));
  res.json({ ok: true });
});

// DELETE /api/friends/:userId/:friendId
router.delete('/:userId/:friendId', (req, res) => {
  dbHelpers.removeFriend(parseInt(req.params.userId), parseInt(req.params.friendId));
  res.json({ ok: true });
});

module.exports = router;
