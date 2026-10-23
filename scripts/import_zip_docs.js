const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const { connect } = require('@tidbcloud/serverless');

const conn = connect({ url: process.env.DATABASE_URL });
const ZIP_PATH = path.join(process.env.USERPROFILE || 'C:/Users/medikabinainvestama_', 'Downloads', 'DATA PELANGGAN MBI-20261023T175514Z-1-002.zip');
const CHUNK_SIZE = 700 * 1024; // ~700KB base64 per chunk

function guessMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function processZipBuffer(buf, inheritedCustId, inheritedFolderName, items) {
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const parts = entry.name.split('/').filter(Boolean);
    const baseName = parts[parts.length - 1];
    if (!baseName || baseName.startsWith('._') || baseName === '.DS_Store') continue;

    const match = entry.name.match(/C\.\d+/i);
    const customerId = match ? match[0].toUpperCase() : inheritedCustId;
    if (!customerId) continue;

    const folderPart = parts.find(p => /C\.\d+/i.test(p)) || inheritedFolderName || customerId;

    if (baseName.toLowerCase().endsWith('.zip')) {
      const nestedBuf = await entry.async('nodebuffer');
      await processZipBuffer(nestedBuf, customerId, folderPart, items);
      continue;
    }

    const fileBuf = await entry.async('nodebuffer');
    items.push({
      customerId,
      folderName: folderPart,
      fileName: baseName,
      mimeType: guessMime(baseName),
      sizeBytes: fileBuf.length,
      base64: fileBuf.toString('base64'),
      modifiedAt: entry.date ? entry.date.toISOString() : new Date().toISOString(),
    });
  }
}

async function main() {
  console.log('Ensuring tables exist...');
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
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS customer_document_chunks (
      file_id     VARCHAR(128) NOT NULL,
      chunk_index INT NOT NULL,
      chunk_data  LONGTEXT NOT NULL,
      PRIMARY KEY (file_id, chunk_index)
    )
  `);

  console.log('Reading ZIP:', ZIP_PATH);
  const rawZip = fs.readFileSync(ZIP_PATH);
  const items = [];
  await processZipBuffer(rawZip, null, null, items);
  console.log(`Extracted ${items.length} files from ZIP. Uploading to TiDB...`);

  let done = 0;
  const custUpdates = new Map();

  for (const it of items) {
    const hash = crypto.createHash('md5').update(`${it.customerId}:${it.fileName}`).digest('hex').slice(0, 16);
    const fileId = `local_${it.customerId}_${hash}`;

    // Save chunks
    await conn.execute('DELETE FROM customer_document_chunks WHERE file_id = ?', [fileId]);
    for (let idx = 0, offset = 0; offset < it.base64.length; idx++, offset += CHUNK_SIZE) {
      const slice = it.base64.slice(offset, offset + CHUNK_SIZE);
      await conn.execute(
        'INSERT INTO customer_document_chunks (file_id, chunk_index, chunk_data) VALUES (?, ?, ?)',
        [fileId, idx, slice]
      );
    }

    // Save metadata
    await conn.execute(
      `INSERT INTO customer_documents (file_id, customer_id, file_name, mime_type, size_bytes, folder_id, folder_name, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         file_name = VALUES(file_name),
         mime_type = VALUES(mime_type),
         size_bytes = VALUES(size_bytes),
         folder_name = VALUES(folder_name),
         modified_at = VALUES(modified_at),
         synced_at = CURRENT_TIMESTAMP`,
      [fileId, it.customerId, it.fileName, it.mimeType, it.sizeBytes, 'local_zip', it.folderName, it.modifiedAt]
    );

    const viewUrl = `/api/tidb?action=view_document&file_id=${encodeURIComponent(fileId)}`;
    const prev = custUpdates.get(it.customerId) || {};
    if (/npwp/i.test(it.fileName)) {
      prev.npwp_file_url = viewUrl;
    } else if (!prev.document_url) {
      prev.document_url = viewUrl;
      prev.document_name = it.fileName;
    }
    custUpdates.set(it.customerId, prev);

    done++;
    if (done % 10 === 0 || done === items.length) {
      console.log(`Uploaded ${done} / ${items.length} files...`);
    }
  }

  console.log(`Updating ${custUpdates.size} customer records with direct document links...`);
  for (const [custId, u] of custUpdates.entries()) {
    await conn.execute(
      `UPDATE customers SET
         npwp_file_url = COALESCE(?, npwp_file_url),
         document_url = COALESCE(?, document_url),
         document_name = COALESCE(?, document_name)
       WHERE id = ?`,
      [u.npwp_file_url || null, u.document_url || null, u.document_name || null, custId]
    );
  }

  console.log('ALL DONE!');
}

main().catch(e => { console.error(e); process.exit(1); });
