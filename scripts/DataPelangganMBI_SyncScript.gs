/**
 * ====================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI 2 ARAH (BIDIRECTIONAL SYNC)
 * GOOGLE SHEET "DATA PELANGGAN MBI" <=> WEB APP FANTASTIC ORDER
 * ====================================================================
 * 
 * CARA PASANG:
 * 1. Buka Google Sheet "Data Pelanggan MBI".
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus kode lama, lalu paste seluruh isi file ini.
 * 4. Klik "Simpan" (Ctrl+S).
 * 5. Klik "Terapkan" (Deploy) -> "Penerapan Baru" (New Deployment):
 *    - Jenis: Aplikasi Web (Web App)
 *    - Jalankan sebagai: Saya (Me)
 *    - Siapa yang memiliki akses: Siapa saja (Anyone)
 * 6. Salin URL Web App yang dihasilkan.
 */

var WEB_APP_API_URL = "https://fantastic-order.vercel.app/api/tidb";
var TARGET_SHEET_NAME = "DATA CUSTOMER MBI"; // Ubah jika nama tab Anda "Master"

// Folder master Google Drive berisi subfolder "(C.xxxx) Nama Apotek"
var DOCS_ROOT_FOLDER_ID = "1vcadO7xGZXEdUxRLap7H76wTcQUxii1w";
// true = file otomatis dibagikan "Siapa saja yang memiliki link (Viewer)" supaya preview
// di aplikasi bisa dibuka tanpa login Google. false = hanya akun yang punya akses folder.
// Catatan: dokumen berisi KTP/NPWP, pertimbangkan baik-baik sebelum mengubah ke true.
var DOCS_SET_LINK_SHARING = false;

/**
 * 1. Tambahkan menu khusus di Google Sheet saat dibuka
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Sinkronisasi Web App")
    .addItem("🔄 Kirim Seluruh Data Sheet ke Web App", "pushAllToWebApp")
    .addItem("📥 Tarik Data Terbaru dari Web App ke Sheet", "pullAllFromWebApp")
    .addSeparator()
    .addItem("📂 Sinkron Dokumen Drive ke Web App", "syncDocumentsToWebApp")
    .addItem("⏰ Aktifkan Sinkron Dokumen Harian (sekali saja)", "installDailyDocSync")
    .addSeparator()
    .addItem("⚙️ Aktifkan Sync Otomatis (sekali saja)", "installSyncTrigger")
    .addToUi();
}

/**
 * 1b. PASANG INSTALLABLE TRIGGER:
 * Simple trigger "onEdit" TIDAK diizinkan memanggil UrlFetchApp,
 * jadi sync otomatis wajib memakai installable trigger. Jalankan sekali saja.
 */
function installSyncTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncOnEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("syncOnEdit").forSpreadsheet(ss).onEdit().create();
  SpreadsheetApp.getUi().alert("✅ Sync otomatis aktif! Setiap edit di sheet akan langsung terkirim ke Web App.");
}

/**
 * 2. TRIGGER REALTIME ON EDIT (installable):
 * Ketika ada sel yang diedit di Google Sheet, otomatis kirim perubahan ke Web App!
 */
function syncOnEdit(e) {
  try {
    var range = e.range;
    var sheet = range.getSheet();
    var sheetName = sheet.getName();

    if (sheetName !== TARGET_SHEET_NAME && sheetName !== "Master") return;

    var row = range.getRow();
    if (row <= 1) return; // Abaikan baris header

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    var customer = {};
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || "").trim();
      if (h) customer[h] = rowValues[i];
    }

    var customerId = customer["CUSTOMER ID"] || customer["id"];
    var customerName = customer["NAMA APOTEK/RS/PBF/KLINIK"] || customer["name"];

    if (!customerId || !customerName) return;

    var payload = {
      action: "sync_single_customer",
      customer: customer
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_single_customer", options);
  } catch (err) {
    Logger.log("onEdit sync error: " + err);
  }
}

