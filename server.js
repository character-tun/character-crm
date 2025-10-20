const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
require('dotenv').config();

// Config validator
const { validateEnv, logEnvValidation } = require('./services/configValidator');

const envValidation = validateEnv(process.env);
logEnvValidation(envValidation);

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
// Connect to Database (skip in dev auth mode)
if (!DEV_MODE) {
  connectDB();
} else {
  console.log('Auth DEV mode enabled: skipping MongoDB connection');
}

// Initialize status action queue (Queue + Worker + QueueScheduler)
require('./queues/statusActionQueue');

const app = express();

// Middleware
app.use(express.json());
app.use(helmet());
// CORS: strict in production, permissive in dev
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = process.env.NODE_ENV === 'production'
  ? {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));
app.use(require('./middleware/auth').withUser);
// Block dangerous HTTP methods in production
if (process.env.NODE_ENV === 'production') {
  const blocked = new Set(['TRACE', 'TRACK']);
  app.use((req, res, next) => {
    if (blocked.has(req.method)) return res.status(405).send('Method Not Allowed');
    return next();
  });
}
// Add global API auth guard (whitelist /api/auth/* and /api/public/*)
const { requireAuth } = require('./middleware/auth');

app.use('/api', (req, res, next) => {
  const p = req.path || '';
  if (p.startsWith('/auth') || p.startsWith('/public')) return next();
  return requireAuth(req, res, next);
});

// Error handler middleware (должен быть после всех маршрутов)
const errorHandler = require('./middleware/error');

// Basic API route for testing
app.get('/api/test', (req, res) => {
  res.json({ msg: 'API is working' });
});

// Define API routes
app.use('/api/clients', require('./routes/clients'));
app.use('/api/detailing-orders', require('./routes/detailingOrders'));
app.use('/api/boxes', require('./routes/boxes'));
app.use('/api/tasks', require('./routes/tasks'));
// New routes: users, roles, auth
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/statuses', require('./routes/statuses'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/notify/templates', require('./routes/notifyTemplates'));
app.use('/api/notify/dev', require('./routes/notifyDev'));
app.use('/api/doc-templates', require('./routes/docTemplates'));
app.use('/api/files', require('./routes/files'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/queue', require('./routes/queue'));

// Error handler
app.use(errorHandler);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));