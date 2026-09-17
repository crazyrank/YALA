const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./utils/errors');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const studentsRoutes = require('./routes/students.routes');
const syncRoutes = require('./routes/sync.routes');
const conflictsRoutes = require('./routes/conflicts.routes');
const permissionsRoutes = require('./routes/permissions.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const devicesRoutes = require('./routes/devices.routes');
const directoryRoutes = require('./routes/directory.routes');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.use(helmet());

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ ok: true, service: 'ysis-backend' }));

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/students', studentsRoutes);
app.use('/sync', syncRoutes);
app.use('/conflicts', conflictsRoutes);
app.use('/permissions', permissionsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/devices', devicesRoutes);
app.use('/directory', directoryRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That endpoint does not exist.' } });
});

// Must be mounted LAST.
app.use(errorHandler);


// Rate limiters – keyed by IP + account where possible
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
  keyGenerator: (req) => {
    // Prefer email/username when present so one person cannot lock the whole office
    const id = (req.body && (req.body.email || req.body.username)) || req.ip;
    return id;
  },
});

module.exports = app;
