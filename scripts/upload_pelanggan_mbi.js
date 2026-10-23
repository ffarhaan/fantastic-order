const { connect } = require('@tidbcloud/serverless');
const xlsx = require('xlsx');
const path = require('path');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  const filePath = 'C:/Users/medikabinainvestama_/Downloads/Data Pelanggan MBI.xlsx';
  console.log('Membaca file:', filePath);

  const wb = xlsx.readFile(filePath, { sheets: ['DATA CUSTOMER MBI'] });
  const ws = wb.Sheets['DATA CUSTOMER MBI'];
  if (!ws) {
    console.error('Sheet "DATA CUSTOMER MBI" tidak ditemukan!');
    process.exit(1);
  }

  // Extract hyperlinks map for column AO (DOKUMEN LEGALITAS)
  const hyperlinks = {};
  for (const cell in ws) {
    if (cell.startsWith('AO') && ws[cell].l && ws[cell].l.Target) {
      const rowNum = parseInt(cell.replace('AO', ''), 10);
      hyperlinks[rowNum] = ws[cell].l.Target;
    }
  }
  console.log(`Ditemukan ${Object.keys(hyperlinks).length} link Google Drive di kolom DOKUMEN LEGALITAS (AO).`);

  const rawRows = xlsx.utils.sheet_to_json(ws);
  console.log(`Total baris dibaca dari sheet: ${rawRows.length}`);

  const validCustomers = [];
  // Notice rawRows index 0 corresponds to Excel row 2 (row 1 is header)
  rawRows.forEach((r, idx) => {
    const excelRow = idx + 2;
    const id = String(r['CUSTOMER ID'] || '').trim();
    const name = String(r['NAMA APOTEK/RS/PBF/KLINIK'] || '').trim();

    // Skip blank or invalid header/na rows
    if (!id || id === '#N/A' || !name || name === '#N/A') return;

    const idOracle = String(r['CUSTOMER ID ORACLE'] || '').trim();
    const status = String(r['STATUS MERCHANT'] || 'ACTIVE').trim();
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
    const cat = String(r['KATEGORI CUSTOMER'] || 'REG').trim();
    const halodoc = String(r['BRANCH NAME HALODOC FOR PHARMA'] || '').trim();
    const is2p = String(r['LIST APOTEK 2P AKTIF'] || '').trim();

    // Dokumen Legalitas (URL dari hyperlink jika ada, atau teks sel jika berupa http)
    const docDisplay = String(r['DOKUMEN LEGALITAS'] || '').trim();
    let docUrl = hyperlinks[excelRow] || '';
    if (!docUrl && (docDisplay.startsWith('http://') || docDisplay.startsWith('https://'))) {
      docUrl = docDisplay;
    }

    validCustomers.push([
      id, idOracle, name, status, phone, email, address, vatId, nik,
      ownerName, ownerAddr, siaNum, siaExp, sipaNum, sipaExp, apjName,
      sipnap, billTo, shipTo, branch, zone, cat, halodoc, is2p,
      docUrl || null, docDisplay || null, null, null
    ]);
  });

  console.log(`Data customer valid yang siap di-upload: ${validCustomers.length}`);

  // Pastikan tabel kosong
  console.log('Mengosongkan tabel customers sebelum import...');
  await conn.execute('TRUNCATE TABLE customers;');

  // Upload ke TiDB dalam batch
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < validCustomers.length; i += batchSize) {
    const chunk = validCustomers.slice(i, i + batchSize);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flatParams = chunk.flat();

    await conn.execute(
      `INSERT INTO customers (
        id, customer_id_oracle, name, status_merchant, phone, email, address,
        vat_id, nik, owner_name, owner_address, sia_number, sia_expired,
        sipa_number, sipa_expired, apj_name, sipnap_code, site_bill_to,
        site_ship_to, branch, zone, category, halodoc_pharma, is_active_2p,
        document_url, document_name, npwp_drive_url, npwp_file_url
      ) VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        customer_id_oracle = VALUES(customer_id_oracle),
        name = VALUES(name),
        status_merchant = VALUES(status_merchant),
        phone = VALUES(phone),
        email = VALUES(email),
        address = VALUES(address),
        vat_id = VALUES(vat_id),
        nik = VALUES(nik),
        owner_name = VALUES(owner_name),
        owner_address = VALUES(owner_address),
        sia_number = VALUES(sia_number),
        sia_expired = VALUES(sia_expired),
        sipa_number = VALUES(sipa_number),
        sipa_expired = VALUES(sipa_expired),
        apj_name = VALUES(apj_name),
        sipnap_code = VALUES(sipnap_code),
        site_bill_to = VALUES(site_bill_to),
        site_ship_to = VALUES(site_ship_to),
        branch = VALUES(branch),
        zone = VALUES(zone),
        category = VALUES(category),
        halodoc_pharma = VALUES(halodoc_pharma),
        is_active_2p = VALUES(is_active_2p),
        document_url = COALESCE(VALUES(document_url), document_url),
        document_name = COALESCE(VALUES(document_name), document_name)`,
      flatParams
    );

    inserted += chunk.length;
    console.log(`Berhasil insert ${inserted} / ${validCustomers.length} customer...`);
  }

  const [cnt] = await conn.execute('SELECT COUNT(*) as total FROM customers;');
  console.log(`\nSELESAI! Total customer di database saat ini: ${cnt.total}`);
}

main().catch(console.error);
