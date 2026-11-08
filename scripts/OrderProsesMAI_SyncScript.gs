/**
 * ====================================================================
 * SINKRONISASI RESMI: SPREADSHEET "REPORT QC MAI" (GUDANG MAI)
 * FANTASTIC ORDER REAL-TIME SINKRONISASI - KHUSUS GUDANG MAI
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1mFptY9OxIkP0oIW9C31PdJ-GICCPXocv8AXAu8vJ0WQ/edit?gid=746703007#gid=746703007
 * Target Tab GID: 746703007
 * Kolom: B (No SO), C (Picker), D (Checker), E (Packer)
 * ====================================================================
 * 
 * CARA PASANG DI GOOGLE SPREADSHEET MAI:
 * 1. Buka Google Spreadsheet MAI Anda (link di atas).
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus semua kode yang ada di editor Apps Script, lalu PASTE SELURUH KODE DI FILE INI.
 * 4. Klik ikon disket "Simpan" (Ctrl+S).
 * 5. Pilih fungsi "setupAutoSyncTriggerMAI" di dropdown sebelah tombol "Debug", lalu klik "Jalankan" (Run).
 *    (Jika Google meminta otorisasi izin akun, klik 'Tinjau Izin' -> 'Lanjutan' -> 'Buka (tidak aman)').
 * 6. SELESAI! Real-time sync onEdit (< 1 detik) dan sinkronisasi otomatis tiap 1 menit sudah aktif 100%.
 */

var WEB_APP_URL = "https://fantastic-order.vercel.app/api/tidb?action=sync_checkers&warehouse=MAI";
var TARGET_GID = 746703007;

/**
 * Helper untuk menemukan sheet target di spreadsheet MAI
 */
function getTargetSheetMAI(ss) {
  var sheets = ss.getSheets();
  // 1. Cari berdasarkan GID spesifik (gid=746703007)
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === TARGET_GID) {
      return sheets[i];
    }
  }

  // 2. Cari berdasarkan nama tab jika GID berubah
  for (var j = 0; j < sheets.length; j++) {
    var name = sheets[j].getName().trim().toLowerCase();
    if (name === "rekap lengkap" || name.indexOf("rekap lengkap") !== -1 || name.indexOf("rekap") !== -1 || name.indexOf("mai") !== -1) {
      return sheets[j];
    }
  }

  // Fallback: sheet aktif pertama jika hanya 1 tab
  return sheets[0] || null;
}

/**
 * 1. SINKRONISASI INSTAN SAAT EDIT (<1 DETIK)
 * Berjalan seketika saat petugas gudang MAI mengetik/mengubah sel di sheet
 */
