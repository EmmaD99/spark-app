require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});
require('./lib/socket')(io);

// ── Middleware ───────────────────────────────────────────────────────────────
const { securityHeaders, authLimiter, apiLimiter } = require('./middleware/security');

app.use(securityHeaders);
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));

// Stripe webhook AVANT express.json()
app.use('/api/webhook', express.raw({ type: 'application/json' }), require('./routes/webhook'));

app.use(express.json());
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
const { verifyToken } = require('./middleware/auth');
const { requireAdmin } = require('./middleware/security');

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/profiles', verifyToken, require('./routes/profiles'));
app.use('/api/missions', verifyToken, require('./routes/missions'));
app.use('/api/matches',  verifyToken, require('./routes/matches'));
app.use('/api/credits',  verifyToken, require('./routes/credits'));
app.use('/api/admin',    verifyToken, requireAdmin, require('./routes/admin'));

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🔥 SPARK backend démarré sur le port ${PORT}`));
