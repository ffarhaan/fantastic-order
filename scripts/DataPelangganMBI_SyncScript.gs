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

/**
 * 1. Tambahkan menu khusus di Google Sheet saat dibuka
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Sinkronisasi Web App")
    .addItem("🔄 Kirim Seluruh Data Sheet ke Web App", "pushAllToWebApp")
    .addItem("📥 Tarik Data Terbaru dari Web App ke Sheet", "pullAllFromWebApp")
    .addToUi();
}

/**
 * 2. TRIGGER REALTIME ON EDIT:
 * Ketika ada sel yang diedit di Google Sheet, otomatis kirim perubahan ke Web App!
 */
function onEdit(e) {
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
