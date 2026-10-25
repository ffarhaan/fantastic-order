/**
 * ====================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI 2 ARAH (REALTIME 2-WAY SYNC)
 * GOOGLE SHEET "SHIPMENT ERROR MAI & MBI" <=> WEB APP FANTASTIC ORDER
 * ====================================================================
 * 
 * CARA PASANG:
 * 1. Buka Google Sheet "SHIPMENT ERROR MAI & MBI".
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus kode lama (jika ada), lalu paste seluruh isi file ini.
 * 4. Klik "Simpan" (Ctrl+S).
 * 5. Klik "Terapkan" (Deploy) -> "Penerapan Baru" (New Deployment):
 *    - Pilih jenis: "Aplikasi Web" (Web App)
 *    - Deskripsi: "Sync Shipment Error Fantastic Order"
 *    - Jalankan sebagai: "Saya" (Me)
 *    - Siapa yang memiliki akses: "Siapa saja" (Anyone) -> KLIK TERAPKAN
 * 6. Kembali ke Google Sheet, Refresh (F5), lalu klik menu baru:
 *    "🚀 Sinkronisasi Web App" -> "⚙️ Pasang Sync Otomatis onEdit (1-3 Detik)"
 * 7. Untuk sinkron data yang tertinggal (23 & 24 Okt), klik:
 *    "🚀 Sinkronisasi Web App" -> "🔄 Kirim Seluruh Data Sheet ke Web App"
 */

var WEB_APP_API_URL = "https://fantastic-order.vercel.app/api/tidb";
var TARGET_SHEET_NAMES = ["shipment error 2026", "Shipment error", "shipment error", "Form Responses 1"];

function showAlertSafe(msg) {
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // getUi() tidak bisa dipanggil jika dijalankan langsung dari tombol Run di editor Apps Script
  }
}

/**
 * Mendapatkan seluruh sheet target yang sesuai (mendukung multi-tab MBI & MAI)
 */
function getAllTargetSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var targets = [];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var n = sh.getName().toLowerCase();
    try {
      if (sh.isSheetHidden()) continue;
    } catch(e) {}
    if (
      n.includes("shipment") || 
      n.includes("error") || 
      n.includes("retur") || 
      n.includes("komplain") || 
      n.includes("mbi") || 
      n.includes("mai") || 
      n.includes("form responses") ||
      n === "sheet1" ||
      n === "sheet2"
    ) {
      targets.push(sh);
    }
  }
  if (targets.length === 0) targets.push(ss.getActiveSheet());
  return targets;
}

function getTargetSheet() {
  var all = getAllTargetSheets();
  return all[0] || SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
}

/**
 * 1. Tambahkan menu khusus di Google Sheet saat dibuka
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Sinkronisasi Web App")
    .addItem("⚡ Kirim Data Terbaru / Bulan Ini (Cepat 3 Detik)", "pushRecentShipmentErrorsToWebApp")
    .addItem("🔄 Kirim Seluruh Data Sheet (Sync Massal Semua)", "pushAllShipmentErrorsToWebApp")
    .addItem("⚙️ Pasang Sync Otomatis onEdit (1-3 Detik)", "installSyncTrigger")
    .addToUi();
}

/**
 * 2. PASANG INSTALLABLE TRIGGER onEdit:
 * Simple trigger 'onEdit' dibatasi oleh Google tidak boleh UrlFetchApp.
 * Menggunakan installable trigger agar otomatis terkirim setiap kali sel diedit.
 */
function installSyncTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "syncOnEdit" || fn === "onRealtimeChange" || fn === "onChange" || fn === "onEditTrigger") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("syncOnEdit").forSpreadsheet(ss).onEdit().create();

  // Daftarkan Webhook URL ke Web App jika Web App sudah dideploy
  var serviceUrl = "";
  try {
    serviceUrl = ScriptApp.getService().getUrl();
  } catch (e) {}

  if (serviceUrl) {
    serviceUrl = serviceUrl.replace(/\/a\/[^\/]+\/macros\/s\//, "/macros/s/");
    try {
      UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_single_shipment_error", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          webhook_url: serviceUrl,
          item: { customer_name: "SYSTEM_PING", invoice_no: "PING", product_name: "PING" }
        }),
        muteHttpExceptions: true
      });
    } catch (e) {}
  }

  if (serviceUrl) {
    showAlertSafe("✅ Trigger sinkronisasi onEdit aktif!\n\nWebhook URL terdaftar: \n" + serviceUrl + "\n\nPastikan Penerapan Web App Anda diset ke 'Siapa saja (Anyone)' agar edit dari Web App dapat langsung masuk ke sheet.");
  } else {
    showAlertSafe("✅ Trigger sinkronisasi onEdit aktif!\n\n⚠️ PENTING: Web App belum di-Deploy. Silakan klik tombol 'Terapkan (Deploy)' di pojok kanan atas -> 'Penerapan baru' -> pilih 'Aplikasi web' -> Akses: 'Siapa saja (Anyone)' -> Terapkan.");
  }
}