function onEditSyncMAI(e) {
  try {
    if (!e || !e.range) {
      autoSyncCheckersMAI();
      return;
    }

    var sheet = e.range.getSheet();
    var sheetId = sheet.getSheetId();
    var sheetName = sheet.getName().trim().toLowerCase();

    // STRICT CHECK: Hanya tab MAI yang sesuai yang boleh diproses
    var isTarget = (sheetId === TARGET_GID || sheetName.indexOf("rekap") !== -1 || sheetName.indexOf("mai") !== -1);
    if (!isTarget) return;

    var startRow = e.range.getRow();
    var numRows = e.range.getNumRows();
    if (startRow + numRows - 1 <= 1) return; // Abaikan baris header

    var actualStart = Math.max(2, startRow);
    var actualNumRows = (startRow + numRows - 1) - actualStart + 1;

    var lastCol = Math.max(15, sheet.getLastColumn());
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumnsMAI(headers);

    var dataRange = sheet.getRange(actualStart, 1, actualNumRows, lastCol).getValues();
    var itemsToSend = [];

    for (var r = 0; r < dataRange.length; r++) {
      var row = dataRange[r];
      var soVal = String(row[colMap.so] || "").trim();
      var noDoVal = colMap.noDo >= 0 ? String(row[colMap.noDo] || "").trim() : "";
      var custVal = colMap.customer >= 0 ? String(row[colMap.customer] || "").trim() : "";
      var tglSoVal = colMap.soDate >= 0 ? String(row[colMap.soDate] || "").trim() : "";
      var waktuKirimVal = colMap.waktuKirim >= 0 ? String(row[colMap.waktuKirim] || "").trim() : "";
      var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
      var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";
      var pickerVal = colMap.picker >= 0 ? String(row[colMap.picker] || "").trim() : "";
      var katVal = colMap.kategori >= 0 ? String(row[colMap.kategori] || "").trim() : "";
      var katProdVal = colMap.kategoriProduk >= 0 ? String(row[colMap.kategoriProduk] || "").trim() : "";
      var totalItemVal = colMap.totalItem >= 0 ? Number(row[colMap.totalItem]) || 0 : 0;
      var totalQtyVal = colMap.totalQty >= 0 ? Number(row[colMap.totalQty]) || 0 : 0;
      var barangCatatanVal = colMap.barangCatatan >= 0 ? Number(row[colMap.barangCatatan]) || 0 : 0;

      // Status DONE: cek kolom N (13), colMap.done, atau kolom M (12)
      var doneVal = "";
      if (row.length > 13 && String(row[13] || "").trim()) {
        doneVal = String(row[13] || "").trim();
      } else if (colMap.done >= 0 && String(row[colMap.done] || "").trim()) {
        doneVal = String(row[colMap.done] || "").trim();
      } else if (row.length > 12 && String(row[12] || "").trim()) {
        doneVal = String(row[12] || "").trim();
      }

      // Sanitasi nilai agar tidak salah ambil nama apotek atau jam
      checkerVal = cleanStaffNameMAI(checkerVal);
      packerVal = cleanStaffNameMAI(packerVal);
      pickerVal = cleanStaffNameMAI(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal || custVal || doneVal || barangCatatanVal > 0)) {
        itemsToSend.push({
          so: soVal,
          no_do: noDoVal,
          customer: custVal,
          so_date: tglSoVal,
          waktu_kirim: waktuKirimVal,
          checker: checkerVal,
          packer: packerVal,
          picker: pickerVal,
          kategori: katVal,
          kategori_produk: katProdVal,
          total_item: totalItemVal,
          total_qty: totalQtyVal,
          barang_catatan: barangCatatanVal,
          is_done: doneVal,
          sheet_row: actualStart + r,
          warehouse: "MAI"
        });
      }
    }

    if (itemsToSend.length > 0) {
      UrlFetchApp.fetch(WEB_APP_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ warehouse: "MAI", items: itemsToSend }),
        muteHttpExceptions: true
      });
      Logger.log("⚡ Instant sync onEdit MAI: " + itemsToSend.length + " baris terkirim ke Fantastic Order.");
    }
  } catch (err) {
    Logger.log("Error onEditSyncMAI: " + err);
  }
}

/**
 * 2. SINKRONISASI BATCH (MENYELURUH SETIAP 1 MENIT)
 * Membaca tab MAI dan mengirimkan seluruh SO, Checker, Packer, & Picker
 */
