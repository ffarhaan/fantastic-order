// Membuat tabel customer_documents (indeks file Google Drive per customer)
// Jalankan: node --env-file=.env.local scripts/create_customer_documents.js
const { connect } = require('@tidbcloud/serverless');

const conn = connect({ url: process.env.DATABASE_URL });

async function main() {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS customer_documents (
      file_id      VARCHAR(128) NOT NULL PRIMARY KEY,
      customer_id  VARCHAR(64)  NOT NULL,
      file_name    VARCHAR(512) NOT NULL,
      mime_type    VARCHAR(128),
      size_bytes   BIGINT,
      folder_id    VARCHAR(128),
      folder_name  VARCHAR(512),
      modified_at  VARCHAR(64),
      synced_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customer_id (customer_id)
    )
  `);
  console.log('Tabel customer_documents siap.');
}

main().catch((e) => { console.error(e); process.exit(1); });
