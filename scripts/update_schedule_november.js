const xlsx = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../../JADWAL_ADMIN_DAN_REKAP_GAJIAN_28_NOV.xlsx');
console.log('Loading workbook from:', filePath);
const wb = xlsx.readFile(filePath);

// 1. UPDATE 'NOVEMBER 2026'
const wsNov = wb.Sheets['NOVEMBER 2026'];

const rosterNov = [
  { row: 8,  name: 'NUR FARHAN AQILA', off: 1, level: 3, oktRow: 8 },
  { row: 9,  name: 'NUR AQSAL',        off: 1, level: 1, oktRow: 13 },
  { row: 10, name: 'RENDI SAPUTRA',    off: 1, level: 2, oktRow: 12 },
  { row: 11, name: 'WIBI ANDRIANSYAH', off: 2, level: 1, oktRow: 11 },
  { row: 12, name: 'AFUANI HUYAN',     off: 2, level: 2, oktRow: 10 },
  { row: 13, name: 'ANDRE OKTAVIANTO', off: 2, level: 3, oktRow: 9 }
];

function colLetter(colIdx) {
  let temp, letter = '';
  while (colIdx > 0) {
    temp = (colIdx - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIdx = Math.floor((colIdx - temp - 1) / 26);
  }
  return letter;
}

rosterNov.forEach(emp => {
  const r = emp.row;
  wsNov['A' + r] = { t: 's', v: emp.name };
  wsNov['B' + r] = { t: 'n', v: emp.off };
  wsNov['C' + r] = { t: 'n', v: emp.level };
  
  const firstOffDate = emp.off === 1 ? '2026-11-02' : '2026-11-03';
  wsNov['D' + r] = {
    t: 's',
    v: firstOffDate,
    f: `DATE(2026,11,1)+MOD(B${r}-WEEKDAY(DATE(2026,11,1),2),7)`
  };
  
  let masukCount = 0;
  let s1Count = 0;
  let s2Count = 0;
  let s3Count = 0;
  let offCount = 0;

  for (let d = 1; d <= 30; d++) {
    const colIdx = d + 4; // 1 -> E
    const colStr = colLetter(colIdx);
    const dt = new Date(2026, 10, d);
    const dow = dt.getDay();
    const dowMondayBased = dow === 0 ? 7 : dow;
    
    const cellRef = colStr + r;
    const formula = `IF(WEEKDAY(${colStr}$7,2)=$B${r},"OFF",IF(${colStr}$7<$D${r},$C${r},MOD($C${r}-2-INT((${colStr}$7-$D${r})/7),3)+1))`;
    
    let val;
    if (dowMondayBased === emp.off) {
      val = 'OFF';
      offCount++;
    } else {
      const firstOffDay = emp.off === 1 ? 2 : 3;
      if (d < firstOffDay) {
        val = emp.level;
      } else {
        const weeksSince = Math.floor((d - firstOffDay) / 7);
        let v = (emp.level - 2 - weeksSince) % 3;
        if (v < 0) v += 3;
        val = v + 1;
      }
      masukCount++;
      if (val === 1) s1Count++;
      if (val === 2) s2Count++;
      if (val === 3) s3Count++;
    }
    
    wsNov[cellRef] = {
      t: val === 'OFF' ? 's' : 'n',
      v: val,
      f: formula
    };
  }

  wsNov['AI' + r] = { t: 'n', v: masukCount, f: `COUNTIF(E${r}:AH${r},"<>OFF")` };
  wsNov['AJ' + r] = { t: 'n', v: s1Count, f: `COUNTIF(E${r}:AH${r},1)` };
  wsNov['AK' + r] = { t: 'n', v: s2Count, f: `COUNTIF(E${r}:AH${r},2)` };
  wsNov['AL' + r] = { t: 'n', v: s3Count, f: `COUNTIF(E${r}:AH${r},3)` };
  wsNov['AM' + r] = { t: 'n', v: offCount, f: `COUNTIF(E${r}:AH${r},"OFF")` };
  wsNov['AN' + r] = { t: 'n', v: s3Count * 35000, f: `AL${r}*35000` };
});

// 2. UPDATE 'REKAP GAJIAN 28 NOV'
const wsRekap = wb.Sheets['REKAP GAJIAN 28 NOV'];

rosterNov.forEach((emp, idx) => {
  const rekapRow = idx + 6;
  const novRow = emp.row;
  const oktRow = emp.oktRow;
  
  wsRekap['A' + rekapRow] = { t: 'n', v: idx + 1 };
  wsRekap['B' + rekapRow] = { t: 's', v: emp.name };
  
  wsRekap['C' + rekapRow] = {
    t: 'n',
    v: 10,
    f: `COUNTIF('OKTOBER 2026'!X${oktRow}:AI${oktRow},"<>OFF")`
  };
  
  wsRekap['D' + rekapRow] = {
    t: 'n',
    v: 16,
    f: `COUNTIF('NOVEMBER 2026'!E${novRow}:W${novRow},"<>OFF")`
  };
  
  wsRekap['E' + rekapRow] = {
    t: 'n',
    v: 26,
    f: `C${rekapRow}+D${rekapRow}`
  };
  
  const wsOkt = wb.Sheets['OKTOBER 2026'];
  let s3Okt = 0;
  for (let c = 24; c <= 35; c++) {
    const col = colLetter(c);
    if (wsOkt[col + oktRow] && wsOkt[col + oktRow].v === 3) s3Okt++;
  }
  wsRekap['F' + rekapRow] = {
    t: 'n',
    v: s3Okt,
    f: `COUNTIF('OKTOBER 2026'!X${oktRow}:AI${oktRow},3)`
  };
  
  let s3Nov = 0;
  for (let c = 5; c <= 23; c++) {
    const col = colLetter(c);
    if (wsNov[col + novRow] && wsNov[col + novRow].v === 3) s3Nov++;
  }
  wsRekap['G' + rekapRow] = {
    t: 'n',
    v: s3Nov,
    f: `COUNTIF('NOVEMBER 2026'!E${novRow}:W${novRow},3)`
  };
  
  wsRekap['H' + rekapRow] = {
    t: 'n',
    v: s3Okt + s3Nov,
    f: `F${rekapRow}+G${rekapRow}`
  };
  
  wsRekap['I' + rekapRow] = {
    t: 'n',
    v: (s3Okt + s3Nov) * 35000,
    f: `H${rekapRow}*35000`
  };
  
  wsRekap['J' + rekapRow] = { t: 's', v: 'ADIL & MERATA' };
});

xlsx.writeFile(wb, filePath);
console.log('Successfully written and updated workbook at:', filePath);
