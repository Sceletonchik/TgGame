// На Render: VITE_API_URL = https://gamearena-backend.onrender.com
// Локально: пустая строка → запросы идут на тот же хост (через vite proxy)
const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') // убрать trailing slash
  : '';

async function request(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  // Auth
  auth: (user) => request('POST', '/users/auth', user),

  // Users
  getStats:       (userId)          => request('GET',  `/users/${userId}/stats`),
  getProfile:     (userId)          => request('GET',  `/users/${userId}/profile`),
  searchUsers:    (q, excludeId)    => request('GET',  `/users/search?q=${encodeURIComponent(q)}&excludeId=${excludeId}`),
  getLeaderboard: (gameType)        => request('GET',  `/users/leaderboard/${gameType}`),

  // Friends
  getFriends:    (userId)           => request('GET',  `/friends/${userId}`),
  sendRequest:   (userId, friendId) => request('POST', '/friends/request',       { userId, friendId }),
  acceptRequest: (userId, rid)      => request('POST', '/friends/accept',         { userId, requesterId: rid }),
  rejectRequest: (userId, rid)      => request('POST', '/friends/reject',         { userId, requesterId: rid }),
  removeFriend:  (userId, friendId) => request('DELETE',`/friends/${userId}/${friendId}`),

  // Games
  getSessions:   (gameType)         => request('GET',  `/games/sessions/${gameType}`),
  createSession: (gameType, userId) => request('POST', '/games/sessions',         { gameType, userId }),
};
