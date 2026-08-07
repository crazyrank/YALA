const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./utils/errors');

const authRoutes = require('./routes/auth.routes');
const studentsRoutes = require('./routes/students.routes');
const syncRoutes = require('./routes/sync.routes');
const conflictsRoutes = require('./routes/conflicts.routes');
const permissionsRoutes = require('./routes/permissions.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const devicesRoutes = require('./routes/devices.routes');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ ok: true, service: 'ysis-backend' }));

app.use('/auth', authRoutes);
app.use('/students', studentsRoutes);
app.use('/sync', syncRoutes);
app.use('/conflicts', conflictsRoutes);
app.use('/permissions', permissionsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/devices', devicesRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That endpoint does not exist.' } });
});

// Must be mounted LAST.
app.use(errorHandler);

module.exports = app;
