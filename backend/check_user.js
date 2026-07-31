import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:NQS%40123@localhost:5433/nqs' });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_type 
    FROM information_schema.tables 
    WHERE table_name = 'User'
  `);
  console.log("Type of User:", res.rows);
  
  const res2 = await client.query(`
    SELECT view_definition
    FROM information_schema.views
    WHERE table_name = 'User'
  `);
  if (res2.rows.length) {
    console.log("View definition:", res2.rows[0].view_definition);
  }
  await client.end();
}
run().catch(console.error);