/**
 * 3. WEBHOOK RECEIVER:
 * Menerima update dari Web App saat admin mengedit data customer di web,
 * lalu otomatis mengupdate baris yang sesuai di Google Sheet!
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var cust = body.customer || body;
    var targetId = String(cust.id || cust.customer_id || cust["CUSTOMER ID"] || "").trim();

    if (!targetId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing ID" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TARGET_SHEET_NAME) || ss.getSheetByName("Master") || ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var idColIdx = -1;
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).trim().toUpperCase() === "CUSTOMER ID") {
        idColIdx = c;
        break;
      }
    }

    if (idColIdx === -1) idColIdx = 0;

    var foundRow = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idColIdx]).trim() === targetId) {
        foundRow = r + 1;
        break;
      }
    }

    // Mapping fields
    var fieldMap = {
      "NAMA APOTEK/RS/PBF/KLINIK": cust.name,
      "CUSTOMER ID ORACLE": cust.customer_id_oracle,
      "STATUS MERCHANT": cust.status_merchant,
      "NO TELF APJ": cust.phone,
      "Alamat email": cust.email,
      "Default Billing Address": cust.address,
      "VAT ID": cust.vat_id,
      "NIK NUMBER (npwp 16 digit)": cust.nik,
      "NAMA PEMILIK NPWP": cust.owner_name,
      "ALAMAT WAJIB PAJAK": cust.owner_address,
      "IZIN APOTEK/KLINIK/PBF/RS NUMBER": cust.sia_number,
      "SIA EXPIRED DATE": cust.sia_expired,
      "SIPA NUMBER": cust.sipa_number,
      "SIPA EXPIRED DATE": cust.sipa_expired,
      "NAMA APJ": cust.apj_name,
      "KODE SIPNAP": cust.sipnap_code,
      "SITE NUMBER (BILL TO)": cust.site_bill_to,
      "SITE NUMBER (SHIP TO)": cust.site_ship_to,
      "MBI BRANCH": cust.branch,
      "Zone": cust.zone,
      "KATEGORI CUSTOMER": cust.category,
      "COA - REC": cust.coa_rec,
      "COA - REV": cust.coa_rev,
      "SUDAH PERNAH ORDER/BELUM": cust.order_status
    };

    if (foundRow !== -1) {
      // Update existing row
      for (var col = 0; col < headers.length; col++) {
        var headerName = String(headers[col]).trim();
        if (fieldMap[headerName] !== undefined && fieldMap[headerName] !== null) {
          sheet.getRange(foundRow, col + 1).setValue(fieldMap[headerName]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "updated", row: foundRow }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Append new row
      var newRow = [];
      for (var col = 0; col < headers.length; col++) {
        var headerName = String(headers[col]).trim();
        if (headerName === "CUSTOMER ID") {
          newRow.push(targetId);
        } else if (fieldMap[headerName] !== undefined) {
          newRow.push(fieldMap[headerName]);
        } else {
          newRow.push("");
        }
      }
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "appended" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 4. PUSH ALL:
 * Mengirim seluruh baris di sheet ini ke database Web App
 */
function pushAllToWebApp() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TARGET_SHEET_NAME) || ss.getSheetByName("Master") || ss.getSheets()[0];
  var rawData = sheet.getDataRange().getValues();

  if (rawData.length <= 1) {
    ui.alert("Sheet kosong atau tidak ada data.");
    return;
  }

  var headers = rawData[0];
  var items = [];
  for (var r = 1; r < rawData.length; r++) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || "").trim();
      if (h) rowObj[h] = rawData[r][c];
    }
    if (rowObj["CUSTOMER ID"] && rowObj["NAMA APOTEK/RS/PBF/KLINIK"]) {
      items.push(rowObj);
    }
  }

  var res = UrlFetchApp.fetch(WEB_APP_API_URL + "?action=bulk_import_customers", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ items: items }),
    muteHttpExceptions: true
  });

  ui.alert("Sinkronisasi Selesai!", "Berhasil mengirim " + items.length + " data apotek ke Web App.", ui.ButtonSet.OK);
}

/**
 * 5. PULL ALL:
 * Menarik seluruh data terbaru dari Web App dan mengupdate sheet ini
 */
function pullAllFromWebApp() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert("Konfirmasi", "Tindakan ini akan menyelaraskan data di sheet ini dengan database Web App terbaru. Lanjutkan?", ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  var res = UrlFetchApp.fetch(WEB_APP_API_URL + "?action=get_all_customers_for_sheet", {
    method: "get",
    muteHttpExceptions: true
  });

  var data = JSON.parse(res.getContentText());
  if (!data.success || !Array.isArray(data.data)) {
    ui.alert("Gagal mengambil data dari Web App: " + (data.error || "Unknown"));
    return;
  }

  ui.alert("Berhasil!", "Database memiliki " + data.data.length + " apotek. Data audit selalu siap digunakan.", ui.ButtonSet.OK);
}

