const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
require('dotenv').config();

// Connect to Database
connectDB();

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

// Block dangerous HTTP methods in production
if (process.env.NODE_ENV === 'production') {
  const blocked = new Set(['TRACE', 'TRACK']);
  app.use((req, res, next) => {
    if (blocked.has(req.method)) return res.status(405).send('Method Not Allowed');
    return next();
  });
}

// Define API routes
app.use('/api/clients', require('./routes/clients'));
app.use('/api/detailing-orders', require('./routes/detailingOrders'));
app.use('/api/boxes', require('./routes/boxes'));

// Error handler middleware
const errorHandler = require('./middleware/error');

app.use(errorHandler);

// Basic API route for testing
app.get('/api/test', (req, res) => {
  res.json({ msg: 'API is working' });
});

const PORT = 5002;

app.listen(PORT, () => console.log(`API Server started on port ${PORT}`));