/**
 * Helper: Format Tanggal ke YYYY-MM-DD
 */
function formatCellDate(val) {
  if (!val) return "";
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (!s || s === "-" || s === "#N/A") return "";
  
  // Jika format DD/MM/YYYY
  var ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    var d = ("0" + ddmmyyyy[1]).slice(-2);
    var m = ("0" + ddmmyyyy[2]).slice(-2);
    var y = ddmmyyyy[3];
    return y + "-" + m + "-" + d;
  }
  
  // Jika format 24 Okt 2026 atau 24 Oktober 2026
  var monthMap = {
    jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05", jun: "06",
    jul: "07", agu: "08", aug: "08", sep: "09", okt: "10", oct: "10", nov: "11", des: "12", dec: "12"
  };
  var textDateMatch = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (textDateMatch) {
    var day = ("0" + textDateMatch[1]).slice(-2);
    var mStr = textDateMatch[2].toLowerCase().slice(0, 3);
    var mon = monthMap[mStr] || "01";
    var yr = textDateMatch[3];
    return yr + "-" + mon + "-" + day;
  }
  
  return s;
}

/**
 * Alias backward compatibility untuk trigger lama (jika ada trigger lama 'onRealtimeChange')
 */
function onRealtimeChange(e) {
  syncOnEdit(e);
}

/**
 * 3. TRIGGER REALTIME ON EDIT:
 * Terpanggil otomatis ketika pengguna mengedit sel di Google Sheet
 */
function syncOnEdit(e) {
  try {
    var range = e.range;
    var sheet = range.getSheet();
    var sheetName = sheet.getName();

    var isTarget = false;
    for (var k = 0; k < TARGET_SHEET_NAMES.length; k++) {
      if (sheetName.toLowerCase() === TARGET_SHEET_NAMES[k].toLowerCase()) {
        isTarget = true;
        break;
      }
    }
    if (!isTarget) return;

    var row = range.getRow();
    if (row <= 1) return; // Abaikan baris header

    var lastCol = Math.max(sheet.getLastColumn(), 22);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    var item = {};
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || "").trim();
      if (h) item[h] = rowValues[i];
    }

    var invoiceNo = String(item["No.Faktur"] || item["No. Invoice"] || item["faktur"] || "").trim();
    var customerName = String(item["Nama Apotek"] || item["Apotek"] || item["apotek"] || "").trim();
    var productName = String(item["Nama Produk (diisi sesuai penamaan di invoice)"] || item["Nama Produk"] || item["produk"] || "").trim();

    if (!invoiceNo && !customerName && !productName) return;

    var payloadItem = {
      pbf: String(item["PBF"] || "MBI").trim(),
      customer_name: customerName,
      invoice_no: invoiceNo,
      so_no: String(item["No. Sales order/Transfer order/Shipmet ID HDP"] || item["SO number"] || "").trim(),
      product_name: productName,
      qty: Number(item["Kuantitas (yg di retur)"]) || 1,
      batch_no: String(item["Batch Number"] || "").trim(),
      expiry_date: formatCellDate(item["Expiry Date"]),
      reason: String(item["Reason"] || "").trim(),
      invoice_date: formatCellDate(item["Tanggal Faktur"]),
      week: Number(item["Week"]) || null,
      category: String(item["Category"] || "").trim(),
      month: Number(item["Month"]) || null,
      report_date: formatCellDate(item["Tanggal report"]),
      confirm: String(item["Confirm"] || "Pending").trim(),
      action: String(item["Action"] || "").trim(),
      nota_retur_no: String(item["No. Nota Retur"] || "").trim(),
      resolved_date: formatCellDate(item["Tanggal penyelesaian"]),
      status: String(item["Status"] || "Open case").trim(),
      note: String(item["Note"] || "").trim(),
      person: String(item["Person"] || "").trim(),
      root_cause: String(item["Root cause"] || "").trim(),
    };

    var serviceUrl = "";
    try { serviceUrl = ScriptApp.getService().getUrl(); } catch (err) {}

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        item: payloadItem,
        webhook_url: serviceUrl
      }),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_single_shipment_error", options);
  } catch (err) {
    Logger.log("onEdit sync error: " + err);
  }
}

