const xlsx = require('xlsx');

const filePath = 'C:/Users/medikabinainvestama_/Downloads/Data Pelanggan MBI.xlsx';
const wb = xlsx.readFile(filePath, { sheets: ['DATA CUSTOMER MBI'] });
const ws = wb.Sheets['DATA CUSTOMER MBI'];
const rows = xlsx.utils.sheet_to_json(ws);

const npwpColumns = Object.keys(rows[0] || {}).filter(k => k.toLowerCase().includes('npwp') || k.toLowerCase().includes('drive'));
console.log('Columns matching npwp or drive:', npwpColumns);

for (const col of npwpColumns) {
  let count = 0;
  let sample = null;
  rows.forEach(r => {
    if (r[col]) {
      count++;
      if (!sample) sample = r[col];
    }
  });
  console.log(`Column "${col}": ${count} filled rows. Sample: ${sample}`);
}
