/**
 * Adds Ticket.completedAt for Completed Today metrics (Africa/Mogadishu).
 * Safe to re-run.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pg = require('pg');

const statements = [
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ',
  'CREATE INDEX IF NOT EXISTS "Ticket_completedAt_idx" ON "Ticket" ("completedAt")',
  'CREATE INDEX IF NOT EXISTS "Ticket_status_completedAt_idx" ON "Ticket" ("status", "completedAt")'
];

(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const sql of statements) {
    await client.query(sql);
    console.log('OK:', sql);
  }
  await client.end();
  console.log('Ticket.completedAt ready.');
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
