/**
 * ====================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI 2 ARAH REALTIME (BIDIRECTIONAL)
 * GOOGLE SHEET "DATA PELANGGAN MBI" <=> WEB APP FANTASTIC ORDER
 * ====================================================================
 * 
 * FITUR OTOMATIS (TANPA TOMBOL MANUAL):
 * 1. Sheet -> Web App: Setiap kali ada sel/baris yang diedit atau ditambah di Google Sheet,
 *    detik itu juga data terkirim ke Web App & langsung muncul di layar tanpa refresh.
 * 2. Web App -> Sheet: Setiap kali ada data customer yang diedit di Web App,
 *    detik itu juga baris di Google Sheet langsung terupdate secara realtime.
 * 3. Otomatis mendaftarkan trigger & Webhook URL tanpa perlu klik menu apa pun.
 * 
 * CARA PASANG / UPDATE:
 * 1. Buka Google Sheet "Data Pelanggan MBI".
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus seluruh isi script lama, lalu paste seluruh isi file ini.
 * 4. Klik "Simpan" (ikon disket / Ctrl+S).
 * 5. Klik tombol biru "Terapkan" (Deploy) -> "Kelola Penerapan" (Manage Deployments):
 *    - Edit versi aktif atau buat "Penerapan Baru" (New Deployment).
 *    - Jenis: Aplikasi Web (Web App)
 *    - Jalankan sebagai: Saya (Me)
 *    - Siapa yang memiliki akses: Siapa saja (Anyone) -> WAJIB agar Web App bisa update Sheet.
 * 6. Jalankan fungsi "setupRealtimeSync" sekali saja di editor Apps Script (pilih fungsinya lalu klik "Jalankan" / Run)
 *    untuk memberikan izin otorisasi Google. Selesai!
 */

var WEB_APP_API_URL = "https://fantastic-order.vercel.app/api/tidb";

// Folder master Google Drive berisi subfolder "(C.xxxx) Nama Apotek"
var DOCS_ROOT_FOLDER_ID = "1vcadO7xGZXEdUxRLap7H76wTcQUxii1w";
var DOCS_SET_LINK_SHARING = false;

/**
 * Otomatis dipanggil saat spreadsheet dibuka
 */
function onOpen() {
  ensureInstallableTrigger_();
}

/**
 * SETUP SEKALI JALAN (Pilih fungsi ini lalu klik 'Run' di Apps Script):
 * Mengaktifkan trigger realtime dan mendaftarkan URL Webhook ke Web App.
 */
function setupRealtimeSync() {
  ensureInstallableTrigger_();
  registerWebhookToWebApp_();
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Sinkronisasi Realtime 2 Arah Aktif!", "Fantastic Order", 5);
}

/**
 * Memastikan trigger onEdit terpasang otomatis
 */
function ensureInstallableTrigger_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var triggers = ScriptApp.getProjectTriggers();
    var hasTrigger = false;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "syncOnEdit") {
        hasTrigger = true;
        break;
      }
    }
    if (!hasTrigger) {
      ScriptApp.newTrigger("syncOnEdit").forSpreadsheet(ss).onEdit().create();
    }
  } catch (e) {
    Logger.log("Trigger check warning: " + e);
  }
}

/**
 * Mendapatkan URL Webhook publik Apps Script ini
 */
function getWebhookUrl_() {
  try {
    var url = ScriptApp.getService().getUrl();
    if (url) {
      return url.replace(/\/a\/[^\/]+\/macros\/s\//, "/macros/s/");
    }
  } catch (e) {}
  return "";
}

/**
 * Mendaftarkan URL Webhook ke Web App agar Web App bisa mengirim balik data
 */
function registerWebhookToWebApp_() {
  var webhookUrl = getWebhookUrl_();
  if (!webhookUrl) return;
  try {
    UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_single_customer", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        webhook_url: webhookUrl,
        customer: { id: "PING", name: "PING_SYSTEM" }
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("Register webhook warning: " + e);
  }
}

/**
 * 1. REALTIME ON EDIT TRIGGER (Sheet -> Web App):
 * Setiap kali user mengedit sel apa pun di sheet customer,
 * detik itu juga baris tersebut langsung dikirim ke Web App!
 */
function syncOnEdit(e) {
  try {
    if (!e || !e.range) return;
    var range = e.range;
    var sheet = range.getSheet();
    var row = range.getRow();
    if (row <= 1) return; // Abaikan baris judul / header

    var lastCol = sheet.getLastColumn();
    if (lastCol < 2) return;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Validasi apakah sheet ini adalah sheet data customer (cek keberadaan header penting)
    var headerStr = headers.map(function(h) { return String(h || "").toUpperCase().trim(); }).join(" | ");
    if (!headerStr.includes("CUSTOMER ID") && !headerStr.includes("NAMA APOTEK")) {
      return; // Bukan sheet customer, abaikan
    }

    var rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
    var customer = {};
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || "").trim();
      if (h) customer[h] = rowValues[i];
    }

    var customerId = String(customer["CUSTOMER ID"] || customer["id"] || "").trim();
    var customerName = String(customer["NAMA APOTEK/RS/PBF/KLINIK"] || customer["name"] || "").trim();

    if (!customerId || !customerName) return;

    var webhookUrl = getWebhookUrl_();

    var payload = {
      action: "sync_single_customer",
      customer: customer,
      webhook_url: webhookUrl
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_single_customer", options);
  } catch (err) {
    Logger.log("syncOnEdit error: " + err);
  }
}