function autoSyncCheckersMAI() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getTargetSheetMAI(ss);

    if (!sheet) {
      Logger.log("⚠️ GAGAL: Tab target tidak ditemukan di spreadsheet MAI.");
      return;
    }

    var lastCol = Math.max(15, sheet.getLastColumn());
    var maxRows = sheet.getLastRow();
    if (maxRows <= 1 || lastCol <= 1) return;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumnsMAI(headers);
    if (colMap.so < 0) return;

    // Temukan baris terakhir yang benar-benar berisi No SO
    var soColValues = sheet.getRange(1, colMap.so + 1, maxRows, 1).getValues();
    var actualLastRow = 1;
    for (var k = soColValues.length - 1; k >= 0; k--) {
      var val = String(soColValues[k][0] || "").trim();
      if (val && val !== "-" && val !== "#N/A" && val.toLowerCase() !== "no so" && val.toLowerCase() !== "so") {
        actualLastRow = k + 1;
        break;
      }
    }
    if (actualLastRow <= 1) return;

    var startRow = Math.max(2, actualLastRow - 499);
    var numRows = actualLastRow - startRow + 1;

    var dataRange = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var itemsToSend = [];

    for (var r = 0; r < dataRange.length; r++) {
      var row = dataRange[r];
      var soVal = String(row[colMap.so] || "").trim();
      var noDoVal = colMap.noDo >= 0 ? String(row[colMap.noDo] || "").trim() : "";
      var custVal = colMap.customer >= 0 ? String(row[colMap.customer] || "").trim() : "";
      var tglSoVal = colMap.soDate >= 0 ? String(row[colMap.soDate] || "").trim() : "";
      var waktuKirimVal = colMap.waktuKirim >= 0 ? String(row[colMap.waktuKirim] || "").trim() : "";
      var checkerVal = colMap.checker >= 0 ? String(row[colMap.checker] || "").trim() : "";
      var packerVal = colMap.packer >= 0 ? String(row[colMap.packer] || "").trim() : "";
      var pickerVal = colMap.picker >= 0 ? String(row[colMap.picker] || "").trim() : "";
      var katVal = colMap.kategori >= 0 ? String(row[colMap.kategori] || "").trim() : "";
      var katProdVal = colMap.kategoriProduk >= 0 ? String(row[colMap.kategoriProduk] || "").trim() : "";
      var totalItemVal = colMap.totalItem >= 0 ? Number(row[colMap.totalItem]) || 0 : 0;
      var totalQtyVal = colMap.totalQty >= 0 ? Number(row[colMap.totalQty]) || 0 : 0;
      var barangCatatanVal = colMap.barangCatatan >= 0 ? Number(row[colMap.barangCatatan]) || 0 : 0;

      // Status DONE: cek kolom N (13), colMap.done, atau kolom M (12)
      var doneVal = "";
      if (row.length > 13 && String(row[13] || "").trim()) {
        doneVal = String(row[13] || "").trim();
      } else if (colMap.done >= 0 && String(row[colMap.done] || "").trim()) {
        doneVal = String(row[colMap.done] || "").trim();
      } else if (row.length > 12 && String(row[12] || "").trim()) {
        doneVal = String(row[12] || "").trim();
      }

      // Sanitasi nilai
      checkerVal = cleanStaffNameMAI(checkerVal);
      packerVal = cleanStaffNameMAI(packerVal);
      pickerVal = cleanStaffNameMAI(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal || custVal || doneVal || barangCatatanVal > 0)) {
        itemsToSend.push({
          so: soVal,
          no_do: noDoVal,
          customer: custVal,
          so_date: tglSoVal,
          waktu_kirim: waktuKirimVal,
          checker: checkerVal,
          packer: packerVal,
          picker: pickerVal,
          kategori: katVal,
          kategori_produk: katProdVal,
          total_item: totalItemVal,
          total_qty: totalQtyVal,
          barang_catatan: barangCatatanVal,
          is_done: doneVal,
          sheet_row: startRow + r,
          warehouse: "MAI"
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
          payload: JSON.stringify({ warehouse: "MAI", items: slice }),
          muteHttpExceptions: true
        });
      }
      Logger.log("✅ Berhasil sync MAI: " + itemsToSend.length + " baris dari tab '" + sheet.getName() + "'.");
    }
  } catch (err) {
    Logger.log("Error autoSyncCheckersMAI: " + err);
  }
}

/**
 * Filter sanitasi nama petugas (mencegah nama apotek atau tanggal masuk ke kolom petugas)
 */
function cleanStaffNameMAI(name) {
  if (!name) return "";
  var s = String(name).trim();
  var low = s.toLowerCase();

  if (low.indexOf("apotek") === 0 || low.indexOf("pt ") === 0 || low.indexOf("klinik") === 0) return "";
  if (low.indexOf("00:00:00") !== -1 || low.indexOf("gmt") !== -1 || low.indexOf("wib") !== -1) return "";
  if (/^(mon|tue|wed|thu|fri|sat|sun)\s/i.test(s)) return "";
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) return "";

  return s;
}

/**
 * Deteksi kolom otomatis pada spreadsheet MAI:
 * Kolom A (0) = Tanggal SO
 * Kolom B (1) = No SO
 * Kolom C (2) = Picker
 * Kolom D (3) = Checker
 * Kolom E (4) = Packer
 */
