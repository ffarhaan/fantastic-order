/**
 * ====================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI REALTIME CHECKER & PACKER
 * SPREADSHEET "REPORT QC 2" (TAB: Rekap Lengkap) <=> FANTASTIC ORDER
 * ====================================================================
 * 
 * CARA PASANG DI GOOGLE SPREADSHEET:
 * 1. Buka spreadsheet "REPORT QC 2" (https://docs.google.com/spreadsheets/d/1wCbPpkVM2rI_axg-sOB8n_4hmsXGOXwU4ARwaks4p8g/edit)
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus kode bawaan jika ada (misal `myFunction`), lalu paste seluruh isi file ini.
 * 4. Klik ikon "Simpan" (Ctrl+S / Cmd+S).
 * 5. Kembali ke Google Sheet Anda, lalu REFRESH halaman (tekan F5).
 * 6. Di menu bar atas Google Sheet akan muncul menu baru:
 *    "🚀 Sinkronisasi Fantastic Order"
 * 7. Klik menu tersebut lalu pilih:
 *    - "🔄 Kirim Seluruh Data Rekap Lengkap ke Web App" -> Untuk kirim seluruh data (termasuk hari ini)
 *    - "⚙️ Aktifkan Sync Otomatis onEdit (1-2 Detik)" -> Agar setiap kali ada yang ketik nama Checker/Packer, langsung otomatis terkirim tanpa klik tombol!
 */

var WEB_APP_URL = "https://fantastic-order.vercel.app/api/tidb?action=sync_checkers";
var TARGET_SHEET_NAME = "rekap lengkap";

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Sinkronisasi Fantastic Order")
    .addItem("🔄 Kirim Seluruh Data Rekap Lengkap ke Web App", "pushAllCheckersToWebApp")
    .addSeparator()
    .addItem("⚙️ Aktifkan Sync Otomatis onEdit (1-2 Detik)", "installCheckersSyncTrigger")
    .addToUi();
}

/**
 * 1. Pasang Trigger Otomatis onEdit (Hanya perlu dijalankan sekali saja)
 */
function installCheckersSyncTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncCheckersOnEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("syncCheckersOnEdit").forSpreadsheet(ss).onEdit().create();
  SpreadsheetApp.getUi().alert("✅ Sync otomatis aktif! Setiap nama Checker / Packer yang diketik di tab Rekap Lengkap akan langsung terkirim ke Fantastic Order secara realtime.");
}

/**
 * 2. Handler Realtime onEdit (Installable Trigger)
 */
function syncCheckersOnEdit(e) {
  try {
    if (!e || !e.range) return;
    var range = e.range;
    var sheet = range.getSheet();
    var sheetName = sheet.getName().toLowerCase().trim();
    if (!sheetName.includes("rekap")) return;

    var startRow = range.getRow();
    var numRows = range.getNumRows();
    if (startRow <= 1) return; // Lewati baris header

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumns(headers);

    if (colMap.so < 0) return;

    var dataRange = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var itemsToSend = [];

    for (var i = 0; i < dataRange.length; i++) {
      var row = dataRange[i];
      var soVal = String(row[colMap.so] || "").trim();
      var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
      var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal)) {
        itemsToSend.push({
          so: soVal,
          checker: checkerVal,
          packer: packerVal
        });
      }
    }

    if (itemsToSend.length > 0) {
      sendToWebApp(itemsToSend);
    }
  } catch (err) {
    Logger.log("Error in syncCheckersOnEdit: " + err);
  }
}

/**
 * 3. Kirim Seluruh Data dari Tab "Rekap Lengkap" ke Web App
 */
function pushAllCheckersToWebApp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var n = sheets[i].getName().toLowerCase().trim();
    if (n === TARGET_SHEET_NAME || n.includes("rekap")) {
      sheet = sheets[i];
      break;
    }
  }

  if (!sheet) {
    SpreadsheetApp.getUi().alert("❌ Tab 'Rekap Lengkap' tidak ditemukan di spreadsheet ini.");
    return;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert("⚠️ Tab 'Rekap Lengkap' belum memiliki baris data.");
    return;
  }

  var allValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = allValues[0];
  var colMap = detectColumns(headers);

  if (colMap.so < 0) {
    SpreadsheetApp.getUi().alert("❌ Kolom 'No SO Selesai' tidak ditemukan pada baris header.");
    return;
  }

  var validItems = [];
  for (var r = 1; r < allValues.length; r++) {
    var row = allValues[r];
    var soVal = String(row[colMap.so] || "").trim();
    var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
    var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";

    if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal)) {
      validItems.push({
        so: soVal,
        checker: checkerVal,
        packer: packerVal
      });
    }
  }

  if (validItems.length === 0) {
    SpreadsheetApp.getUi().alert("⚠️ Tidak ada baris dengan SO dan Checker/Packer yang valid untuk dikirim.");
    return;
  }

  // Kirim dalam batch per 500 baris agar ringan dan cepat
  var BATCH_SIZE = 500;
  var totalSent = 0;
  for (var b = 0; b < validItems.length; b += BATCH_SIZE) {
    var slice = validItems.slice(b, b + BATCH_SIZE);
    var ok = sendToWebApp(slice);
    if (ok) totalSent += slice.length;
  }

  SpreadsheetApp.getUi().alert("🎉 Berhasil menyinkronkan " + totalSent + " data Checker & Packer ke Fantastic Order!");
}

/**
 * Deteksi kolom otomatis berdasarkan nama header
 */
function detectColumns(headers) {
  var map = { so: -1, checker: -1, packer: -1 };
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().trim();
    if (map.so < 0 && (h.includes("so selesai") || h.includes("no so") || h.includes("sales order") || h === "so" || h.includes("order number"))) {
      map.so = i;
    }
    if (map.checker < 0 && (h.includes("checker") || h.includes("nama checker") || h === "qc 1" || h === "qc1")) {
      map.checker = i;
    }
    if (map.packer < 0 && (h.includes("packer") || h.includes("nama packer") || h.includes("packing") || h === "qc 2" || h === "qc2")) {
      map.packer = i;
    }
  }

  // Fallback posisi standar jika header tidak cocok persis: Col B (1) = SO, Col C (2) = Checker, Col D (3) = Packer
  if (map.so < 0 && headers.length > 1) map.so = 1;
  if (map.checker < 0 && headers.length > 2) map.checker = 2;
  if (map.packer < 0 && headers.length > 3) map.packer = 3;

  return map;
}

/**
 * Kirim payload ke API Fantastic Order
 */
function sendToWebApp(items) {
  try {
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ items: items }),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(WEB_APP_URL, options);
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return true;
    } else {
      Logger.log("Gagal sync, HTTP Code: " + code + " Body: " + response.getContentText());
      return false;
    }
  } catch (err) {
    Logger.log("Exception sendToWebApp: " + err);
    return false;
  }
}
