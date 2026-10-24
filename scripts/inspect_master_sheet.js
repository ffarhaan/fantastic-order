const xlsx = require('xlsx');

const filePath = 'C:/Users/medikabinainvestama_/Downloads/Data Pelanggan MBI.xlsx';
console.log('Loading Master sheet from:', filePath);

const wb = xlsx.readFile(filePath, { sheets: ['Master', 'Master (1)'], cellFormula: true, cellHTML: true });

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\nSheet [${name}] preview: Total rows: ${rows.length}`);
  if (rows.length > 0) {
    const headers = rows[0];
    console.log('Headers count:', headers.length);
    headers.forEach((h, idx) => {
      const colLetter = xlsx.utils.encode_col(idx);
      console.log(`  Col ${colLetter} (${idx}): "${h}" | Row 1: "${rows[1] ? rows[1][idx] : ''}"`);
    });
  }
}
