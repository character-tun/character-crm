const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

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