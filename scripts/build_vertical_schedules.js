const xlsx = require('xlsx');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../JADWAL_ADMIN_DAN_REKAP_GAJIAN_28_NOV.xlsx');
console.log('Target file:', targetPath);

function colLetter(colIdx) {
  let temp, letter = '';
  while (colIdx > 0) {
    temp = (colIdx - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIdx = Math.floor((colIdx - temp - 1) / 26);
  }
  return letter;
}

const rosterNov = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 2 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 2 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 3 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 3 },
  { name: 'AFUANI HUYAN',     off: 2, init: 1 },
  { name: 'NUR AQSAL',        off: 1, init: 1 }
];

const rosterOkt = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 3 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 3 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 1 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 1 },
  { name: 'AFUANI HUYAN',     off: 2, init: 2 },
  { name: 'NUR AQSAL',        off: 1, init: 2 }
];

const rosterDes = [
  { name: 'NUR FARHAN AQILA', off: 1, init: 3 },
  { name: 'WIBI ANDRIANSYAH', off: 2, init: 1 },
  { name: 'RENDI SAPUTRA',    off: 2, init: 2 },
  { name: 'ANDRE OKTAVIANTO', off: 1, init: 2 },
  { name: 'AFUANI HUYAN',     off: 2, init: 3 },
  { name: 'NUR AQSAL',        off: 1, init: 1 }
];

