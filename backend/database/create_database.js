import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const DEFAULT_ADMIN_URL = 'postgresql://postgres:NQS%40123@localhost:5432/postgres';

const getAdminConnectionString = () => {
  const configured = process.env.POSTGRES_ADMIN_URL || process.env.DATABASE_URL || DEFAULT_ADMIN_URL;
  return configured.replace(/\/[^/?]+(\?.*)?$/, '/postgres$1');
};

const getDatabaseName = () => {
  const configured = process.env.DATABASE_URL || 'postgresql://postgres:NQS%40123@localhost:5432/nqs';
  return new URL(configured).pathname.replace(/^\//, '') || 'nqs';
};

const databaseName = getDatabaseName();

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
  throw new Error(`Unsafe PostgreSQL database name: ${databaseName}`);
}

const client = new Client({
  connectionString: getAdminConnectionString(),
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

try {
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

  if (existing.rowCount) {
    console.log(`Database ${databaseName} already exists.`);
  } else {
    await client.query(`CREATE DATABASE ${databaseName}`);
    console.log(`Created database ${databaseName}.`);
  }
} finally {
  await client.end();
}