/**
 * Helper: Ambil seluruh baris yang valid (bukan #N/A atau kosong)
 */
function getValidShipmentRows(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var rows = data.slice(1);
  var sheetName = sheet.getName();

  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    var headerStr = String(headers[c] || "").toLowerCase().trim();
    if (headerStr) colMap[headerStr] = c;
  }

  var getVal = function(r, keys) {
    if (!Array.isArray(keys)) keys = [keys];
    for (var k = 0; k < keys.length; k++) {
      var idx = colMap[String(keys[k]).toLowerCase().trim()];
      if (idx !== undefined && r[idx] !== undefined && r[idx] !== null && String(r[idx]).trim() !== "") {
        return r[idx];
      }
    }
    return "";
  };

  var defaultPbf = "MBI";
  if (sheetName.toLowerCase().indexOf("mai") !== -1) defaultPbf = "MAI";

  var validItems = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var invoiceNo = String(getVal(r, ["No.Faktur", "No. Invoice", "no faktur", "faktur", "invoice"]) || "").trim();
    var customerName = String(getVal(r, ["Nama Apotek", "Apotek", "Customer", "Nama Pelanggan", "pelanggan"]) || "").trim();
    var productName = String(getVal(r, ["Nama Produk (diisi sesuai penamaan di invoice)", "Nama Produk", "produk", "barang", "item description"]) || "").trim();

    // Lewati baris template rumus yang menghasilkan #N/A atau baris kosong
    if ((!customerName || customerName === "#N/A") && (!invoiceNo || invoiceNo === "#N/A") && (!productName || productName === "#N/A")) continue;
    if (customerName === "#N/A" && (!invoiceNo || invoiceNo === "#N/A")) continue;

    var rawPerson = String(getVal(r, [
      "Person", "Pelaku", "Personil", "Nama Personil", "Checker", "Picker",
      "Checker / Picker", "Picker / Checker", "Petugas", "PIC", "Nama Petugas"
    ]) || "").trim();

    if (["-", "REJECT", "#N/A", "NONE", "NULL"].indexOf(rawPerson.toUpperCase()) !== -1) {
      rawPerson = "";
    }

    var pbfVal = String(getVal(r, ["PBF", "Distributor", "Perusahaan"]) || defaultPbf).trim();
    if (!pbfVal || pbfVal === "#N/A") pbfVal = defaultPbf;

    validItems.push({
      pbf: pbfVal,
      customer_name: customerName,
      invoice_no: invoiceNo,
      so_no: String(getVal(r, ["No. Sales order/Transfer order/Shipmet ID HDP", "SO number", "No. SO", "so"]) || "").trim(),
      product_name: productName,
      qty: Number(getVal(r, ["Kuantitas (yg di retur)", "qty", "jumlah"])) || 1,
      batch_no: String(getVal(r, ["Batch Number", "batch", "lot"]) || "").trim(),
      expiry_date: formatCellDate(getVal(r, ["Expiry Date", "ed", "exp date"])),
      reason: String(getVal(r, ["Reason", "alasan", "kendala"]) || "").trim(),
      invoice_date: formatCellDate(getVal(r, ["Tanggal Faktur", "tgl faktur"])),
      week: Number(getVal(r, ["Week", "minggu"])) || null,
      category: String(getVal(r, ["Category", "kategori"]) || "").trim(),
      month: Number(getVal(r, ["Month", "bulan"])) || null,
      report_date: formatCellDate(getVal(r, ["Tanggal report", "tgl report", "tanggal lapor"])),
      confirm: String(getVal(r, ["Confirm", "konfirmasi"]) || "Pending").trim(),
      action: String(getVal(r, ["Action", "tindakan"]) || "").trim(),
      nota_retur_no: String(getVal(r, ["No. Nota Retur", "nota retur"]) || "").trim(),
      resolved_date: formatCellDate(getVal(r, ["Tanggal penyelesaian", "tgl selesai"])),
      status: String(getVal(r, ["Status", "status retur"]) || "Open case").trim(),
      note: String(getVal(r, ["Note", "catatan", "keterangan"]) || "").trim(),
      person: rawPerson,
      root_cause: String(getVal(r, ["Root cause", "akar masalah", "penyebab"]) || "").trim(),
    });
  }
  return validItems;
}

