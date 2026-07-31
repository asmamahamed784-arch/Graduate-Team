const pg = require('pg');

async function main() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:NQS%40123@localhost:5433/nqs',
  });
  await client.connect();
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%user%'
  `);
  console.log('tables:', tables.rows);

  for (const name of ['User', 'users', 'Accounts', 'accounts']) {
    try {
      const res = await client.query(
        `SELECT id, username, name, role, status, email FROM "${name}"
         WHERE username ILIKE '%admin%' OR name ILIKE '%admin%' OR role ILIKE '%admin%'
         LIMIT 20`,
      );
      console.log(`from ${name}:`, JSON.stringify(res.rows, null, 2));
    } catch (e) {
      // table missing
    }
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
