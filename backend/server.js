require('dotenv').config();
const express    = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const usersRouter  = require('./routes/users');
const friendsRouter= require('./routes/friends');
const gamesRouter  = require('./routes/games');
const { setupGameSocket } = require('./socket/gameHandler');

const app  = express();
const http = createServer(app);
const io   = new Server(http, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

// API Routes
app.use('/api/users',   usersRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/games',   gamesRouter);

// Socket.io
setupGameSocket(io);

// Start
const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // Start bot
  require('./bot');
});
