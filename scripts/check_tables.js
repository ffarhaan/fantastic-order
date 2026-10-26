const { connect } = require('@tidbcloud/serverless');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL="?([^"\n\r]+)"?/);
const dbUrl = match[1];

async function check() {
  const conn = connect({ url: dbUrl });
  const tables = await conn.execute('SHOW TABLES');
  console.log('Tables:', tables);
}
check();
