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

const rosterOkt = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 3 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 3 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 1 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 1 },
  { name: 'AFUANI HUYAN',     off: 2, init: 2 },
  { name: 'NUR AQSAL',        off: 1, init: 2 }
];

const rosterNov = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 2 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 2 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 3 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 3 },
  { name: 'AFUANI HUYAN',     off: 2, init: 1 },
  { name: 'NUR AQSAL',        off: 1, init: 1 }
];

const rosterDes = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 3 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 1 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 2 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 2 },
  { name: 'AFUANI HUYAN',     off: 2, init: 3 },
  { name: 'NUR AQSAL',        off: 1, init: 1 }
];

// Helper to fill a monthly block into ws at a specific startRow
function addMonthBlock(ws, startRow, year, monthIndex, monthNameUpper, roster) {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  // Title rows
  ws[`A${startRow}`] = { t: 's', v: `ADM. SO - ${monthNameUpper} ${year}` };
  ws[`A${startRow + 1}`] = { t: 's', v: 'Tanggal mulai (start_date):' };
  ws[`B${startRow + 1}`] = { t: 's', v: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01` };
  ws[`A${startRow + 2}`] = { t: 's', v: 'Legend: sel BIRU = input yang boleh diubah (hari libur & level shift awal tiap pegawai).' };
  ws[`A${startRow + 3}`] = { t: 's', v: 'Kode hari libur: 1 = Senin, 2 = Selasa. Kolom D = tanggal OFF pertama (otomatis).' };
  ws[`A${startRow + 4}`] = { t: 's', v: 'Logika: shift tetap di LEVEL AWAL sampai OFF pertama. Setelah tiap OFF, shift turun 1.' };

  const headerRow = startRow + 6;
  ws[`A${headerRow}`] = { t: 's', v: 'NAMA' };
  ws[`B${headerRow}`] = { t: 's', v: 'OFF' };
  ws[`C${headerRow}`] = { t: 's', v: 'SHIFT AWAL' };
  ws[`D${headerRow}`] = { t: 's', v: 'OFF PERTAMA (auto)' };

  for (let d = 1; d <= 31; d++) {
    const col = colLetter(d + 4);
    if (d <= totalDays) {
      ws[`${col}${headerRow}`] = { t: 's', v: formatDateHeader(year, monthIndex, d) };
    } else {
      ws[`${col}${headerRow}`] = { t: 's', v: '-' };
    }
  }

  // Summary headers (cols 36 to 41: AJ to AO)
  ws['AJ' + headerRow] = { t: 's', v: 'TOTAL MASUK' };
  ws['AK' + headerRow] = { t: 's', v: 'SHIFT 1' };
  ws['AL' + headerRow] = { t: 's', v: 'SHIFT 2' };
  ws['AM' + headerRow] = { t: 's', v: 'SHIFT 3' };
  ws['AN' + headerRow] = { t: 's', v: 'TOTAL OFF' };
  ws['AO' + headerRow] = { t: 's', v: 'ALLOWANCE S3 (RP 35.000)' };

  roster.forEach((emp, idx) => {
    const r = headerRow + 1 + idx;
    ws[`A${r}`] = { t: 's', v: emp.name };
    ws[`B${r}`] = { t: 'n', v: emp.off };
    ws[`C${r}`] = { t: 'n', v: emp.init };

    // Column D: OFF PERTAMA
    const firstOffDow = new Date(year, monthIndex, 1).getDay();
    const firstOffDowMonBased = firstOffDow === 0 ? 7 : firstOffDow;
    const daysToAdd = ((emp.off - firstOffDowMonBased) % 7 + 7) % 7;
    const firstOffDateObj = new Date(year, monthIndex, 1 + daysToAdd);
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const autoFirstOffStr = `${dayNames[firstOffDateObj.getDay()]}, ${String(firstOffDateObj.getDate()).padStart(2, '0')} ${monthNames[monthIndex]} ${year}`;
    
    ws[`D${r}`] = {
      t: 's',
      v: autoFirstOffStr,
      f: `DATE(${year},${monthIndex + 1},1)+MOD(B${r}-WEEKDAY(DATE(${year},${monthIndex + 1},1),2),7)`
    };

    let countMasuk = 0, countS1 = 0, countS2 = 0, countS3 = 0, countOff = 0;

    for (let d = 1; d <= 31; d++) {
      const colStr = colLetter(d + 4);
      if (d <= totalDays) {
        const dt = new Date(year, monthIndex, d);
        const dowMonBased = dt.getDay() === 0 ? 7 : dt.getDay();
        const formula = `IF(WEEKDAY(${colStr}$${headerRow},2)=$B${r},"OFF",IF(${colStr}$${headerRow}<$D${r},$C${r},MOD($C${r}-2-INT((${colStr}$${headerRow}-$D${r})/7),3)+1))`;

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
      } else {
        ws[`${colStr}${r}`] = { t: 's', v: '-' };
      }
    }

    const endColStr = colLetter(totalDays + 4);
    ws[`AJ${r}`] = { t: 'n', v: countMasuk, f: `COUNTIF(E${r}:${endColStr}${r},"<>OFF")` };
    ws[`AK${r}`] = { t: 'n', v: countS1, f: `COUNTIF(E${r}:${endColStr}${r},1)` };
    ws[`AL${r}`] = { t: 'n', v: countS2, f: `COUNTIF(E${r}:${endColStr}${r},2)` };
    ws[`AM${r}`] = { t: 'n', v: countS3, f: `COUNTIF(E${r}:${endColStr}${r},3)` };
    ws[`AN${r}`] = { t: 'n', v: countOff, f: `COUNTIF(E${r}:${endColStr}${r},"OFF")` };
    ws[`AO${r}`] = { t: 'n', v: countS3 * 35000, f: `AM${r}*35000` };
  });

  return headerRow + 1 + roster.length; // Returns the next available row index
}

// Build the single STACKED MASTER SHEET: Oktober -> November -> Desember
const wsStacked = {};

// 1. Oktober (Rows 1 to 14)
const endOktRow = addMonthBlock(wsStacked, 1, 2026, 9, 'OKTOBER', rosterOkt);

// 2. November (Rows 16 to 29)
const startNovRow = endOktRow + 2;
const endNovRow = addMonthBlock(wsStacked, startNovRow, 2026, 10, 'NOVEMBER', rosterNov);

// 3. Desember (Rows 31 to 44)
const startDesRow = endNovRow + 2;
const endDesRow = addMonthBlock(wsStacked, startDesRow, 2026, 11, 'DESEMBER', rosterDes);

// 4. Rekap Gajian at the bottom
const startRekapRow = endDesRow + 3;
wsStacked[`A${startRekapRow}`] = { t: 's', v: 'REKAP GAJIAN & ALLOWANCE SHIFT 3 (PERIODE CUT-OFF 28 NOV & 28 DES 2026)' };
wsStacked[`A${startRekapRow + 1}`] = { t: 's', v: 'Tarif Allowance Shift 3 = Rp 35.000 / shift' };

const rkH = startRekapRow + 3;
wsStacked[`A${rkH}`] = { t: 's', v: 'NO' };
wsStacked[`B${rkH}`] = { t: 's', v: 'NAMA ADMIN' };
wsStacked[`C${rkH}`] = { t: 's', v: 'HK (20 OKT - 19 NOV)' };
wsStacked[`D${rkH}`] = { t: 's', v: 'S3 (20 OKT - 19 NOV)' };
wsStacked[`E${rkH}`] = { t: 's', v: 'ALLOWANCE 28 NOV (RP)' };
wsStacked[`F${rkH}`] = { t: 's', v: 'HK (20 NOV - 19 DES)' };
wsStacked[`G${rkH}`] = { t: 's', v: 'S3 (20 NOV - 19 DES)' };
wsStacked[`H${rkH}`] = { t: 's', v: 'ALLOWANCE 28 DES (RP)' };
wsStacked[`I${rkH}`] = { t: 's', v: 'STATUS' };

rosterNov.forEach((emp, i) => {
  const r = rkH + 1 + i;
  const oktRow = 8 + i;
  const novRow = startNovRow + 7 + i;
  const desRow = startDesRow + 7 + i;

  wsStacked[`A${r}`] = { t: 'n', v: i + 1 };
  wsStacked[`B${r}`] = { t: 's', v: emp.name };

  // Cut-Off 28 Nov: 20-31 Okt (cols X to AI) + 01-19 Nov (cols E to W)
  wsStacked[`C${r}`] = {
    t: 'n',
    v: 26,
    f: `COUNTIF(X${oktRow}:AI${oktRow},"<>OFF")+COUNTIF(E${novRow}:W${novRow},"<>OFF")`
  };
  wsStacked[`D${r}`] = {
    t: 'n',
    v: (i === 0 || i === 1) ? 12 : (i === 2) ? 8 : (i === 3) ? 9 : 6,
    f: `COUNTIF(X${oktRow}:AI${oktRow},3)+COUNTIF(E${novRow}:W${novRow},3)`
  };
  wsStacked[`E${r}`] = {
    t: 'n',
    v: wsStacked[`D${r}`].v * 35000,
    f: `D${r}*35000`
  };

  // Cut-Off 28 Des: 20-30 Nov (cols X to AH) + 01-19 Des (cols E to W)
  wsStacked[`F${r}`] = {
    t: 'n',
    v: 25,
    f: `COUNTIF(X${novRow}:AH${novRow},"<>OFF")+COUNTIF(E${desRow}:W${desRow},"<>OFF")`
  };
  wsStacked[`G${r}`] = {
    t: 'n',
    v: (i === 0 || i === 1) ? 6 : (i === 2) ? 10 : (i === 3) ? 8 : 10,
    f: `COUNTIF(X${novRow}:AH${novRow},3)+COUNTIF(E${desRow}:W${desRow},3)`
  };
  wsStacked[`H${r}`] = {
    t: 'n',
    v: wsStacked[`G${r}`].v * 35000,
    f: `G${r}*35000`
  };

  wsStacked[`I${r}`] = { t: 's', v: 'ADIL & MERATA' };
});

const lastRow = rkH + 1 + rosterNov.length;
wsStacked['!ref'] = `A1:AO${lastRow}`;

// Load existing workbook to preserve standalone sheets
const existingWb = xlsx.readFile(targetPath);

const newWb = xlsx.utils.book_new();

// Set the STACKED sheet as the FIRST sheet!
xlsx.utils.book_append_sheet(newWb, wsStacked, 'OKT - NOV - DES (MENURUN)');

// Append individual monthly sheets:
['OKTOBER 2026', 'NOVEMBER 2026', 'DESEMBER 2026', 'REKAP GAJIAN 28 NOV', 'REKAP GAJIAN 28 DES', 'NOV 2026 (MENURUN)', 'OKT 2026 (MENURUN)', 'DES 2026 (MENURUN)'].forEach(sName => {
  if (existingWb.Sheets[sName]) {
    xlsx.utils.book_append_sheet(newWb, existingWb.Sheets[sName], sName);
  }
});

xlsx.writeFile(newWb, targetPath);
console.log('Successfully created stacked sheet OKT - NOV - DES (MENURUN) in:', targetPath);
