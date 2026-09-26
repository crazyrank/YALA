const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./utils/errors');
const config = require('./config');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const studentsRoutes = require('./routes/students.routes');
const syncRoutes = require('./routes/sync.routes');
const conflictsRoutes = require('./routes/conflicts.routes');
const permissionsRoutes = require('./routes/permissions.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const devicesRoutes = require('./routes/devices.routes');
const directoryRoutes = require('./routes/directory.routes');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // API only; CSP is a browser concern
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

// Safer CORS: only the origins explicitly listed in CORS_ORIGIN.
// Mobile clients use Authorization Bearer and are unaffected.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser (mobile, curl, health checks)
    if (config.corsOrigins.length === 0) return cb(null, false);
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Global rate limit (auth has a tighter limiter of its own)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});
app.use(globalLimiter);

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

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That endpoint does not exist.' } });
});

app.use(errorHandler);

module.exports = app;
