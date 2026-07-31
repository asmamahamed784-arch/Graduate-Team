import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:NQS%40123@localhost:5433/nqs' });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log("Tables in DB:", res.rows.map(r => r.table_name));
  await client.end();
}
run().catch(console.error);