/**
 * 4a. PUSH RECENT SHIPMENT ERRORS KE WEB APP (Instan 3 Detik):
 * Mengirim 350 data valid paling akhir dari seluruh sheet.
 */
function pushRecentShipmentErrorsToWebApp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = getAllTargetSheets();
  var allValid = [];

  for (var s = 0; s < sheets.length; s++) {
    var items = getValidShipmentRows(sheets[s]);
    allValid = allValid.concat(items);
  }

  if (allValid.length === 0) {
    showAlertSafe("Tidak ada data valid yang ditemukan.");
    return;
  }

  var recentItems = allValid.slice(Math.max(0, allValid.length - 350));
  var serviceUrl = "";
  try { serviceUrl = ScriptApp.getService().getUrl(); } catch (err) {}

  var payload = {
    items: recentItems,
    mode: "upsert",
    webhook_url: serviceUrl
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    ss.toast("Mengirim " + recentItems.length + " data terbaru ke Web App...", "Sinkronisasi Berjalan", 5);
  } catch(e) {}

  UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_shipment_errors", options);
  showAlertSafe("🎉 Berhasil! Sebanyak " + recentItems.length + " data terbaru (MBI & MAI) telah tersinkron lengkap ke Web App Fantastic Order.");
}

/**
 * 4. PUSH ALL SHIPMENT ERRORS KE WEB APP (Sync Seluruh Data):
 * Menarik semua baris valid dari seluruh sheet (MBI & MAI) dan mengirimkannya dalam batch ke Web App
 */
function pushAllShipmentErrorsToWebApp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = getAllTargetSheets();
  var allValid = [];

  for (var s = 0; s < sheets.length; s++) {
    var items = getValidShipmentRows(sheets[s]);
    allValid = allValid.concat(items);
  }

  if (allValid.length === 0) {
    showAlertSafe("Sheet kosong atau tidak ada data valid.");
    return;
  }

  var serviceUrl = "";
  try { serviceUrl = ScriptApp.getService().getUrl(); } catch (err) {}

  var batchSize = 250;
  var totalSent = 0;

  for (var b = 0; b < allValid.length; b += batchSize) {
    var chunk = allValid.slice(b, b + batchSize);
    var payload = {
      items: chunk,
      mode: "upsert",
      webhook_url: serviceUrl
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(WEB_APP_API_URL + "?action=sync_shipment_errors", options);
    totalSent += chunk.length;
    try {
      ss.toast("Mengirim " + totalSent + " dari " + allValid.length + " data...", "Sinkronisasi Berjalan", 3);
    } catch(e) {}
  }

  showAlertSafe("🎉 Berhasil! Seluruh " + totalSent + " data valid dari seluruh sheet (MBI & MAI) telah tersinkron lengkap ke Web App Fantastic Order.");
}

