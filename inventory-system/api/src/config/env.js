'use strict';

// Core vars required to boot — API will not start without these
const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

// Optional integrations — warn but don't crash; routes will return 503 if unconfigured
const optional = ['ST_CLIENT_ID', 'ST_CLIENT_SECRET', 'ST_TENANT_ID', 'ST_APP_KEY', 'SENDGRID_API_KEY', 'FROM_EMAIL'];
const missingOptional = optional.filter((k) => !process.env[k] || process.env[k] === 'placeholder');
if (missingOptional.length) {
  console.warn(`[env] Optional vars not configured (ST/email features disabled): ${missingOptional.join(', ')}`);
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),

  db: {
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  st: {
    clientId: process.env.ST_CLIENT_ID,
    clientSecret: process.env.ST_CLIENT_SECRET,
    tenantId: process.env.ST_TENANT_ID,
    appKey: process.env.ST_APP_KEY,
    baseUrl: 'https://api.servicetitan.io',
    authUrl: 'https://auth.servicetitan.io/connect/token',
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    fromName: process.env.FROM_NAME || 'Inventory System',
    managerEmail: process.env.MANAGER_NOTIFY_EMAIL,
  },

  crons: {
    batchLock: process.env.BATCH_LOCK_CRON || '0 6 * * *',
    weeklyPO:  process.env.WEEKLY_PO_CRON  || '0 7 * * 1',
    stSync:    process.env.ST_SYNC_CRON    || '0 */4 * * *',
    binAlert:  process.env.BIN_ALERT_CRON  || '0 * * * *',
  },
};
