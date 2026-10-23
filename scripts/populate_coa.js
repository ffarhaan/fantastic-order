const { connect } = require('@tidbcloud/serverless');
const xlsx = require('xlsx');

const conn = connect({
  url: 'mysql://2F3e9mNrkPjPFFP.root:mOxC1v2lxbsc7FmF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}'
});

async function main() {
  const filePath = 'C:/Users/medikabinainvestama_/Downloads/Data Pelanggan MBI.xlsx';
  console.log('Loading:', filePath);
  const wb = xlsx.readFile(filePath, { sheets: ['DATA CUSTOMER MBI'] });
  const ws = wb.Sheets['DATA CUSTOMER MBI'];
  const rawRows = xlsx.utils.sheet_to_json(ws);

  console.log(`Read ${rawRows.length} rows.`);

  const updates = [];
  rawRows.forEach(r => {
    const id = String(r['CUSTOMER ID'] || '').trim();
    if (!id || id === '#N/A') return;
    const coaRec = String(r['COA - REC'] || '').trim() || null;
    const coaRev = String(r['COA - REV'] || '').trim() || null;
    const orderStatus = String(r['SUDAH PERNAH ORDER/BELUM'] || '').trim() || null;

    updates.push([coaRec, coaRev, orderStatus, id]);
  });

  console.log(`Processing updates for ${updates.length} customers in batches...`);
  const batchSize = 250;
  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    // Use CASE WHEN statement or batch updates
    for (const [coaRec, coaRev, orderStatus, id] of chunk) {
      await conn.execute(
        'UPDATE customers SET coa_rec = ?, coa_rev = ?, order_status = ? WHERE id = ?',
        [coaRec, coaRev, orderStatus, id]
      );
    }
    console.log(`Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length}...`);
  }

  const [sample] = await conn.execute(
    'SELECT id, name, coa_rec, coa_rev, order_status FROM customers WHERE coa_rec IS NOT NULL LIMIT 3'
  );
  console.log('Sample updated customers:', sample);
}

main().catch(console.error);