/**
 * 5. WEBHOOK RECEIVER (DARI WEB APP KE GOOGLE SHEET):
 * Menerima panggilan saat ada edit/tambah/hapus dari Web App
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: "ok",
    message: "Webhook Fantastic Order Aktif dan Siap Menerima Data!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = getTargetSheet();
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Target sheet not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var actionType = body.actionType || "update";
    var targetInvoice = String(body.invoiceNo || body.invoice_no || "").trim();
    var targetProduct = String(body.productName || body.product_name || "").trim();

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var colMap = {};
    for (var c = 0; c < headers.length; c++) {
      var hStr = String(headers[c] || "").trim();
      if (hStr) colMap[hStr] = c;
    }

    var invCol = colMap["No.Faktur"] !== undefined ? colMap["No.Faktur"] : colMap["No. Invoice"];
    var prodCol = colMap["Nama Produk (diisi sesuai penamaan di invoice)"] !== undefined 
      ? colMap["Nama Produk (diisi sesuai penamaan di invoice)"] 
      : colMap["Nama Produk"];

    // 1. DELETE
    if (actionType === "delete") {
      if (invCol !== undefined) {
        for (var r = data.length - 1; r >= 1; r--) {
          var rowInv = String(data[r][invCol] || "").trim();
          var rowProd = prodCol !== undefined ? String(data[r][prodCol] || "").trim() : "";
          if (rowInv === targetInvoice && (!targetProduct || rowProd === targetProduct)) {
            sheet.deleteRow(r + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "deleted" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. UPDATE
    var foundRow = -1;
    if (invCol !== undefined && targetInvoice) {
      for (var r = 1; r < data.length; r++) {
        var rowInv = String(data[r][invCol] || "").trim();
        var rowProd = prodCol !== undefined ? String(data[r][prodCol] || "").trim() : "";
        if (rowInv === targetInvoice && (!targetProduct || rowProd === targetProduct)) {
          foundRow = r + 1;
          break;
        }
      }
    }

    if (foundRow > 0) {
      // Update cell values
      var setCell = function(headerName, val) {
        if (colMap[headerName] !== undefined && val !== undefined && val !== null) {
          sheet.getRange(foundRow, colMap[headerName] + 1).setValue(val);
        }
      };

      if (body.status !== undefined) setCell("Status", body.status);
      if (body.action !== undefined) setCell("Action", body.action);
      if (body.confirm !== undefined) setCell("Confirm", body.confirm);
      if (body.notaReturNo !== undefined) setCell("No. Nota Retur", body.notaReturNo);
      if (body.resolvedDate !== undefined) setCell("Tanggal penyelesaian", body.resolvedDate);
      if (body.note !== undefined) setCell("Note", body.note);
      if (body.person !== undefined) setCell("Person", body.person);
      if (body.rootCause !== undefined) setCell("Root cause", body.rootCause);
      if (body.qty !== undefined) setCell("Kuantitas (yg di retur)", body.qty);
      if (body.batchNo !== undefined) setCell("Batch Number", body.batchNo);
      if (body.expiryDate !== undefined) setCell("Expiry Date", body.expiryDate);

      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "updated", row: foundRow }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. CREATE (Append row atau timpa baris kosong/formula #N/A pertama)
    if (actionType === "create" || foundRow === -1) {
      var newRow = new Array(headers.length).fill("");
      var setCol = function(headerName, val) {
        if (colMap[headerName] !== undefined && val !== undefined && val !== null) {
          newRow[colMap[headerName]] = val;
        }
      };

      var repDateObj = new Date();
      if (body.reportDate || body.report_date) {
        var pd = new Date(body.reportDate || body.report_date);
        if (!isNaN(pd.getTime())) repDateObj = pd;
      }
      var weekNum = Math.max(1, Math.floor((repDateObj - new Date(repDateObj.getFullYear(), 0, 1)) / 604800000) + 1);
      var monthNum = repDateObj.getMonth() + 1;

      setCol("PBF", body.pbf || "MBI");
      setCol("Nama Apotek", body.namaApotek || body.customer_name || "");
      setCol("No.Faktur", body.invoiceNo || body.invoice_no || "");
      setCol("No. Sales order/Transfer order/Shipmet ID HDP", body.soNo || body.so_no || "");
      setCol("Nama Produk (diisi sesuai penamaan di invoice)", body.productName || body.product_name || "");
      setCol("Kuantitas (yg di retur)", Number(body.qty) || 1);
      setCol("Batch Number", body.batchNo || body.batch_no || "");
      setCol("Expiry Date", body.expiryDate || body.expiry_date || "");
      setCol("Reason", body.reason || "");
      setCol("Tanggal Faktur", body.invoiceDate || body.invoice_date || "");
      setCol("Week", body.week || weekNum);
      setCol("Category", body.category || "Retur");
      setCol("Month", body.month || monthNum);
      setCol("Tanggal report", body.reportDate || body.report_date || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"));
      setCol("Confirm", body.confirm || "Pending");
      setCol("Action", body.action || "");
      setCol("Status", body.status || "Open case");
      setCol("Note", body.note || "");
      setCol("Person", body.person || "");
      setCol("Root cause", body.rootCause || body.root_cause || "");

      // Cari baris pertama yang kosong / baris formula #N/A agar tidak meloncat ke baris 3000+
      var insertRow = -1;
      for (var r = 1; r < data.length; r++) {
        var rCust = colMap["Nama Apotek"] !== undefined ? String(data[r][colMap["Nama Apotek"]] || "").trim() : "";
        var rInv = invCol !== undefined ? String(data[r][invCol] || "").trim() : "";
        if ((!rCust || rCust === "#N/A") && (!rInv || rInv === "#N/A")) {
          insertRow = r + 1;
          break;
        }
      }

      if (insertRow > 0) {
        sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);
      } else {
        sheet.appendRow(newRow);
        insertRow = sheet.getLastRow();
      }

      return ContentService.createTextOutput(JSON.stringify({ success: true, action: "created", row: insertRow }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