/**
 * 2. REALTIME WEBHOOK RECEIVER (Web App -> Sheet):
 * Menerima kiriman otomatis dari Web App saat admin/staff mengedit customer di web,
 * lalu detik itu juga mengupdate sel yang sesuai di Google Sheet!
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Empty request" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var body = JSON.parse(e.postData.contents);
    var cust = body.customer || body;
    var targetId = String(cust.id || cust.customer_id || cust["CUSTOMER ID"] || "").trim();

    if (!targetId || targetId === "PING") {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Ping received" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var targetSheet = null;
    var headers = null;
    var idColIdx = -1;

    // Cari sheet yang memiliki kolom "CUSTOMER ID"
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      var lastCol = sh.getLastColumn();
      if (lastCol < 2) continue;
      var hRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
      for (var c = 0; c < hRow.length; c++) {
        if (String(hRow[c]).trim().toUpperCase() === "CUSTOMER ID") {
          targetSheet = sh;
          headers = hRow;
          idColIdx = c;
          break;
        }
      }
      if (targetSheet) break;
    }

    if (!targetSheet) {
      targetSheet = ss.getSheets()[0];
      headers = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
      idColIdx = 0;
    }

    var data = targetSheet.getDataRange().getValues();
    var foundRow = -1;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idColIdx]).trim().toUpperCase() === targetId.toUpperCase()) {
        foundRow = r + 1;
        break;
      }
    }

    // Pemetaan nama kolom di Google Sheet <=> properti di Web App
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
      "LIST APOTEK 2P AKTIF": cust.is_active_2p,
      "DOKUMEN LEGALITAS": cust.document_url,
      "GDRIVE NPWP": cust.npwp_drive_url,
      "COA - REC": cust.coa_rec,
      "COA - REV": cust.coa_rev,
      "SUDAH PERNAH ORDER/BELUM": cust.order_status
    };

    if (foundRow !== -1) {
      // Update baris yang sudah ada
      for (var col = 0; col < headers.length; col++) {
        var headerName = String(headers[col]).trim();
        if (fieldMap[headerName] !== undefined && fieldMap[headerName] !== null) {
          targetSheet.getRange(foundRow, col + 1).setValue(fieldMap[headerName]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "updated", row: foundRow }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Baris baru (Customer baru dibuat di Web App)
      var newRow = [];
      for (var col = 0; col < headers.length; col++) {
        var headerName = String(headers[col]).trim();
        if (headerName === "CUSTOMER ID") {
          newRow.push(targetId);
        } else if (fieldMap[headerName] !== undefined && fieldMap[headerName] !== null) {
          newRow.push(fieldMap[headerName]);
        } else {
          newRow.push("");
        }
      }
      targetSheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "appended" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 3. SINKRON DOKUMEN GOOGLE DRIVE -> WEB APP (Background)
 */
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
    if (Date.now() - startMs > 4.5 * 60 * 1000) {
      sendDocBatch_(batch);
      total += batch.length;
      props.setProperty("DOC_SYNC_TOKEN", iterator.getContinuationToken());
      props.setProperty("DOC_SYNC_COUNT", String(total));
      ScriptApp.newTrigger("continueDocSync").timeBased().after(60 * 1000).create();
      return;
    }

    var folder = iterator.next();
    var match = folder.getName().match(/C\.\d+/i);
    if (!match) continue;
    var customerId = match[0].toUpperCase();

    collectFiles_(folder, customerId, folder.getName(), batch);
    if (batch.length >= 300) {
      sendDocBatch_(batch);
      total += batch.length;
      batch = [];
    }
  }

  sendDocBatch_(batch);
  total += batch.length;

  UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_customer_documents", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ items: [], prune_before: props.getProperty("DOC_SYNC_START") }),
    muteHttpExceptions: true
  });

  props.deleteProperty("DOC_SYNC_TOKEN");
  props.deleteProperty("DOC_SYNC_START");
  props.deleteProperty("DOC_SYNC_COUNT");
}

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
  UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_customer_documents", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ items: batch }),
    muteHttpExceptions: true
  });
}

function deleteTriggers_(handlerName) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(triggers[i]);
  }
}
