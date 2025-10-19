const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
require('dotenv').config();

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
// Connect to Database (skip in dev auth mode)
if (!DEV_MODE) {
  connectDB();
} else {
  console.log('Auth DEV mode enabled: skipping MongoDB connection');
}

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(require('./middleware/auth').withUser);
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
app.use('/api/auth', require('./routes/auth'));

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