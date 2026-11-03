const fs = require('fs');
const { connect } = require('@tidbcloud/serverless');

const env = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

async function check() {
  const conn = connect({ url: dbUrl });
  const rows = await conn.execute(
    `SELECT id, invoice_no, customer_name, person, reason, root_cause, report_date, created_at 
     FROM shipment_returns 
     WHERE person LIKE 'ARD%' OR person LIKE '%/ARD%' OR person LIKE '% ARD%'`
  );
  console.log('Total rows with ARD:', rows.length);
  console.log('All rows with ARD:', rows.map(r => ({ id: r.id, inv: r.invoice_no, person: r.person, reason: r.reason, date: r.report_date })));
}

check().then(() => process.exit(0)).catch(console.error);
