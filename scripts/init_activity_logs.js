const { connect } = require('@tidbcloud/serverless');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL="?([^"\n\r]+)"?/);
const dbUrl = match[1];

async function initTable() {
  const conn = connect({ url: dbUrl });
  console.log('Connecting to TiDB...');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(100) NOT NULL,
      user_email VARCHAR(150),
      action_type VARCHAR(50) NOT NULL,
      module VARCHAR(50) NOT NULL,
      target_id VARCHAR(100),
      details TEXT NOT NULL,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at DESC),
      INDEX idx_module (module),
      INDEX idx_user (user_name),
      INDEX idx_action (action_type)
    );
  `);

  console.log('activity_logs table created successfully!');

  // Insert a test initial log
  await conn.execute(`
    INSERT INTO activity_logs (user_name, user_email, action_type, module, details)
    VALUES ('System', 'system@fantastic-order.com', 'SYSTEM_INIT', 'SYSTEM', 'Sistem Audit & Log Aktivitas Diaktifkan');
  `);

  const count = await conn.execute('SELECT COUNT(*) as c FROM activity_logs');
  console.log('Total logs:', count);
}

initTable().catch(console.error);
