/**
 * ====================================================================
 * SINKRONISASI OTOMATIS REAL-TIME (<1 DETIK SAAT EDIT & TIAP 1 MENIT)
 * SPREADSHEET "REPORT QC 2" (TAB: Rekap Lengkap) <=> FANTASTIC ORDER
 * Mendukung: SO, Checker, Packer, & Picker
 * ====================================================================
 */

var WEB_APP_URL = "https://fantastic-order.vercel.app/api/tidb?action=sync_checkers";

/**
 * 1. SINKRONISASI INSTAN SAAT ADA EDIT (Kurang dari 1 detik!)
 * Begitu ada sel yang diketik/diisi nama Checker, Packer, atau Picker,
 * data baris tersebut langsung dikirim seketika tanpa jeda.
 */
function onEditSync(e) {
  try {
    if (!e || !e.range) {
      autoSyncCheckers();
      return;
    }

    var sheet = e.range.getSheet();
    var sheetName = sheet.getName().toLowerCase().trim();
    if (!sheetName.includes("rekap")) return;

    var startRow = e.range.getRow();
    var numRows = e.range.getNumRows();
    if (startRow + numRows - 1 <= 1) return;

    var actualStart = Math.max(2, startRow);
    var actualNumRows = (startRow + numRows - 1) - actualStart + 1;

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumns(headers);
    if (colMap.so < 0) return;

    var dataRange = sheet.getRange(actualStart, 1, actualNumRows, lastCol).getValues();
    var itemsToSend = [];

    for (var r = 0; r < dataRange.length; r++) {
      var row = dataRange[r];
      var soVal = String(row[colMap.so] || "").trim();
      var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
      var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";
      var pickerVal = colMap.picker >= 0 ? String(row[colMap.picker] || "").trim() : "";

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
 * 2. SINKRONISASI BATCH MENYELURUH (Jaring Pengaman Otomatis)
 * Membaca tab Rekap Lengkap dan mengirimkan seluruh SO, Checker, Packer, & Picker
 */
function autoSyncCheckers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = null;
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var n = sheets[i].getName().toLowerCase().trim();
      if (n.includes("rekap")) {
        sheet = sheets[i];
        break;
      }
    }

    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1) return;

    // Ambil data (ambil 1000 baris terakhir untuk efisiensi tinggi)
    var startRow = Math.max(2, lastRow - 999);
    var numRows = lastRow - startRow + 1;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumns(headers);
    if (colMap.so < 0) return;

    var dataRange = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var itemsToSend = [];

    for (var r = 0; r < dataRange.length; r++) {
      var row = dataRange[r];
      var soVal = String(row[colMap.so] || "").trim();
      var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
      var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";
      var pickerVal = colMap.picker >= 0 ? String(row[colMap.picker] || "").trim() : "";

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
      Logger.log("✅ Berhasil sync batch " + itemsToSend.length + " baris data.");
    }
  } catch (err) {
    Logger.log("Error autoSyncCheckers: " + err);
  }
}

/**
 * Deteksi kolom otomatis (Col B = SO, Col C = Checker, Col D = Packer, Col E = Picker)
 */
function detectColumns(headers) {
  var map = { so: -1, checker: -1, packer: -1, picker: -1 };
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().trim();
    if (map.so < 0 && (h.includes("so") || h.includes("order number"))) map.so = i;
    if (map.checker < 0 && (h.includes("checker") || h.includes("qc 1") || h === "qc1")) map.checker = i;
    if (map.packer < 0 && (h.includes("packer") || h.includes("packing") || h.includes("qc 2") || h === "qc2")) map.packer = i;
    if (map.picker < 0 && (h.includes("picker") || h.includes("nama picker") || h.includes("ambil"))) map.picker = i;
  }
  // Fallback posisi standar: Col B (1) = SO, Col C (2) = Checker, Col D (3) = Packer, Col E (4) = Picker
  if (map.so < 0 && headers.length > 1) map.so = 1;
  if (map.checker < 0 && headers.length > 2) map.checker = 2;
  if (map.packer < 0 && headers.length > 3) map.packer = 3;
  if (map.picker < 0 && headers.length > 4) map.picker = 4;
  return map;
}

/**
 * 3. PASANG TRIGGER OTOMATIS (Jalankan sekali saja dari tombol Run di Apps Script)
 * Memasang onEdit (Instan <1 detik) dan Timer 1 Menit (Jaring Pengaman)
 */
function setupAutoSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "autoSyncCheckers" || fn === "onEditSync") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 1. Trigger saat edit sel: LANGSUNG jalan seketika (<1 detik) saat ada ketikan/paste baru
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("onEditSync").forSpreadsheet(ss).onEdit().create();

  // 2. Trigger waktu: Jalan tiap 1 menit sebagai jaring pengaman data formula / sinkronisasi berkala
  ScriptApp.newTrigger("autoSyncCheckers").timeBased().everyMinutes(1).create();

  // Eksekusi sync pertama kali
  autoSyncCheckers();
  Logger.log("🚀 Sinkronisasi instan aktif! Edit = <1 detik, Background = tiap 1 menit.");
}
