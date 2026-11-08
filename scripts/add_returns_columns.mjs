import fs from 'fs';
import { connect } from '@tidbcloud/serverless';

const envLocal = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
for (const line of envLocal.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) dbUrl = trimmed.slice(13).replace(/^["']|["']$/g, '');
}

async function run() {
  const conn = connect({ url: dbUrl });
  console.log("Checking and updating schema for shipment_returns...");
  
  await conn.execute(`ALTER TABLE shipment_returns ADD COLUMN IF NOT EXISTS video_url LONGTEXT NULL;`);
  await conn.execute(`ALTER TABLE shipment_returns ADD COLUMN IF NOT EXISTS reject_reason TEXT NULL;`);
  await conn.execute(`ALTER TABLE shipment_returns ADD COLUMN IF NOT EXISTS reject_media_url LONGTEXT NULL;`);
  await conn.execute(`ALTER TABLE shipment_returns ADD COLUMN IF NOT EXISTS inprogress_type VARCHAR(64) NULL;`);
  
  const cols = await conn.execute('DESCRIBE shipment_returns');
  console.log('Updated columns in shipment_returns:', cols.map(c => c.Field));
}

run();
