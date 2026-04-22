const { LowSync } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');
const path = require('path');

// ── DB setup ─────────────────────────────────────────────────────────────────
const adapter = new JSONFileSync(path.join(__dirname, 'game.db.json'));
const db = new LowSync(adapter, {
  users: [],
  player_stats: [],
  friends: [],
  game_sessions: [],
});
db.read();

// Ensure all collections exist
db.data.users         = db.data.users         || [];
db.data.player_stats  = db.data.player_stats  || [];
db.data.friends       = db.data.friends       || [];
db.data.game_sessions = db.data.game_sessions || [];
db.write();

// Auto-increment helper
const nextId = (arr) => arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;

// XP needed to reach next level
const xpForLevel = (level) => Math.floor(100 * Math.pow(1.4, level - 1));

// ── Helpers ───────────────────────────────────────────────────────────────────
const dbHelpers = {

  // ── Users ───────────────────────────────────────────────────────────────────
  upsertUser(tgUser) {
    db.read();
    let user = db.data.users.find(u => u.tg_id === tgUser.id);
    const now = new Date().toISOString();
    if (user) {
      user.username   = tgUser.username   || user.username;
      user.first_name = tgUser.first_name;
      user.last_name  = tgUser.last_name  || user.last_name;
      user.photo_url  = tgUser.photo_url  || user.photo_url;
      user.last_seen  = now;
    } else {
      user = {
        id:         nextId(db.data.users),
        tg_id:      tgUser.id,
        username:   tgUser.username   || null,
        first_name: tgUser.first_name,
        last_name:  tgUser.last_name  || null,
        photo_url:  tgUser.photo_url  || null,
        created_at: now,
        last_seen:  now,
      };
      db.data.users.push(user);
    }
    db.write();
    return user;
  },

  getUserByTgId(tgId) {
    db.read();
    return db.data.users.find(u => u.tg_id === tgId) || null;
  },

  getUserById(id) {
    db.read();
    return db.data.users.find(u => u.id === id) || null;
  },

  // ── Player stats ─────────────────────────────────────────────────────────────
  ensureStats(userId, gameType) {
    db.read();
    let s = db.data.player_stats.find(s => s.user_id === userId && s.game_type === gameType);
    if (!s) {
      s = {
        id: nextId(db.data.player_stats),
        user_id: userId, game_type: gameType,
        wins: 0, losses: 0, draws: 0, xp: 0, level: 1,
      };
      db.data.player_stats.push(s);
      db.write();
    }
    return s;
  },

  getAllStats(userId) {
    db.read();
    return db.data.player_stats.filter(s => s.user_id === userId);
  },

  awardXp(userId, gameType, xpGain, result) {
    db.read();
    const s = this.ensureStats(userId, gameType);
    const i = db.data.player_stats.findIndex(x => x.id === s.id);
    const row = db.data.player_stats[i];

    if (result === 'win')  row.wins++;
    if (result === 'loss') row.losses++;
    if (result === 'draw') row.draws++;

    let newXp    = row.xp + xpGain;
    let newLevel = row.level;
    while (newXp >= xpForLevel(newLevel)) {
      newXp -= xpForLevel(newLevel);
      newLevel++;
    }
    row.xp    = newXp;
    row.level = newLevel;
    db.write();
    return { ...row, xpNeeded: xpForLevel(newLevel) };
  },

  // ── Friends ──────────────────────────────────────────────────────────────────
  sendFriendRequest(userId, friendId) {
    db.read();
    // Check mutual — auto-accept
    const reverse = db.data.friends.find(f => f.user_id === friendId && f.friend_id === userId && f.status === 'pending');
    if (reverse) {
      reverse.status = 'accepted';
      const fwd = db.data.friends.find(f => f.user_id === userId && f.friend_id === friendId);
      if (fwd) fwd.status = 'accepted';
      else db.data.friends.push({ id: nextId(db.data.friends), user_id: userId, friend_id: friendId, status: 'accepted', created_at: new Date().toISOString() });
      db.write();
      return { status: 'accepted' };
    }
    if (!db.data.friends.find(f => f.user_id === userId && f.friend_id === friendId)) {
      db.data.friends.push({ id: nextId(db.data.friends), user_id: userId, friend_id: friendId, status: 'pending', created_at: new Date().toISOString() });
      db.write();
    }
    return { status: 'pending' };
  },

  acceptFriendRequest(userId, requesterId) {
    db.read();
    const req = db.data.friends.find(f => f.user_id === requesterId && f.friend_id === userId);
    if (req) req.status = 'accepted';
    const already = db.data.friends.find(f => f.user_id === userId && f.friend_id === requesterId);
    if (already) already.status = 'accepted';
    else db.data.friends.push({ id: nextId(db.data.friends), user_id: userId, friend_id: requesterId, status: 'accepted', created_at: new Date().toISOString() });
    db.write();
  },

  rejectFriendRequest(userId, requesterId) {
    db.read();
    db.data.friends = db.data.friends.filter(f => !(f.user_id === requesterId && f.friend_id === userId));
    db.write();
  },

  removeFriend(userId, friendId) {
    db.read();
    db.data.friends = db.data.friends.filter(f =>
      !((f.user_id === userId && f.friend_id === friendId) ||
        (f.user_id === friendId && f.friend_id === userId))
    );
    db.write();
  },

  getFriends(userId) {
    db.read();
    return db.data.friends
      .filter(f => f.user_id === userId && f.status === 'accepted')
      .map(f => { const u = this.getUserById(f.friend_id); return u ? { ...u, friend_since: f.created_at } : null; })
      .filter(Boolean);
  },

  getPendingRequests(userId) {
    db.read();
    return db.data.friends
      .filter(f => f.friend_id === userId && f.status === 'pending')
      .map(f => { const u = this.getUserById(f.user_id); return u ? { ...u, requested_at: f.created_at } : null; })
      .filter(Boolean);
  },

  getSentRequests(userId) {
    db.read();
    return db.data.friends
      .filter(f => f.user_id === userId && f.status === 'pending')
      .map(f => { const u = this.getUserById(f.friend_id); return u ? { ...u, sent_at: f.created_at } : null; })
      .filter(Boolean);
  },

  searchUsers(query, excludeId) {
    db.read();
    const q = query.toLowerCase();
    return db.data.users
      .filter(u => u.id !== excludeId && (
        (u.username   || '').toLowerCase().includes(q) ||
        (u.first_name || '').toLowerCase().includes(q) ||
        (u.last_name  || '').toLowerCase().includes(q)
      ))
      .slice(0, 20)
      .map(({ id, tg_id, username, first_name, last_name, photo_url }) =>
        ({ id, tg_id, username, first_name, last_name, photo_url })
      );
  },

  // ── Game sessions ─────────────────────────────────────────────────────────────
  createSession(id, gameType, player1Id) {
    db.read();
    const now = new Date().toISOString();
    db.data.game_sessions.push({ id, game_type: gameType, player1_id: player1Id, player2_id: null, state: null, status: 'waiting', winner_id: null, created_at: now, updated_at: now });
    db.write();
  },

  joinSession(sessionId, player2Id) {
    db.read();
    const s = db.data.game_sessions.find(s => s.id === sessionId);
    if (s) { s.player2_id = player2Id; s.status = 'active'; s.updated_at = new Date().toISOString(); }
    db.write();
  },

  updateSessionState(sessionId, state) {
    db.read();
    const s = db.data.game_sessions.find(s => s.id === sessionId);
    if (s) { s.state = state; s.updated_at = new Date().toISOString(); }
    db.write();
  },

  endSession(sessionId, winnerId) {
    db.read();
    const s = db.data.game_sessions.find(s => s.id === sessionId);
    if (s) { s.status = 'finished'; s.winner_id = winnerId || null; s.updated_at = new Date().toISOString(); }
    db.write();
  },

  getSession(sessionId) {
    db.read();
    return db.data.game_sessions.find(s => s.id === sessionId) || null;
  },

  getActiveSessions(gameType) {
    db.read();
    return db.data.game_sessions
      .filter(s => s.game_type === gameType && s.status === 'waiting')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20)
      .map(s => {
        const p1 = this.getUserById(s.player1_id);
        return { ...s, p1_name: p1?.first_name || 'Игрок', p1_username: p1?.username || null, p1_photo: p1?.photo_url || null };
      });
  },

  getLeaderboard(gameType, limit = 20) {
    db.read();
    return db.data.player_stats
      .filter(s => s.game_type === gameType)
      .sort((a, b) => b.level - a.level || b.xp - a.xp || b.wins - a.wins)
      .slice(0, limit)
      .map(s => { const u = this.getUserById(s.user_id); return u ? { ...u, ...s } : null; })
      .filter(Boolean);
  },
};

module.exports = { db, dbHelpers, xpForLevel };
