const xlsx = require('xlsx');

const filePath = 'C:/Users/medikabinainvestama_/Downloads/Data Pelanggan MBI.xlsx';
console.log('Loading DATA CUSTOMER MBI sheet from:', filePath);

const wb = xlsx.readFile(filePath, { sheets: ['DATA CUSTOMER MBI'] });
const ws = wb.Sheets['DATA CUSTOMER MBI'];

if (!ws) {
  console.log('Sheet DATA CUSTOMER MBI not found!');
  process.exit(1);
}

const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
console.log('Total rows:', rows.length);
const headers = rows[0] || [];
console.log('Headers:', headers);

// Check hyperlinks in cells
let linkCount = 0;
const linkSamples = [];
for (const cell in ws) {
  if (cell[0] === '!') continue;
  if (ws[cell].l) {
    linkCount++;
    if (linkSamples.length < 10) {
      linkSamples.push({ cell, val: ws[cell].v, target: ws[cell].l.Target });
    }
  }
}
console.log('Total hyperlinks in worksheet:', linkCount);
console.log('Sample hyperlinks:', linkSamples);

// Check non-empty DOKUMEN LEGALITAS
const dataObjs = xlsx.utils.sheet_to_json(ws);
let docCount = 0;
const docSamples = [];
dataObjs.forEach(r => {
  if (r['DOKUMEN LEGALITAS']) {
    docCount++;
    if (docSamples.length < 5) docSamples.push(r['DOKUMEN LEGALITAS']);
  }
});
console.log('Total DOKUMEN LEGALITAS values:', docCount);
console.log('Sample DOKUMEN LEGALITAS:', docSamples);
