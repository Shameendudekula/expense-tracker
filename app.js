const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { CATEGORIES, CURRENCIES } = require('./config/constants');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// The app is built here and started in server.js, so tests can use it without opening a port
const app = express();

// Render (and most hosts) sit behind a proxy; this lets the rate limiter see the real client IP
app.set('trust proxy', 1);

// The frontend is served by this same server, so CORS only matters if CLIENT_URL is set
app.use(cors(process.env.CLIENT_URL ? { origin: process.env.CLIENT_URL.split(',') } : undefined));
app.use(express.json({ limit: '100kb' }));

// API
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ status: 'ok', database: dbStates[mongoose.connection.readyState] || 'unknown', uptime: Math.round(process.uptime()) });
});
app.get('/api/meta', (req, res) => res.json({ categories: CATEGORIES, currencies: CURRENCIES }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', notFound);

// Frontend (public/*.html, css, js)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use(errorHandler);

module.exports = app;
