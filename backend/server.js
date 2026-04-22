require('dotenv').config();
const express    = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const usersRouter   = require('./routes/users');
const friendsRouter = require('./routes/friends');
const gamesRouter   = require('./routes/games');
const { setupGameSocket } = require('./socket/gameHandler');

const app  = express();
const http = createServer(app);
const io   = new Server(http, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

app.use(cors());
app.use(express.json());

// Health check — Render uses this to detect crashes
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/',       (_, res) => res.json({ service: 'GameArena API', status: 'running' }));

// API routes
app.use('/api/users',   usersRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/games',   gamesRouter);

// Socket.io real-time game logic
setupGameSocket(io);

// Render injects PORT automatically — must bind 0.0.0.0
const PORT = process.env.PORT || 3001;
http.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GameArena backend running on port ${PORT}`);
});
