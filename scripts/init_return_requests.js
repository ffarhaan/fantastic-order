const { connect } = require('@tidbcloud/serverless');

const url = 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function main() {
  const conn = connect({ url });
  console.log("Connecting to TiDB...");
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS return_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id VARCHAR(64) UNIQUE,
      request_date VARCHAR(64),
      pbf VARCHAR(32),
      customer_name VARCHAR(255),
      invoice_no VARCHAR(64),
      product_name TEXT,
      qty INT DEFAULT 1,
      batch_no VARCHAR(64),
      expiry_date VARCHAR(64),
      reason VARCHAR(255),
      note TEXT,
      requester_name VARCHAR(128),
      status VARCHAR(64) DEFAULT 'Pending',
      processed_date VARCHAR(64),
      processed_by VARCHAR(128),
      photos LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Table return_requests created successfully!");
  const tables = await conn.execute("SHOW TABLES;");
  console.log("Tables:", tables);
}

main().catch(console.error);
