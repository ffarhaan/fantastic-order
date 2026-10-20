const { connect } = require('../../faktur-tracker/node_modules/@tidbcloud/serverless');
const xlsx = require('../../faktur-tracker/node_modules/xlsx');
const path = require('path');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function run() {
  console.log('Connecting to TiDB...');

  // 1. Create tables
  console.log('Creating tables if not exist...');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(64) PRIMARY KEY,
      customer_id_oracle VARCHAR(64),
      name VARCHAR(255) NOT NULL,
      status_merchant VARCHAR(64),
      phone VARCHAR(64),
      email VARCHAR(255),
      address TEXT,
      vat_id VARCHAR(64),
      nik VARCHAR(64),
      owner_name VARCHAR(255),
      owner_address TEXT,
      sia_number VARCHAR(128),
      sia_expired VARCHAR(64),
      sipa_number VARCHAR(128),
      sipa_expired VARCHAR(64),
      apj_name VARCHAR(255),
      sipnap_code VARCHAR(64),
      site_bill_to VARCHAR(64),
      site_ship_to VARCHAR(64),
      branch VARCHAR(128),
      zone VARCHAR(128),
      category VARCHAR(64),
      halodoc_pharma VARCHAR(255),
      is_active_2p VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cust_name (name),
      INDEX idx_cust_oracle (customer_id_oracle)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS shipment_returns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pbf VARCHAR(32),
      customer_name TEXT,
      invoice_no VARCHAR(64),
      so_no VARCHAR(128),
      product_name TEXT,
      qty INT DEFAULT 1,
      batch_no VARCHAR(128),
      expiry_date VARCHAR(64),
      reason TEXT,
      invoice_date VARCHAR(64),
      week INT,
      category VARCHAR(32),
      month INT,
      report_date VARCHAR(64),
      confirm VARCHAR(64),
      action TEXT,
      nota_retur_no VARCHAR(128),
      resolved_date VARCHAR(64),
      status VARCHAR(64),
      note TEXT,
      person VARCHAR(128),
      root_cause TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ret_inv (invoice_no),
      INDEX idx_ret_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try {
    await conn.execute(`ALTER TABLE shipment_returns MODIFY COLUMN product_name TEXT;`);
    await conn.execute(`ALTER TABLE shipment_returns MODIFY COLUMN customer_name TEXT;`);
    await conn.execute(`ALTER TABLE shipment_returns MODIFY COLUMN action TEXT;`);
  } catch (e) {
    // ignore if already applied
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS fakturs_archive (
      invoice_key VARCHAR(64) PRIMARY KEY,
      no_faktur VARCHAR(64) NOT NULL,
      no_sales_order VARCHAR(64),
      customer_name VARCHAR(255),
      order_date VARCHAR(32),
      transaction_date VARCHAR(32),
      jenis_transaksi VARCHAR(32),
      kategori VARCHAR(32),
      kategori_produk VARCHAR(32),
      status_cetak TINYINT(1) DEFAULT 0,
      printed_at VARCHAR(64),
      printed_by VARCHAR(64),
      total_harga DECIMAL(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_no_faktur (no_faktur),
      INDEX idx_status_cetak (status_cetak)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS faktur_items_archive (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_key VARCHAR(64) NOT NULL,
      item_name VARCHAR(255),
      qty INT DEFAULT 1,
      uom VARCHAR(32),
      batch_no VARCHAR(64),
      exp_date VARCHAR(32),
      kategori_item VARCHAR(32),
      harga_satuan DECIMAL(15,2) DEFAULT 0,
      subtotal DECIMAL(15,2) DEFAULT 0,
      INDEX idx_items_invoice_key (invoice_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Tables created successfully.');

  // Read Excel
  const excelPath = path.resolve(__dirname, '../public/master_dan_retur.xlsx');
  console.log('Reading Excel from:', excelPath);
  const wb = xlsx.readFile(excelPath);

  // Seed Customers
  const sheetCust = wb.Sheets['Sheet1'];
  if (sheetCust) {
    const rawCust = xlsx.utils.sheet_to_json(sheetCust);
    console.log(`Found ${rawCust.length} customers in Sheet1.`);

    // Check count first
    const [cntRes] = await conn.execute('SELECT COUNT(*) as c FROM customers');
    if (cntRes.c === 0 || cntRes.c < 100) {
      console.log('Seeding customers in batches...');
      const batchSize = 250;
      for (let i = 0; i < rawCust.length; i += batchSize) {
        const batch = rawCust.slice(i, i + batchSize);
        const values = [];
        for (const r of batch) {
          const id = String(r['CUSTOMER ID'] || '').trim();
          if (!id) continue;
          const idOracle = String(r['CUSTOMER ID ORACLE'] || '').trim();
          const name = String(r['NAMA APOTEK/RS/PBF/KLINIK'] || '').trim();
          const status = String(r['STATUS MERCHANT'] || '').trim();
          const phone = String(r['NO TELF APJ'] || '').trim();
          const email = String(r['Alamat email'] || '').trim();
          const address = String(r['Default Billing Address'] || '').trim();
          const vatId = String(r['VAT ID'] || '').trim();
          const nik = String(r['NIK NUMBER (npwp 16 digit)'] || '').trim();
          const ownerName = String(r['NAMA PEMILIK NPWP'] || '').trim();
          const ownerAddr = String(r['ALAMAT WAJIB PAJAK'] || '').trim();
          const siaNum = String(r['IZIN APOTEK/KLINIK/PBF/RS NUMBER'] || '').trim();
          const siaExp = String(r['SIA EXPIRED DATE'] || '').trim();
          const sipaNum = String(r['SIPA NUMBER'] || '').trim();
          const sipaExp = String(r['SIPA EXPIRED DATE'] || '').trim();
          const apjName = String(r['NAMA APJ'] || '').trim();
          const sipnap = String(r['KODE SIPNAP'] || '').trim();
          const billTo = String(r['SITE NUMBER (BILL TO)'] || '').trim();
          const shipTo = String(r['SITE NUMBER (SHIP TO)'] || '').trim();
          const branch = String(r['MBI BRANCH'] || '').trim();
          const zone = String(r['Zone'] || '').trim();
          const cat = String(r['KATEGORI CUSTOMER'] || '').trim();
          const halodoc = String(r['BRANCH NAME HALODOC FOR PHARMA'] || '').trim();
          const is2p = String(r['LIST APOTEK 2P AKTIF'] || '').trim();

          values.push([
            id, idOracle, name, status, phone, email, address, vatId, nik,
            ownerName, ownerAddr, siaNum, siaExp, sipaNum, sipaExp, apjName,
            sipnap, billTo, shipTo, branch, zone, cat, halodoc, is2p
          ]);
        }

        if (values.length > 0) {
          // Prepare multi-row insert with INSERT IGNORE
          const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
          const flatParams = values.flat();
          await conn.execute(
            `INSERT IGNORE INTO customers (
              id, customer_id_oracle, name, status_merchant, phone, email, address, vat_id, nik,
              owner_name, owner_address, sia_number, sia_expired, sipa_number, sipa_expired, apj_name,
              sipnap_code, site_bill_to, site_ship_to, branch, zone, category, halodoc_pharma, is_active_2p
            ) VALUES ${placeholders}`,
            flatParams
          );
        }
        console.log(`Inserted customers up to ${Math.min(i + batchSize, rawCust.length)}`);
      }
      console.log('Customer seeding done!');
    } else {
      console.log(`Customers table already has ${cntRes.c} records.`);
    }
  }

  // Seed Shipment Returns
  const sheetRet = wb.Sheets['Sheet2'];
  if (sheetRet) {
    const rawRet = xlsx.utils.sheet_to_json(sheetRet);
    console.log(`Found ${rawRet.length} returns in Sheet2.`);

    // Clear table first to ensure fresh seed
    await conn.execute('TRUNCATE TABLE shipment_returns;');
    console.log('Seeding shipment_returns in batches...');
      const batchSize = 250;
      for (let i = 0; i < rawRet.length; i += batchSize) {
        const batch = rawRet.slice(i, i + batchSize);
        const values = [];
        for (const r of batch) {
          const pbf = String(r['PBF'] || '').trim();
          const cust = String(r['Nama Apotek'] || '').trim();
          const inv = String(r['No.Faktur'] || '').trim();
          const so = String(r['No. Sales order/Transfer order/Shipmet ID HDP'] || r['SO number'] || '').trim();
          const prod = String(r['Nama Produk (diisi sesuai penamaan di invoice)'] || '').trim();
          const qty = Number(r['Kuantitas (yg di retur)']) || 1;
          const batchNo = String(r['Batch Number'] || '').trim();
          const exp = String(r['Expiry Date'] || '').trim();
          const reason = String(r['Reason'] || '').trim();
          const invDate = String(r['Tanggal Faktur'] || '').trim();
          const week = Number(r['Week']) || 0;
          const cat = String(r['Category'] || '').trim();
          const month = Number(r['Month']) || 0;
          const repDate = String(r['Tanggal report'] || '').trim();
          const confirm = String(r['Confirm'] || '').trim();
          const action = String(r['Action'] || '').trim();
          const nota = String(r['No. Nota Retur'] || '').trim();
          const resDate = String(r['Tanggal penyelesaian'] || '').trim();
          const status = String(r['Status'] || '').trim();
          const note = String(r['Note'] || '').trim();
          const person = String(r['Person'] || '').trim();
          const cause = String(r['Root cause'] || '').trim();

          values.push([
            pbf, cust, inv, so, prod, qty, batchNo, exp, reason, invDate,
            week, cat, month, repDate, confirm, action, nota, resDate, status,
            note, person, cause
          ]);
        }

        if (values.length > 0) {
          const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
          const flatParams = values.flat();
          await conn.execute(
            `INSERT INTO shipment_returns (
              pbf, customer_name, invoice_no, so_no, product_name, qty, batch_no, expiry_date, reason, invoice_date,
              week, category, month, report_date, confirm, action, nota_retur_no, resolved_date, status,
              note, person, root_cause
            ) VALUES ${placeholders}`,
            flatParams
          );
        }
        console.log(`Inserted returns up to ${Math.min(i + batchSize, rawRet.length)}`);
      }
      console.log('Shipment returns seeding done!');
  }

  console.log('All database initialization completed successfully!');
}

run().catch(console.error);
