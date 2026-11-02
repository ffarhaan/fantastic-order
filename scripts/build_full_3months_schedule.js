const xlsx = require('xlsx');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../JADWAL_ADMIN_DAN_REKAP_GAJIAN_28_NOV.xlsx');

function colLetter(colIdx) {
  let temp, letter = '';
  while (colIdx > 0) {
    temp = (colIdx - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIdx = Math.floor((colIdx - temp - 1) / 26);
  }
  return letter;
}

function formatDateHeader(year, monthIndex, day) {
  const dt = new Date(year, monthIndex, day);
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dd = String(day).padStart(2, '0');
  return `${dayNames[dt.getDay()]}, ${dd} ${monthNames[monthIndex]} ${year}`;
}

function buildMonthSheet(year, monthIndex, monthNameUpper, roster) {
  const ws = {};
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  
  // Title & Info Rows
  ws['A1'] = { t: 's', v: `ADM. SO - ${monthNameUpper} ${year}` };
  ws['A2'] = { t: 's', v: 'Tanggal mulai (start_date):' };
  ws['B2'] = { t: 's', v: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01` };
  ws['A3'] = { t: 's', v: 'Legend: sel BIRU = input yang boleh diubah (hari libur & level shift awal tiap pegawai).' };
  ws['A4'] = { t: 's', v: 'Kode hari libur: 1 = Senin, 2 = Selasa. Kolom D = tanggal OFF pertama (otomatis).' };
  ws['A5'] = { t: 's', v: 'Logika: shift tetap di LEVEL AWAL sampai OFF pertama. Setelah tiap OFF, shift turun 1.' };

  // Headers on Row 7
  ws['A7'] = { t: 's', v: 'NAMA' };
  ws['B7'] = { t: 's', v: 'OFF' };
  ws['C7'] = { t: 's', v: 'SHIFT AWAL' };
  ws['D7'] = { t: 's', v: 'OFF PERTAMA (auto)' };

  for (let d = 1; d <= totalDays; d++) {
    const col = colLetter(d + 4);
    ws[`${col}7`] = { t: 's', v: formatDateHeader(year, monthIndex, d) };
  }

  const endColIdx = totalDays + 4;
  ws[`${colLetter(endColIdx + 1)}7`] = { t: 's', v: 'TOTAL MASUK' };
  ws[`${colLetter(endColIdx + 2)}7`] = { t: 's', v: 'SHIFT 1' };
  ws[`${colLetter(endColIdx + 3)}7`] = { t: 's', v: 'SHIFT 2' };
  ws[`${colLetter(endColIdx + 4)}7`] = { t: 's', v: 'SHIFT 3' };
  ws[`${colLetter(endColIdx + 5)}7`] = { t: 's', v: 'TOTAL OFF' };
  ws[`${colLetter(endColIdx + 6)}7`] = { t: 's', v: 'ALLOWANCE S3 (RP 35.000)' };

  // Employee Rows (8 to 13)
  roster.forEach((emp, idx) => {
    const r = idx + 8;
    ws[`A${r}`] = { t: 's', v: emp.name };
    ws[`B${r}`] = { t: 'n', v: emp.off };
    ws[`C${r}`] = { t: 'n', v: emp.init };

    // Auto First OFF Date (Column D)
    const formulaD = `DATE(${year},${monthIndex + 1},1)+MOD(B${r}-WEEKDAY(DATE(${year},${monthIndex + 1},1),2),7)`;
    const firstOffDow = new Date(year, monthIndex, 1).getDay(); // 0=Sun, 1=Mon, 2=Tue
    const firstOffDowMonBased = firstOffDow === 0 ? 7 : firstOffDow;
    const daysToAdd = ((emp.off - firstOffDowMonBased) % 7 + 7) % 7;
    const firstOffDateObj = new Date(year, monthIndex, 1 + daysToAdd);
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const autoFirstOffStr = `${dayNames[firstOffDateObj.getDay()]}, ${String(firstOffDateObj.getDate()).padStart(2, '0')} ${monthNames[monthIndex]} ${year}`;
    
    ws[`D${r}`] = { t: 's', v: autoFirstOffStr, f: formulaD };

    let countMasuk = 0, countS1 = 0, countS2 = 0, countS3 = 0, countOff = 0;

    for (let d = 1; d <= totalDays; d++) {
      const colStr = colLetter(d + 4);
      const dt = new Date(year, monthIndex, d);
      const dowMonBased = dt.getDay() === 0 ? 7 : dt.getDay();
      
      const formula = `IF(WEEKDAY(${colStr}$7,2)=$B${r},"OFF",IF(${colStr}$7<$D${r},$C${r},MOD($C${r}-2-INT((${colStr}$7-$D${r})/7),3)+1))`;
      
      let val;
      if (dowMonBased === emp.off) {
        val = 'OFF';
        countOff++;
      } else {
        const firstOffDayNumber = 1 + daysToAdd;
        if (d < firstOffDayNumber) {
          val = emp.init;
        } else {
          const weeksSince = Math.floor((d - firstOffDayNumber) / 7);
          let v = emp.init - 2 - weeksSince;
          v = ((v % 3) + 3) % 3;
          val = v + 1;
        }
        countMasuk++;
        if (val === 1) countS1++;
        if (val === 2) countS2++;
        if (val === 3) countS3++;
      }

      ws[`${colStr}${r}`] = {
        t: val === 'OFF' ? 's' : 'n',
        v: val,
        f: formula
      };
    }

    const startCol = 'E';
    const endCol = colLetter(endColIdx);
    const cTotal = colLetter(endColIdx + 1);
    const cS1 = colLetter(endColIdx + 2);
    const cS2 = colLetter(endColIdx + 3);
    const cS3 = colLetter(endColIdx + 4);
    const cOff = colLetter(endColIdx + 5);
    const cAllow = colLetter(endColIdx + 6);

    ws[`${cTotal}${r}`] = { t: 'n', v: countMasuk, f: `COUNTIF(${startCol}${r}:${endCol}${r},"<>OFF")` };
    ws[`${cS1}${r}`] = { t: 'n', v: countS1, f: `COUNTIF(${startCol}${r}:${endCol}${r},1)` };
    ws[`${cS2}${r}`] = { t: 'n', v: countS2, f: `COUNTIF(${startCol}${r}:${endCol}${r},2)` };
    ws[`${cS3}${r}`] = { t: 'n', v: countS3, f: `COUNTIF(${startCol}${r}:${endCol}${r},3)` };
    ws[`${cOff}${r}`] = { t: 'n', v: countOff, f: `COUNTIF(${startCol}${r}:${endCol}${r},"OFF")` };
    ws[`${cAllow}${r}`] = { t: 'n', v: countS3 * 35000, f: `${cS3}${r}*35000` };
  });

  ws['!ref'] = `A1:${colLetter(endColIdx + 6)}13`;
  return ws;
}

// 1. Build OKTOBER 2026
const rosterOkt = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 3 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 3 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 1 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 1 },
  { name: 'AFUANI HUYAN',     off: 2, init: 2 },
  { name: 'NUR AQSAL',        off: 1, init: 2 }
];
const wsOkt = buildMonthSheet(2026, 9, 'OKTOBER', rosterOkt);

// 2. Build NOVEMBER 2026 (matches exact user uploaded image)
const rosterNov = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 2 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 2 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 3 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 3 },
  { name: 'AFUANI HUYAN',     off: 2, init: 1 },
  { name: 'NUR AQSAL',        off: 1, init: 1 }
];
const wsNov = buildMonthSheet(2026, 10, 'NOVEMBER', rosterNov);

// 3. Build DESEMBER 2026
const rosterDes = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 3 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 1 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 2 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 2 },
  { name: 'AFUANI HUYAN',     off: 2, init: 3 },
  { name: 'NUR AQSAL',        off: 1, init: 1 }
];
const wsDes = buildMonthSheet(2026, 11, 'DESEMBER', rosterDes);

// 4. Build REKAP CUT-OFF 28 NOV (20 Okt - 19 Nov)
const wsRekapNov = {};
wsRekapNov['A1'] = { t: 's', v: 'REKAP GAJIAN & ALLOWANCE SHIFT 3 (PERIODE CUT-OFF: 20 OKTOBER - 19 NOVEMBER 2026)' };
wsRekapNov['A2'] = { t: 's', v: 'Tanggal Gajian: 28 November 2026 | Tarif Allowance Shift 3: Rp 35.000 / shift' };
wsRekapNov['A3'] = { t: 's', v: 'Data otomatis terhubung langsung dari Tab OKTOBER dan Tab NOVEMBER' };

wsRekapNov['A5'] = { t: 's', v: 'NO' };
wsRekapNov['B5'] = { t: 's', v: 'NAMA ADMIN' };
wsRekapNov['C5'] = { t: 's', v: 'HARI KERJA (20-31 OKT)' };
wsRekapNov['D5'] = { t: 's', v: 'HARI KERJA (01-19 NOV)' };
wsRekapNov['E5'] = { t: 's', v: 'TOTAL HK (CUT-OFF)' };
wsRekapNov['F5'] = { t: 's', v: 'SHIFT 3 (20-31 OKT)' };
wsRekapNov['G5'] = { t: 's', v: 'SHIFT 3 (01-19 NOV)' };
wsRekapNov['H5'] = { t: 's', v: 'TOTAL SHIFT 3 (CUT-OFF)' };
wsRekapNov['I5'] = { t: 's', v: 'TOTAL ALLOWANCE S3 (RP)' };
wsRekapNov['J5'] = { t: 's', v: 'STATUS' };

rosterNov.forEach((emp, idx) => {
  const r = idx + 6;
  const novRow = idx + 8;
  const oktRow = idx + 8; // same row order!
  
  wsRekapNov[`A${r}`] = { t: 'n', v: idx + 1 };
  wsRekapNov[`B${r}`] = { t: 's', v: emp.name };
  wsRekapNov[`C${r}`] = { t: 'n', v: 10, f: `COUNTIF('OKTOBER 2026'!X${oktRow}:AI${oktRow},"<>OFF")` };
  wsRekapNov[`D${r}`] = { t: 'n', v: 16, f: `COUNTIF('NOVEMBER 2026'!E${novRow}:W${novRow},"<>OFF")` };
  wsRekapNov[`E${r}`] = { t: 'n', v: 26, f: `C${r}+D${r}` };
  
  // Calculate exact S3 in both ranges:
  let s3Okt = 0;
  for (let c = 24; c <= 35; c++) {
    const col = colLetter(c);
    if (wsOkt[col + oktRow] && wsOkt[col + oktRow].v === 3) s3Okt++;
  }
  let s3Nov = 0;
  for (let c = 5; c <= 23; c++) {
    const col = colLetter(c);
    if (wsNov[col + novRow] && wsNov[col + novRow].v === 3) s3Nov++;
  }
  
  wsRekapNov[`F${r}`] = { t: 'n', v: s3Okt, f: `COUNTIF('OKTOBER 2026'!X${oktRow}:AI${oktRow},3)` };
  wsRekapNov[`G${r}`] = { t: 'n', v: s3Nov, f: `COUNTIF('NOVEMBER 2026'!E${novRow}:W${novRow},3)` };
  wsRekapNov[`H${r}`] = { t: 'n', v: s3Okt + s3Nov, f: `F${r}+G${r}` };
  wsRekapNov[`I${r}`] = { t: 'n', v: (s3Okt + s3Nov) * 35000, f: `H${r}*35000` };
  wsRekapNov[`J${r}`] = { t: 's', v: 'ADIL & MERATA' };
});

wsRekapNov['B12'] = { t: 's', v: 'TOTAL KESELURUHAN' };
wsRekapNov['C12'] = { t: 'n', v: 60, f: 'SUM(C6:C11)' };
wsRekapNov['D12'] = { t: 'n', v: 96, f: 'SUM(D6:D11)' };
wsRekapNov['E12'] = { t: 'n', v: 156, f: 'SUM(E6:E11)' };
wsRekapNov['F12'] = { t: 'n', f: 'SUM(F6:F11)' };
wsRekapNov['G12'] = { t: 'n', f: 'SUM(G6:G11)' };
wsRekapNov['H12'] = { t: 'n', f: 'SUM(H6:H11)' };
wsRekapNov['I12'] = { t: 'n', f: 'SUM(I6:I11)' };
wsRekapNov['!ref'] = 'A1:J12';

// 5. Build REKAP CUT-OFF 28 DES (20 Nov - 19 Des)
const wsRekapDes = {};
wsRekapDes['A1'] = { t: 's', v: 'REKAP GAJIAN & ALLOWANCE SHIFT 3 (PERIODE CUT-OFF: 20 NOVEMBER - 19 DESEMBER 2026)' };
wsRekapDes['A2'] = { t: 's', v: 'Tanggal Gajian: 28 Desember 2026 | Tarif Allowance Shift 3: Rp 35.000 / shift' };
wsRekapDes['A3'] = { t: 's', v: 'Data otomatis terhubung langsung dari Tab NOVEMBER dan Tab DESEMBER' };

wsRekapDes['A5'] = { t: 's', v: 'NO' };
wsRekapDes['B5'] = { t: 's', v: 'NAMA ADMIN' };
wsRekapDes['C5'] = { t: 's', v: 'HARI KERJA (20-30 NOV)' };
wsRekapDes['D5'] = { t: 's', v: 'HARI KERJA (01-19 DES)' };
wsRekapDes['E5'] = { t: 's', v: 'TOTAL HK (CUT-OFF)' };
wsRekapDes['F5'] = { t: 's', v: 'SHIFT 3 (20-30 NOV)' };
wsRekapDes['G5'] = { t: 's', v: 'SHIFT 3 (01-19 DES)' };
wsRekapDes['H5'] = { t: 's', v: 'TOTAL SHIFT 3 (CUT-OFF)' };
wsRekapDes['I5'] = { t: 's', v: 'TOTAL ALLOWANCE S3 (RP)' };
wsRekapDes['J5'] = { t: 's', v: 'STATUS' };

rosterDes.forEach((emp, idx) => {
  const r = idx + 6;
  const desRow = idx + 8;
  const novRow = idx + 8;
  
  wsRekapDes[`A${r}`] = { t: 'n', v: idx + 1 };
  wsRekapDes[`B${r}`] = { t: 's', v: emp.name };
  wsRekapDes[`C${r}`] = { t: 'n', v: 9, f: `COUNTIF('NOVEMBER 2026'!X${novRow}:AH${novRow},"<>OFF")` };
  wsRekapDes[`D${r}`] = { t: 'n', v: 16, f: `COUNTIF('DESEMBER 2026'!E${desRow}:W${desRow},"<>OFF")` };
  wsRekapDes[`E${r}`] = { t: 'n', v: 25, f: `C${r}+D${r}` };
  
  let s3Nov = 0;
  for (let c = 24; c <= 34; c++) {
    const col = colLetter(c);
    if (wsNov[col + novRow] && wsNov[col + novRow].v === 3) s3Nov++;
  }
  let s3Des = 0;
  for (let c = 5; c <= 23; c++) {
    const col = colLetter(c);
    if (wsDes[col + desRow] && wsDes[col + desRow].v === 3) s3Des++;
  }
  
  wsRekapDes[`F${r}`] = { t: 'n', v: s3Nov, f: `COUNTIF('NOVEMBER 2026'!X${novRow}:AH${novRow},3)` };
  wsRekapDes[`G${r}`] = { t: 'n', v: s3Des, f: `COUNTIF('DESEMBER 2026'!E${desRow}:W${desRow},3)` };
  wsRekapDes[`H${r}`] = { t: 'n', v: s3Nov + s3Des, f: `F${r}+G${r}` };
  wsRekapDes[`I${r}`] = { t: 'n', v: (s3Nov + s3Des) * 35000, f: `H${r}*35000` };
  wsRekapDes[`J${r}`] = { t: 's', v: 'ADIL & MERATA' };
});

wsRekapDes['B12'] = { t: 's', v: 'TOTAL KESELURUHAN' };
wsRekapDes['C12'] = { t: 'n', f: 'SUM(C6:C11)' };
wsRekapDes['D12'] = { t: 'n', f: 'SUM(D6:D11)' };
wsRekapDes['E12'] = { t: 'n', f: 'SUM(E6:E11)' };
wsRekapDes['F12'] = { t: 'n', f: 'SUM(F6:F11)' };
wsRekapDes['G12'] = { t: 'n', f: 'SUM(G6:G11)' };
wsRekapDes['H12'] = { t: 'n', f: 'SUM(H6:H11)' };
wsRekapDes['I12'] = { t: 'n', f: 'SUM(I6:I11)' };
wsRekapDes['!ref'] = 'A1:J12';

// Create Workbook
const wbNew = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbNew, wsNov, 'NOVEMBER 2026');
xlsx.utils.book_append_sheet(wbNew, wsOkt, 'OKTOBER 2026');
xlsx.utils.book_append_sheet(wbNew, wsDes, 'DESEMBER 2026');
xlsx.utils.book_append_sheet(wbNew, wsRekapNov, 'REKAP GAJIAN 28 NOV');
xlsx.utils.book_append_sheet(wbNew, wsRekapDes, 'REKAP GAJIAN 28 DES');

xlsx.writeFile(wbNew, targetPath);
console.log('Successfully written full 3-month schedule to:', targetPath);
