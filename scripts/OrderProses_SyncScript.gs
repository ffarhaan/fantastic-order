/**
 * ====================================================================
 * SINKRONISASI RESMI: SPREADSHEET "REPORT QC 2" (TAB: Rekap Lengkap)
 * FANTASTIC ORDER REAL-TIME SINKRONISASI
 * Kolom: B (No SO), C (Checker), D (Packer), E (Picker)
 * ====================================================================
 */

var WEB_APP_URL = "https://fantastic-order.vercel.app/api/tidb?action=sync_checkers";

/**
 * Helper untuk memastikan sheet yang diproses HANYA "Rekap Lengkap"
 */
function getTargetSheet(ss) {
  // 1. Coba cari nama persis "Rekap Lengkap"
  var s = ss.getSheetByName("Rekap Lengkap");
  if (s) return s;

  // 2. Coba cari berdasarkan GID spesifik (gid=1198696917)
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === 1198696917) {
      return sheets[i];
    }
  }

  // 3. Coba cari case-insensitive "rekap lengkap"
  for (var j = 0; j < sheets.length; j++) {
    var name = sheets[j].getName().trim().toLowerCase();
    if (name === "rekap lengkap" || name.indexOf("rekap lengkap") !== -1) {
      return sheets[j];
    }
  }

  return null;
}

/**
 * 1. SINKRONISASI INSTAN SAAT EDIT (<1 DETIK)
 * Berjalan seketika saat petugas mengetik/mengubah sel di tab "Rekap Lengkap"
 */
function onEditSync(e) {
  try {
    if (!e || !e.range) {
      autoSyncCheckers();
      return;
    }

    var sheet = e.range.getSheet();
    var sheetName = sheet.getName().trim().toLowerCase();
    var sheetId = sheet.getSheetId();

    // STRICT CHECK: Hanya tab "Rekap Lengkap" yang boleh diproses!
    var isRekapLengkap = (sheetName === "rekap lengkap" || sheetName.indexOf("rekap lengkap") !== -1 || sheetId === 1198696917);
    if (!isRekapLengkap) {
      return; // Tolak mentah-mentah jika tab lain
    }

    var startRow = e.range.getRow();
    var numRows = e.range.getNumRows();
    if (startRow + numRows - 1 <= 1) return;

    var actualStart = Math.max(2, startRow);
    var actualNumRows = (startRow + numRows - 1) - actualStart + 1;

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumns(headers);

    var dataRange = sheet.getRange(actualStart, 1, actualNumRows, lastCol).getValues();
    var itemsToSend = [];

    for (var r = 0; r < dataRange.length; r++) {
      var row = dataRange[r];
      var soVal = String(row[colMap.so] || "").trim();
      var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
      var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";
      var pickerVal = colMap.picker >= 0 ? String(row[colMap.picker] || "").trim() : "";

      // Sanitasi nilai agar tidak salah ambil
      packerVal = cleanStaffName(packerVal);
      pickerVal = cleanStaffName(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal)) {
        itemsToSend.push({
          so: soVal,
          checker: checkerVal,
          packer: packerVal,
          picker: pickerVal
        });
      }
    }

    if (itemsToSend.length > 0) {
      UrlFetchApp.fetch(WEB_APP_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ items: itemsToSend }),
        muteHttpExceptions: true
      });
      Logger.log("⚡ Instant sync on edit: " + itemsToSend.length + " baris terkirim.");
    }
  } catch (err) {
    Logger.log("Error onEditSync: " + err);
  }
}

/**
 * 2. SINKRONISASI BATCH (MENYELURUH SETIAP 1 MENIT)
 * Membaca tab Rekap Lengkap dan mengirimkan seluruh SO, Checker, Packer, & Picker
 */