function buildVerticalMonthSheet(year, monthIndex, monthNameUpper, roster) {
  const ws = {};
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  // Row 1: Title
  ws['A1'] = { t: 's', v: `JADWAL ADM SO - ${monthNameUpper} ${year} (FORMAT MENURUN)` };

  // Row 2: Shift Awal
  ws['C2'] = { t: 's', v: 'SHIFT AWAL:' };
  // Row 3: Hari OFF
  ws['C3'] = { t: 's', v: 'HARI OFF (1=Sen, 2=Sel):' };
  // Row 4: OFF Pertama
  ws['C4'] = { t: 's', v: 'OFF PERTAMA (auto):' };

  roster.forEach((emp, i) => {
    const col = colLetter(i + 4); // D, E, F, G, H, I
    ws[`${col}2`] = { t: 'n', v: emp.init };
    ws[`${col}3`] = { t: 'n', v: emp.off };

    const firstOffDow = new Date(year, monthIndex, 1).getDay();
    const firstOffDowMonBased = firstOffDow === 0 ? 7 : firstOffDow;
    const daysToAdd = ((emp.off - firstOffDowMonBased) % 7 + 7) % 7;
    const firstOffDateObj = new Date(year, monthIndex, 1 + daysToAdd);
    const mStr = String(monthIndex + 1).padStart(2, '0');
    const dStr = String(firstOffDateObj.getDate()).padStart(2, '0');
    const firstOffFormatted = `${year}-${mStr}-${dStr}`;

    ws[`${col}4`] = {
      t: 's',
      v: firstOffFormatted,
      f: `DATE(${year},${monthIndex + 1},1)+MOD(${col}$3-WEEKDAY(DATE(${year},${monthIndex + 1},1),2),7)`
    };
  });

  // Row 5: Column Headers
  ws['A5'] = { t: 's', v: 'NO' };
  ws['B5'] = { t: 's', v: 'TANGGAL' };
  ws['C5'] = { t: 's', v: 'HARI' };

  roster.forEach((emp, i) => {
    const col = colLetter(i + 4);
    ws[`${col}5`] = { t: 's', v: emp.name };
  });

  ws['J5'] = { t: 's', v: 'S1 (ORG)' };
  ws['K5'] = { t: 's', v: 'S2 (ORG)' };
  ws['L5'] = { t: 's', v: 'S3 (ORG)' };
  ws['M5'] = { t: 's', v: 'OFF (ORG)' };

  // Data Rows: 6 to (6 + totalDays - 1)
  for (let d = 1; d <= totalDays; d++) {
    const r = d + 5;
    const dt = new Date(year, monthIndex, d);
    const dow = dt.getDay();
    const dowMonBased = dow === 0 ? 7 : dow;
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    ws[`A${r}`] = { t: 'n', v: d };
    ws[`B${r}`] = { t: 's', v: dateStr };
    ws[`C${r}`] = { t: 's', v: dayNames[dow] };

    let countS1 = 0, countS2 = 0, countS3 = 0, countOff = 0;

    roster.forEach((emp, i) => {
      const col = colLetter(i + 4);
      const formula = `IF(WEEKDAY($B${r},2)=${col}$3,"OFF",IF($B${r}<${col}$4,${col}$2,MOD(${col}$2-2-INT(($B${r}-${col}$4)/7),3)+1))`;

      let val;
      if (dowMonBased === emp.off) {
        val = 'OFF';
        countOff++;
      } else {
        const firstOffDow = new Date(year, monthIndex, 1).getDay();
        const firstOffDowMonBased = firstOffDow === 0 ? 7 : firstOffDow;
        const daysToAdd = ((emp.off - firstOffDowMonBased) % 7 + 7) % 7;
        const firstOffDayNumber = 1 + daysToAdd;

        if (d < firstOffDayNumber) {
          val = emp.init;
        } else {
          const weeksSince = Math.floor((d - firstOffDayNumber) / 7);
          let v = emp.init - 2 - weeksSince;
          v = ((v % 3) + 3) % 3;
          val = v + 1;
        }
        if (val === 1) countS1++;
        if (val === 2) countS2++;
        if (val === 3) countS3++;
      }

      ws[`${col}${r}`] = {
        t: val === 'OFF' ? 's' : 'n',
        v: val,
        f: formula
      };
    });

    ws[`J${r}`] = { t: 'n', v: countS1, f: `COUNTIF(D${r}:I${r},1)` };
    ws[`K${r}`] = { t: 'n', v: countS2, f: `COUNTIF(D${r}:I${r},2)` };
    ws[`L${r}`] = { t: 'n', v: countS3, f: `COUNTIF(D${r}:I${r},3)` };
    ws[`M${r}`] = { t: 'n', v: countOff, f: `COUNTIF(D${r}:I${r},"OFF")` };
  }

  const endRow = totalDays + 5;
  const rHK = endRow + 2;
  const rS1 = endRow + 3;
  const rS2 = endRow + 4;
  const rS3 = endRow + 5;
  const rOFF = endRow + 6;
  const rAllow = endRow + 7;

  ws[`C${rHK}`] = { t: 's', v: 'TOTAL HARI KERJA (HK)' };
  ws[`C${rS1}`] = { t: 's', v: 'TOTAL SHIFT 1' };
  ws[`C${rS2}`] = { t: 's', v: 'TOTAL SHIFT 2' };
  ws[`C${rS3}`] = { t: 's', v: 'TOTAL SHIFT 3' };
  ws[`C${rOFF}`] = { t: 's', v: 'TOTAL HARI LIBUR (OFF)' };
  ws[`C${rAllow}`] = { t: 's', v: 'ALLOWANCE S3 (RP 35.000)' };

  roster.forEach((emp, i) => {
    const col = colLetter(i + 4);
    let countS1 = 0, countS2 = 0, countS3 = 0, countOff = 0, countMasuk = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(year, monthIndex, d);
      const dowMonBased = dt.getDay() === 0 ? 7 : dt.getDay();
      if (dowMonBased === emp.off) {
        countOff++;
      } else {
        countMasuk++;
        const firstOffDow = new Date(year, monthIndex, 1).getDay();
        const firstOffDowMonBased = firstOffDow === 0 ? 7 : firstOffDow;
        const daysToAdd = ((emp.off - firstOffDowMonBased) % 7 + 7) % 7;
        const firstOffDayNumber = 1 + daysToAdd;

        let val;
        if (d < firstOffDayNumber) {
          val = emp.init;
        } else {
          const weeksSince = Math.floor((d - firstOffDayNumber) / 7);
          let v = emp.init - 2 - weeksSince;
          v = ((v % 3) + 3) % 3;
          val = v + 1;
        }
        if (val === 1) countS1++;
        if (val === 2) countS2++;
        if (val === 3) countS3++;
      }
    }

    ws[`${col}${rHK}`] = { t: 'n', v: countMasuk, f: `COUNTIF(${col}6:${col}${endRow},"<>OFF")` };
    ws[`${col}${rS1}`] = { t: 'n', v: countS1, f: `COUNTIF(${col}6:${col}${endRow},1)` };
    ws[`${col}${rS2}`] = { t: 'n', v: countS2, f: `COUNTIF(${col}6:${col}${endRow},2)` };
    ws[`${col}${rS3}`] = { t: 'n', v: countS3, f: `COUNTIF(${col}6:${col}${endRow},3)` };
    ws[`${col}${rOFF}`] = { t: 'n', v: countOff, f: `COUNTIF(${col}6:${col}${endRow},"OFF")` };
    ws[`${col}${rAllow}`] = { t: 'n', v: countS3 * 35000, f: `${col}${rS3}*35000` };
  });

  ws['!ref'] = `A1:M${rAllow}`;
  return ws;
}

