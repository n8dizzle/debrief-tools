'use strict';

/**
 * migrate.js — run pending SQL migrations in order.
 *
 * Usage:
 *   node scripts/migrate.js            # apply all pending migrations
 *   node scripts/migrate.js --dry-run  # show what would run, don't apply
 *
 * Migrations live in /migrations/*.sql, sorted alphabetically.
 * Applied filenames are tracked in the schema_migrations table.
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set. Copy .env.example to .env and fill in values.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅  Connected to database\n');

  try {
    // Bootstrap the tracking table if it doesn't exist yet
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Determine which migrations have already been applied
    const { rows: applied } = await client.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    // Find all .sql files in the migrations directory, sorted
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const pending = files.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('✅  Database is up to date — no pending migrations.\n');
      return;
    }

    console.log(`📋  ${pending.length} pending migration(s):\n`);
    pending.forEach(f => console.log(`    • ${f}`));
    console.log();

    if (DRY_RUN) {
      console.log('🔍  Dry run — no changes applied.\n');
      return;
    }

    // Apply each pending migration in a transaction
    for (const filename of pending) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, 'utf8');

      process.stdout.write(`⏳  Applying ${filename} … `);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log('✅  done');
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('❌  FAILED');
        console.error(`\n    Error in ${filename}:\n    ${err.message}\n`);
        process.exit(1);
      }
    }

    console.log('\n🎉  All migrations applied successfully.\n');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