function autoSyncCheckers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getTargetSheet(ss);

    if (!sheet) {
      Logger.log("⚠️ GAGAL: Tab 'Rekap Lengkap' tidak ditemukan di spreadsheet ini.");
      return;
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1) return;

    // Ambil 1000 baris terakhir
    var startRow = Math.max(2, lastRow - 999);
    var numRows = lastRow - startRow + 1;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumns(headers);

    var dataRange = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var itemsToSend = [];

    for (var r = 0; r < dataRange.length; r++) {
      var row = dataRange[r];
      var soVal = String(row[colMap.so] || "").trim();
      var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
      var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";
      var pickerVal = colMap.picker >= 0 ? String(row[colMap.picker] || "").trim() : "";

      // Sanitasi nilai
      packerVal = cleanStaffName(packerVal);
      pickerVal = cleanStaffName(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal)) {
        itemsToSend.push({
          so: soVal,
          checker: checkerVal,
          packer: packerVal,
          picker: pickerVal
        });
      }
    }

    if (itemsToSend.length > 0) {
      // Kirim dalam batch per 300 baris
      for (var b = 0; b < itemsToSend.length; b += 300) {
        var slice = itemsToSend.slice(b, b + 300);
        UrlFetchApp.fetch(WEB_APP_URL, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ items: slice }),
          muteHttpExceptions: true
        });
      }
      Logger.log("✅ Berhasil sync " + itemsToSend.length + " baris dari tab '" + sheet.getName() + "'.");
    }
  } catch (err) {
    Logger.log("Error autoSyncCheckers: " + err);
  }
}

/**
 * Filter sanitasi nama petugas (mencegah nama pelanggan atau tanggal masuk ke kolom petugas)
 */
function cleanStaffName(name) {
  if (!name) return "";
  var s = String(name).trim();
  var low = s.toLowerCase();

  // Jika berisi indikasi tanggal, jam, atau nama pelanggan apotek, tolak!
  if (low.indexOf("apotek") === 0 || low.indexOf("pt ") === 0 || low.indexOf("klinik") === 0) return "";
  if (low.indexOf("00:00:00") !== -1 || low.indexOf("gmt") !== -1 || low.indexOf("wib") !== -1) return "";
  if (/^(mon|tue|wed|thu|fri|sat|sun)\s/i.test(s)) return "";
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) return "";

  return s;
}

/**
 * Deteksi kolom persis pada tab "Rekap Lengkap":
 * Kolom A (0) = Tanggal SO
 * Kolom B (1) = No SO Selesai
 * Kolom C (2) = Checker
 * Kolom D (3) = Packer
 * Kolom E (4) = Picker
 */
function detectColumns(headers) {
  var map = { so: -1, checker: -1, packer: -1, picker: -1 };

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().trim();
    // PENTING: Abaikan jika ada kata tanggal / tgl agar Kolom A "Tanggal SO" TIDAK dianggap SO!
    if (h.indexOf("tanggal") !== -1 || h.indexOf("tgl") !== -1 || h.indexOf("date") !== -1) {
      continue;
    }

    if (map.so < 0 && (h.indexOf("so selesai") !== -1 || h.indexOf("no so") !== -1 || h.indexOf("no. so") !== -1 || h === "so")) {
      map.so = i;
    }
    if (map.checker < 0 && (h.indexOf("checker") !== -1 || h.indexOf("qc 1") !== -1 || h === "qc1")) {
      map.checker = i;
    }
    if (map.packer < 0 && (h.indexOf("packer") !== -1 || h.indexOf("packing") !== -1 || h.indexOf("qc 2") !== -1 || h === "qc2")) {
      map.packer = i;
    }
    if (map.picker < 0 && (h.indexOf("picker") !== -1 || h.indexOf("ambil") !== -1)) {
      map.picker = i;
    }
  }

  // Posisi baku & pasti pada tab "Rekap Lengkap":
  // Kolom B (1) = No SO Selesai
  // Kolom C (2) = Checker
  // Kolom D (3) = Packer
  // Kolom E (4) = Picker
  if (map.so < 0) map.so = 1;
  if (map.checker < 0) map.checker = 2;
  if (map.packer < 0) map.packer = 3;
  if (map.picker < 0) map.picker = 4;

  return map;
}

/**
 * 3. PASANG TRIGGER OTOMATIS (Jalankan sekali dari tombol Run di Apps Script)
 */
function setupAutoSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "autoSyncCheckers" || fn === "onEditSync") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Pasang trigger onEdit (instan <1 detik)
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("onEditSync").forSpreadsheet(ss).onEdit().create();

  // Pasang trigger waktu tiap 1 menit
  ScriptApp.newTrigger("autoSyncCheckers").timeBased().everyMinutes(1).create();

  // Jalankan sync pertama kali
  autoSyncCheckers();
  Logger.log("🚀 Sinkronisasi Rekap Lengkap AKTIF! B = SO, C = Checker, D = Packer, E = Picker");
}
