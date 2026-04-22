const { v4: uuidv4 } = require('uuid');
const { dbHelpers } = require('../database');

// XP rewards
const XP_WIN  = 50;
const XP_DRAW = 15;
const XP_LOSS = 5;

// In-memory active sessions map: sessionId -> { io room, game state }
const activeSessions = new Map();

function setupGameSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ── JOIN / CREATE SESSION ─────────────────────────────────────────────────

    socket.on('join_session', ({ sessionId, userId }) => {
      const session = dbHelpers.getSession(sessionId);
      if (!session) return socket.emit('error', { message: 'Session not found' });

      socket.join(sessionId);
      socket.data.userId    = parseInt(userId);
      socket.data.sessionId = sessionId;

      if (session.status === 'waiting' && session.player1_id !== parseInt(userId)) {
        // Second player joins
        dbHelpers.joinSession(sessionId, parseInt(userId));
        const updated = dbHelpers.getSession(sessionId);
        const p1 = dbHelpers.getUserById(updated.player1_id);
        const p2 = dbHelpers.getUserById(updated.player2_id);

        io.to(sessionId).emit('session_start', {
          session: updated,
          players: { white: p1, black: p2 },
        });
      } else {
        // Rejoin / creator waiting
        const updated = dbHelpers.getSession(sessionId);
        socket.emit('session_joined', { session: updated });
      }
    });

    // ── CREATE AND AUTO-JOIN SESSION ─────────────────────────────────────────
    socket.on('create_session', ({ gameType, userId }) => {
      const id = uuidv4();
      dbHelpers.createSession(id, gameType, parseInt(userId));
      socket.join(id);
      socket.data.userId    = parseInt(userId);
      socket.data.sessionId = id;
      socket.emit('session_created', { sessionId: id });
    });

    // ── GAME MOVE ─────────────────────────────────────────────────────────────
    socket.on('game_move', ({ sessionId, move, state }) => {
      dbHelpers.updateSessionState(sessionId, state);
      socket.to(sessionId).emit('opponent_move', { move, state });
    });

    // ── GAME OVER ─────────────────────────────────────────────────────────────
    socket.on('game_over', ({ sessionId, winnerId, result, gameType }) => {
      const session = dbHelpers.getSession(sessionId);
      if (!session || session.status === 'finished') return;

      dbHelpers.endSession(sessionId, winnerId, result);

      const p1 = session.player1_id;
      const p2 = session.player2_id;

      if (result === 'win' && winnerId) {
        const loserId = winnerId === p1 ? p2 : p1;
        dbHelpers.awardXp(winnerId, gameType, XP_WIN,  'win');
        if (loserId) dbHelpers.awardXp(loserId,  gameType, XP_LOSS, 'loss');
      } else if (result === 'draw') {
        dbHelpers.awardXp(p1, gameType, XP_DRAW, 'draw');
        if (p2) dbHelpers.awardXp(p2, gameType, XP_DRAW, 'draw');
      }

      io.to(sessionId).emit('game_finished', { winnerId, result });
    });

    // ── DRAW OFFER ────────────────────────────────────────────────────────────
    socket.on('offer_draw', ({ sessionId }) => {
      socket.to(sessionId).emit('draw_offered');
    });

    socket.on('accept_draw', ({ sessionId, gameType }) => {
      const session = dbHelpers.getSession(sessionId);
      if (!session) return;
      io.to(sessionId).emit('game_finished', { winnerId: null, result: 'draw' });
      dbHelpers.endSession(sessionId, null, 'draw');
      dbHelpers.awardXp(session.player1_id, gameType, XP_DRAW, 'draw');
      if (session.player2_id) dbHelpers.awardXp(session.player2_id, gameType, XP_DRAW, 'draw');
    });

    // ── RESIGN ────────────────────────────────────────────────────────────────
    socket.on('resign', ({ sessionId, userId, gameType }) => {
      const session = dbHelpers.getSession(sessionId);
      if (!session) return;
      const winnerId = session.player1_id === parseInt(userId)
        ? session.player2_id
        : session.player1_id;
      dbHelpers.endSession(sessionId, winnerId, 'win');
      dbHelpers.awardXp(parseInt(userId), gameType, XP_LOSS, 'loss');
      if (winnerId) dbHelpers.awardXp(winnerId, gameType, XP_WIN, 'win');
      io.to(sessionId).emit('game_finished', { winnerId, result: 'resign' });
    });

    // ── CHAT ──────────────────────────────────────────────────────────────────
    socket.on('chat_message', ({ sessionId, userId, message }) => {
      if (!message || message.length > 200) return;
      const user = dbHelpers.getUserById(parseInt(userId));
      io.to(sessionId).emit('chat_message', {
        userId,
        name: user ? user.first_name : 'Player',
        message,
        ts: Date.now(),
      });
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const { sessionId, userId } = socket.data;
      if (sessionId && userId) {
        socket.to(sessionId).emit('opponent_disconnected');
      }
    });
  });
}

module.exports = { setupGameSocket };
