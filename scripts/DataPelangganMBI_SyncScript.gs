/**
 * ====================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI 2 ARAH OTOMATIS (BIDIRECTIONAL)
 * GOOGLE SHEET "DATA PELANGGAN MBI" <=> WEB APP FANTASTIC ORDER
 * ====================================================================
 * 
 * 100% OTOMATIS TANPA TOMBOL MANUAL:
 * 1. Sheet -> Web App: Setiap kali ada sel/baris yang diedit di Google Sheet,
 *    detik itu juga baris terkirim ke Web App & langsung muncul di layar (1-3 detik).
 * 2. Web App -> Sheet: Setiap kali data diedit di Web App, perubahan masuk ke antrean
 *    dan otomatis disedot oleh trigger latar belakang Google Cloud setiap menit & seketika saat sheet dibuka.
 * 
 * CARA PASANG / UPDATE:
 * 1. Buka Google Sheet "Data Pelanggan MBI".
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus seluruh isi script lama, lalu paste seluruh isi file ini.
 * 4. Klik "Simpan" (ikon disket / Ctrl+S).
 * 5. Pilih fungsi "setupRealtimeSync" di dropdown sebelah tombol "Debug", lalu klik "Jalankan" (Run).
 *    (Berikan izin otorisasi Google jika diminta).
 * Selesai! Kedua arah sinkronisasi aktif 100% secara otomatis.
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
  autoSyncPendingCustomers();
}

/**
 * SETUP SEKALI JALAN (Pilih fungsi ini lalu klik 'Run' di Apps Script):
 * Memasang trigger onEdit, trigger latar belakang 1 menit, dan langsung menyinkronkan data.
 */
function setupRealtimeSync() {
  ensureInstallableTrigger_();
  registerWebhookToWebApp_();
  autoSyncPendingCustomers();
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ Sinkronisasi 2 Arah Otomatis Aktif!", "Fantastic Order", 6);
}

/**
 * Memastikan trigger onEdit & trigger background setiap menit terpasang otomatis
 */
function ensureInstallableTrigger_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var triggers = ScriptApp.getProjectTriggers();
    var hasEditTrigger = false;
    var hasTimeTrigger = false;

    for (var i = 0; i < triggers.length; i++) {
      var func = triggers[i].getHandlerFunction();
      if (func === "syncOnEdit") hasEditTrigger = true;
      if (func === "autoSyncPendingCustomers") hasTimeTrigger = true;
    }

    if (!hasEditTrigger) {
      ScriptApp.newTrigger("syncOnEdit").forSpreadsheet(ss).onEdit().create();
    }
    if (!hasTimeTrigger) {
      ScriptApp.newTrigger("autoSyncPendingCustomers").timeBased().everyMinutes(1).create();
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
      return url.replace(/\/a\/(?:macros\/)?[^\/]+\/(?:macros\/)?s\//, "/macros/s/");
    }
  } catch (e) {}
  return "";
}

/**
 * Mendaftarkan URL Webhook ke Web App
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
 * ====================================================================
 * 1. ARAH SHEET -> WEB APP (Realtime onEdit)
 * Setiap kali user mengedit sel apa pun di sheet customer,
 * detik itu juga baris tersebut langsung dikirim ke Web App!
 * ====================================================================
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

    UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_single_customer", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    // Sekaligus cek apakah ada pending update dari Web App
    autoSyncPendingCustomers();
  } catch (err) {
    Logger.log("syncOnEdit error: " + err);
  }
}

/**
 * ====================================================================
 * 2. ARAH WEB APP -> SHEET (Auto-Queue Pull Latar Belakang)
 * Berjalan otomatis setiap menit & saat sheet dibuka, tanpa perlu tombol manual.
 * ====================================================================
 */
