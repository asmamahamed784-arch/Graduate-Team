import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS "OtpCode" (
    "id" TEXT PRIMARY KEY,
    "purpose" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "user" TEXT,
    "ticket" TEXT,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invalidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS "OtpCode_lookup_idx"
  ON "OtpCode" ("purpose", "phone", "user", "ticket", "invalidated", "usedAt", "expiresAt")
`);
await client.end();

console.log('OtpCode table ready');
