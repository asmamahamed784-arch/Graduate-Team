require('dotenv').config();
const { Client } = require('pg');

const url = new URL(process.env.DATABASE_URL);
const client = new Client({
  host: url.hostname,
  port: url.port,
  database: url.pathname.slice(1),
  user: url.username,
  password: decodeURIComponent(url.password)
});

async function run() {
  try {
    await client.connect();
    const tables = ['doc_active_sessions', 'doc_activitylogs', 'doc_announcements', 'doc_auditlogs', 'doc_centers', 'doc_contactmessages', 'doc_counters', 'doc_documents', 'doc_emaillogs', 'doc_feedbacks', 'doc_notifications', 'doc_qrscans', 'doc_queuehistories', 'doc_roles', 'doc_services', 'doc_settings', 'doc_smslogs', 'doc_systemconfigs', 'doc_tickets', 'doc_users'];
    for (const table of tables) {
      await client.query(`ALTER TABLE "${table}" RENAME TO "old_${table}"`);
      console.log(`Renamed ${table} to old_${table}`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