function autoSyncPendingCustomers() {
  try {
    var res = UrlFetchApp.fetch(WEB_APP_API_URL + "?action=get_pending_customer_sync&_t=" + Date.now(), {
      method: "get",
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return;
    var data = JSON.parse(res.getContentText());
    if (!data.success || !data.items || data.items.length === 0) return;

    var syncedIds = [];
    for (var i = 0; i < data.items.length; i++) {
      var item = data.items[i];
      var resApply = applyCustomerToSheet_(item);
      if (resApply && (item.id || item["CUSTOMER ID"])) {
        syncedIds.push(item.id || item["CUSTOMER ID"]);
      }
    }

    if (syncedIds.length > 0) {
      UrlFetchApp.fetch(WEB_APP_API_URL + "?action=ack_pending_customer_sync", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ synced_ids: syncedIds }),
        muteHttpExceptions: true
      });
      Logger.log("✅ Auto-synced " + syncedIds.length + " customers from Web App to Sheet!");
    }
  } catch (err) {
    Logger.log("autoSyncPendingCustomers error: " + err);
  }
}

/**
 * Webhook Direct Receiver (doGet & doPost jika webhook direct diaktifkan)
 */
function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  try {
    var body = null;
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (pErr) {}
    }
    if (!body && e && e.parameter) {
      if (e.parameter.data) {
        try { body = JSON.parse(e.parameter.data); } catch (dErr) {}
      } else if (e.parameter.customer) {
        try { body = { customer: JSON.parse(e.parameter.customer) }; } catch (cErr) { body = { customer: e.parameter }; }
      } else if (e.parameter.id || e.parameter.name) {
        body = { customer: e.parameter };
      }
    }

    if (!body) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        status: "active",
        message: "Webhook Google Sheet 'Data Pelanggan MBI' AKTIF."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var cust = body.customer || body;
    var resApply = applyCustomerToSheet_(cust);
    if (resApply) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, ...resApply }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "No row updated" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * FUNGSI UTAMA: Menulis data customer ke baris yang sesuai di Google Sheet
 */
function applyCustomerToSheet_(cust) {
  if (!cust) return null;
  var targetId = String(cust.id || cust.customer_id || cust["CUSTOMER ID"] || "").trim();
  if (!targetId || targetId === "PING") return null;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var targetSheet = null;
  var headers = null;
  var idColIdx = -1;

  var norm = function(str) {
    return String(str || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  };

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var lastCol = sh.getLastColumn();
    if (lastCol < 2) continue;
    var hRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < hRow.length; c++) {
      if (norm(hRow[c]) === norm("CUSTOMER ID")) {
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

  var fieldMap = {
    "CUSTOMER ID": cust.id,
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
    "BRANCH NAME HALODOC FOR PHARMA": cust.halodoc_pharma,
    "LIST APOTEK 2P AKTIF": cust.is_active_2p,
    "DOKUMEN LEGALITAS": cust.document_url,
    "GDRIVE NPWP": cust.npwp_drive_url,
    "COA - REC": cust.coa_rec,
    "COA - REV": cust.coa_rev,
    "SUDAH PERNAH ORDER/BELUM": cust.order_status
  };

  var normFieldMap = {};
  for (var k in fieldMap) {
    if (fieldMap[k] !== undefined && fieldMap[k] !== null) {
      normFieldMap[norm(k)] = fieldMap[k];
    }
  }

  if (foundRow !== -1) {
    for (var col = 0; col < headers.length; col++) {
      var nHead = norm(headers[col]);
      if (normFieldMap[nHead] !== undefined) {
        targetSheet.getRange(foundRow, col + 1).setValue(normFieldMap[nHead]);
      }
    }
    return { action: "updated", row: foundRow, customer_id: targetId };
  } else {
    var newRow = [];
    for (var col = 0; col < headers.length; col++) {
      var nHead = norm(headers[col]);
      if (nHead === norm("CUSTOMER ID")) {
        newRow.push(targetId);
      } else if (normFieldMap[nHead] !== undefined) {
        newRow.push(normFieldMap[nHead]);
      } else {
        newRow.push("");
      }
    }
    targetSheet.appendRow(newRow);
    return { action: "appended", customer_id: targetId };
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
