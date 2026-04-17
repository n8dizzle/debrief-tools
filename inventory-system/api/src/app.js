'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const router = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// ──────────────────────────────────────────────
// Security & parsing
// ──────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = env.corsOrigins;
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────
// Logging
// ──────────────────────────────────────────────
if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
}

// ──────────────────────────────────────────────
// Health check (no auth required)
// ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv, ts: new Date().toISOString() });
});

// ──────────────────────────────────────────────
// API routes
// ──────────────────────────────────────────────
app.use('/api/v1', router);

// ──────────────────────────────────────────────
// Error handling
// ──────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
