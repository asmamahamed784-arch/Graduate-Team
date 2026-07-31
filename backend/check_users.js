import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:NQS%40123@localhost:5433/nqs' });

async function run() {
  await client.connect();
  const res = await client.query(`SELECT id, username, password FROM "User"`);
  console.log("Users in DB:", res.rows);
  await client.end();
}
run().catch(console.error);