/**
 * ====================================================================
 * 6. SINKRON DOKUMEN GOOGLE DRIVE -> WEB APP
 * ====================================================================
 * Membaca semua subfolder "(C.xxxx) Nama Apotek" di folder master Drive,
 * lalu mengirim daftar file (nama, ID, tipe, ukuran) ke Web App.
 * File TIDAK dipindah / di-upload ulang: aplikasi hanya menampilkan preview dari Drive.
 * Proses otomatis dilanjutkan bertahap jika melebihi batas waktu Apps Script (6 menit).
 */
var DOC_SYNC_MAX_MS = 4.5 * 60 * 1000;
var DOC_SYNC_BATCH = 300;

function syncDocumentsToWebApp() {
  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_customer_documents", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ start: true }),
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (!data.success) throw new Error("Gagal memulai sinkron dokumen: " + res.getContentText());

  props.setProperty("DOC_SYNC_START", data.server_time);
  props.deleteProperty("DOC_SYNC_TOKEN");
  props.setProperty("DOC_SYNC_COUNT", "0");
  runDocSync_();
}

function continueDocSync() {
  runDocSync_();
}

function runDocSync_() {
  var startMs = Date.now();
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("DOC_SYNC_TOKEN");
  var total = Number(props.getProperty("DOC_SYNC_COUNT") || 0);
  deleteTriggers_("continueDocSync");

  var iterator = token
    ? DriveApp.continueFolderIterator(token)
    : DriveApp.getFolderById(DOCS_ROOT_FOLDER_ID).getFolders();

  var batch = [];
  while (iterator.hasNext()) {
    if (Date.now() - startMs > DOC_SYNC_MAX_MS) {
      sendDocBatch_(batch);
      total += batch.length;
      props.setProperty("DOC_SYNC_TOKEN", iterator.getContinuationToken());
      props.setProperty("DOC_SYNC_COUNT", String(total));
      ScriptApp.newTrigger("continueDocSync").timeBased().after(60 * 1000).create();
      Logger.log("Belum selesai, dilanjutkan otomatis 1 menit lagi. Terkirim: " + total);
      return;
    }

    var folder = iterator.next();
    var match = folder.getName().match(/C\.\d+/i);
    if (!match) continue;
    var customerId = match[0].toUpperCase();

    collectFiles_(folder, customerId, folder.getName(), batch);
    if (batch.length >= DOC_SYNC_BATCH) {
      sendDocBatch_(batch);
      total += batch.length;
      batch = [];
    }
  }

  sendDocBatch_(batch);
  total += batch.length;

  // Selesai: hapus data dokumen yang sudah tidak ada lagi di Drive
  UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_customer_documents", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ items: [], prune_before: props.getProperty("DOC_SYNC_START") }),
    muteHttpExceptions: true
  });

  props.deleteProperty("DOC_SYNC_TOKEN");
  props.deleteProperty("DOC_SYNC_START");
  props.deleteProperty("DOC_SYNC_COUNT");
  Logger.log("Sinkron dokumen selesai. Total file: " + total);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Sinkron dokumen selesai: " + total + " file.", "📂 Dokumen Drive", 10);
  } catch (e) {}
}

// Ambil semua file di folder customer (termasuk subfolder di dalamnya)
function collectFiles_(folder, customerId, folderName, out) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (DOCS_SET_LINK_SHARING) {
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    }
    out.push({
      file_id: f.getId(),
      customer_id: customerId,
      file_name: f.getName(),
      mime_type: f.getMimeType(),
      size_bytes: f.getSize(),
      folder_id: folder.getId(),
      folder_name: folderName,
      modified_at: f.getLastUpdated().toISOString()
    });
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    var sub = subs.next();
    collectFiles_(sub, customerId, folderName + " / " + sub.getName(), out);
  }
}

function sendDocBatch_(batch) {
  if (!batch || batch.length === 0) return;
  var res = UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_customer_documents", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ items: batch }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error("Gagal kirim batch dokumen: " + res.getContentText());
  }
}

function deleteTriggers_(handlerName) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(triggers[i]);
  }
}

// Jadwal harian (jam 1 pagi) supaya file baru di Drive otomatis muncul di aplikasi
function installDailyDocSync() {
  deleteTriggers_("syncDocumentsToWebApp");
  ScriptApp.newTrigger("syncDocumentsToWebApp").timeBased().everyDays(1).atHour(1).create();
  SpreadsheetApp.getUi().alert("✅ Sinkron dokumen harian aktif (setiap jam 01.00).");
}