// Build Continuous 3-Month Sheet (Oktober - Desember = 92 Days)
function buildContinuous3Months(rostersByMonth) {
  const ws = {};
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  ws['A1'] = { t: 's', v: 'JADWAL MASTER ADM SO - OKTOBER S/D DESEMBER 2026 (MENURUN PENUH)' };
  ws['A2'] = { t: 's', v: 'Roster 92 Hari Lengkap dengan Penanda Periode Cut-Off Penggajian' };

  ws['A4'] = { t: 's', v: 'NO' };
  ws['B4'] = { t: 's', v: 'TANGGAL' };
  ws['C4'] = { t: 's', v: 'BULAN' };
  ws['D4'] = { t: 's', v: 'HARI' };
  ws['E4'] = { t: 's', v: 'PERIODE GAJIAN' };

  const rosterOrder = rostersByMonth[10]; // November roster names
  rosterOrder.forEach((emp, i) => {
    const col = colLetter(i + 6); // F, G, H, I, J, K
    ws[`${col}4`] = { t: 's', v: emp.name };
  });

  ws['L4'] = { t: 's', v: 'S1 (ORG)' };
  ws['M4'] = { t: 's', v: 'S2 (ORG)' };
  ws['N4'] = { t: 's', v: 'S3 (ORG)' };
  ws['O4'] = { t: 's', v: 'OFF (ORG)' };

  let rowIdx = 5;
  let globalDayNum = 1;

  [9, 10, 11].forEach(monthIdx => { // 9=Okt, 10=Nov, 11=Des
    const year = 2026;
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    const monthNames = ['', '', '', '', '', '', '', '', '', 'Oktober', 'November', 'Desember'];
    const curRoster = rostersByMonth[monthIdx];

    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(year, monthIdx, d);
      const dow = dt.getDay();
      const dowMonBased = dow === 0 ? 7 : dow;
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      let cutOffLabel = '-';
      if ((monthIdx === 9 && d >= 20) || (monthIdx === 10 && d <= 19)) {
        cutOffLabel = 'Cut-Off 28 Nov';
      } else if ((monthIdx === 10 && d >= 20) || (monthIdx === 11 && d <= 19)) {
        cutOffLabel = 'Cut-Off 28 Des';
      }

      ws[`A${rowIdx}`] = { t: 'n', v: globalDayNum };
      ws[`B${rowIdx}`] = { t: 's', v: dateStr };
      ws[`C${rowIdx}`] = { t: 's', v: monthNames[monthIdx] };
      ws[`D${rowIdx}`] = { t: 's', v: dayNames[dow] };
      ws[`E${rowIdx}`] = { t: 's', v: cutOffLabel };

      let countS1 = 0, countS2 = 0, countS3 = 0, countOff = 0;

      curRoster.forEach((emp, i) => {
        const col = colLetter(i + 6);
        let val;
        if (dowMonBased === emp.off) {
          val = 'OFF';
          countOff++;
        } else {
          const firstOffDow = new Date(year, monthIdx, 1).getDay();
          const firstOffDowMonBased = firstOffDow === 0 ? 7 : firstOffDow;
          const daysToAdd = ((emp.off - firstOffDowMonBased) % 7 + 7) % 7;
          const firstOffDayNumber = 1 + daysToAdd;

          if (d < firstOffDayNumber) {
            val = emp.init;
          } else {
            const weeksSince = Math.floor((d - firstOffDayNumber) / 7);
            let v = emp.init - 2 - weeksSince;
            v = ((v % 3) + 3) % 3;
            val = v + 1;
          }
          if (val === 1) countS1++;
          if (val === 2) countS2++;
          if (val === 3) countS3++;
        }

        ws[`${col}${rowIdx}`] = { t: val === 'OFF' ? 's' : 'n', v: val };
      });

      ws[`L${rowIdx}`] = { t: 'n', v: countS1, f: `COUNTIF(F${rowIdx}:K${rowIdx},1)` };
      ws[`M${rowIdx}`] = { t: 'n', v: countS2, f: `COUNTIF(F${rowIdx}:K${rowIdx},2)` };
      ws[`N${rowIdx}`] = { t: 'n', v: countS3, f: `COUNTIF(F${rowIdx}:K${rowIdx},3)` };
      ws[`O${rowIdx}`] = { t: 'n', v: countOff, f: `COUNTIF(F${rowIdx}:K${rowIdx},"OFF")` };

      rowIdx++;
      globalDayNum++;
    }
  });

  ws['!ref'] = `A1:O${rowIdx - 1}`;
  return ws;
}

// Read existing workbook so horizontal sheets are preserved
const existingWb = xlsx.readFile(targetPath);

// Generate vertical sheets
const wsNovVert = buildVerticalMonthSheet(2026, 10, 'NOVEMBER', rosterNov);
const wsOktVert = buildVerticalMonthSheet(2026, 9, 'OKTOBER', rosterOkt);
const wsDesVert = buildVerticalMonthSheet(2026, 11, 'DESEMBER', rosterDes);

const continuousWs = buildContinuous3Months({
  9: rosterOkt,
  10: rosterNov,
  11: rosterDes
});

// Create comprehensive workbook: vertical sheets FIRST, then continuous, then horizontal
const finalWb = xlsx.utils.book_new();

xlsx.utils.book_append_sheet(finalWb, wsNovVert, 'NOV 2026 (MENURUN)');
xlsx.utils.book_append_sheet(finalWb, wsOktVert, 'OKT 2026 (MENURUN)');
xlsx.utils.book_append_sheet(finalWb, wsDesVert, 'DES 2026 (MENURUN)');
xlsx.utils.book_append_sheet(finalWb, continuousWs, '3 BULAN PENUH (MENURUN)');

// Also preserve horizontal & rekap sheets:
existingWb.SheetNames.forEach(sName => {
  if (!finalWb.SheetNames.includes(sName)) {
    xlsx.utils.book_append_sheet(finalWb, existingWb.Sheets[sName], sName);
  }
});

xlsx.writeFile(finalWb, targetPath);
console.log('Successfully written all vertical sheets to:', targetPath);