function detectColumnsMAI(headers) {
  var map = {
    so: -1, picker: -1, checker: -1, packer: -1,
    customer: -1, soDate: -1, waktuKirim: -1, noDo: -1,
    kategori: -1, kategoriProduk: -1, totalItem: -1, totalQty: -1,
    barangCatatan: -1, done: -1
  };

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().trim();

    if (map.waktuKirim < 0 && (h.indexOf("waktu kirim") !== -1 || h.indexOf("waktu") !== -1 || h.indexOf("jam") !== -1)) map.waktuKirim = i;
    if (map.noDo < 0 && (h.indexOf("no do") !== -1 || h.indexOf("no. do") !== -1 || h === "do")) map.noDo = i;
    if (map.customer < 0 && (h.indexOf("apotek") !== -1 || h.indexOf("pelanggan") !== -1 || h.indexOf("customer") !== -1 || h.indexOf("nama apotek") !== -1)) map.customer = i;
    if (map.kategoriProduk < 0 && (h.indexOf("kategori produk") !== -1 || h.indexOf("kat produk") !== -1 || h.indexOf("produk") !== -1)) map.kategoriProduk = i;
    if (map.kategori < 0 && (h === "kategori" || h === "kat")) map.kategori = i;
    if (map.totalItem < 0 && (h.indexOf("total item") !== -1 || h.indexOf("item") !== -1)) map.totalItem = i;
    if (map.totalQty < 0 && (h.indexOf("total qty") !== -1 || h.indexOf("qty") !== -1)) map.totalQty = i;
    if (map.barangCatatan < 0 && (h.indexOf("barang c") !== -1 || h.indexOf("catatan") !== -1 || h.indexOf("brg c") !== -1)) map.barangCatatan = i;

    // Status DONE (dropdown hijau)
    if (h === "done" || h.indexOf("done") !== -1 || h.indexOf("status qc") !== -1 || h === "status") {
      map.done = i;
    }

    if (map.soDate < 0 && (h.indexOf("tanggal so") !== -1 || h.indexOf("tgl so") !== -1 || h.indexOf("tanggal order") !== -1 || h.indexOf("tgl order") !== -1 || h.indexOf("order date") !== -1)) {
      map.soDate = i;
    }

    if (h.indexOf("tanggal") !== -1 || h.indexOf("tgl") !== -1 || h.indexOf("date") !== -1) {
      continue;
    }

    if (map.so < 0 && (h.indexOf("so selesai") !== -1 || h.indexOf("no so") !== -1 || h.indexOf("no. so") !== -1 || h === "so" || h.indexOf("order") !== -1)) {
      map.so = i;
    }
    if (map.picker < 0 && (h.indexOf("picker") !== -1 || h.indexOf("ambil") !== -1)) {
      map.picker = i;
    }
    if (map.checker < 0 && (h.indexOf("checker") !== -1 || h.indexOf("qc 1") !== -1 || h === "qc1")) {
      map.checker = i;
    }
    if (map.packer < 0 && (h.indexOf("packer") !== -1 || h.indexOf("packing") !== -1 || h.indexOf("qc 2") !== -1 || h === "qc2")) {
      map.packer = i;
    }
  }

  // Fallback standar Report QC MAI:
  // Col A = Tanggal SO (0), Col B = No SO (1), Col C = Picker (2), Col D = Checker (3), Col E = Packer (4)
  if (map.soDate < 0) map.soDate = 0;
  if (map.so < 0) map.so = 1;
  if (map.picker < 0) map.picker = 2;
  if (map.checker < 0) map.checker = 3;
  if (map.packer < 0) map.packer = 4;

  return map;
}

/**
 * 3. PASANG TRIGGER OTOMATIS (Jalankan sekali dari tombol Run di Apps Script)
 */
function setupAutoSyncTriggerMAI() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "autoSyncCheckersMAI" || fn === "onEditSyncMAI") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Pasang trigger onEdit (instan <1 detik)
  ScriptApp.newTrigger("onEditSyncMAI").forSpreadsheet(ss).onEdit().create();

  // Pasang trigger background tiap 1 menit
  ScriptApp.newTrigger("autoSyncCheckersMAI").timeBased().everyMinutes(1).create();

  // Jalankan sync perdana langsung
  autoSyncCheckersMAI();
  Logger.log("🚀 SINKRONISASI GUDANG MAI AKTIF! (Realtime onEdit + Batch 1 Menit)");
}
