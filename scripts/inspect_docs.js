const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.readFile('./public/master_dan_retur.xlsx');
const ws = wb.Sheets['Sheet1'];
const data = xlsx.utils.sheet_to_json(ws);

const samples = [];
data.forEach(r => {
  if (r['DOKUMEN LEGALITAS']) {
    samples.push(r['DOKUMEN LEGALITAS']);
  }
});

console.log('Total non-empty DOKUMEN LEGALITAS:', samples.length);
console.log('First 15 samples:', samples.slice(0, 15));
