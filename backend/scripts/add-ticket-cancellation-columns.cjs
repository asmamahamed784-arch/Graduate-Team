/**
 * Adds Ticket cancellation feedback columns used when admin/center cancel a request.
 * Safe to re-run.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pg = require('pg');

const statements = [
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "cancellationReasons" JSONB',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "additionalCancellationReason" TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "cancellationNotes" TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "previousStatusBeforeCancellation" TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT NOT NULL DEFAULT \'\'',
  'ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "needsResubmission" BOOLEAN NOT NULL DEFAULT false',
];

(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const sql of statements) {
    await client.query(sql);
    console.log('OK:', sql.slice(0, 60), '...');
  }
  await client.end();
  console.log('Ticket cancellation columns ready.');
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
