'use strict';

require('dotenv').config();
const env = require('./src/config/env');
const app = require('./src/app');
const { pool } = require('./src/config/db');
const { startScheduler } = require('./src/jobs');

const PORT = env.port;

async function start() {
  // Verify DB connection
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  // Start scheduled jobs
  startScheduler();
  console.log('✅ Scheduler started');

  const server = app.listen(PORT, () => {
    console.log(`✅ API listening on port ${PORT} [${env.nodeEnv}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      console.log('Database pool closed');
      process.exit(0);
    });
    // Force close after 10s
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
