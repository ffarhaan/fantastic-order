/**
 * ====================================================================
 * SINKRONISASI RESMI: SPREADSHEET "REPORT QC" (GUDANG MBI - TAB: Rekap SO / Rekap Lengkap)
 * FANTASTIC ORDER REAL-TIME SINKRONISASI & REPORT QC PIPELINE
 * Kolom A: Waktu Kirim | B: NO DO | C: No SO | D: Apotek | E: Tanggal SO
 * Kolom F: Checker | H: Total Item | I: Total Qty | J: Barang Catatan
 * Kolom K: Kategori (1P/3P) | L: Kategori Produk (FARMA/ALKES) | N: DONE
 * ====================================================================
 */

var WEB_APP_URL = "https://fantastic-order.vercel.app/api/tidb?action=sync_checkers";

/**
 * Helper untuk mendeteksi sheet aktif (Mendukung "Rekap SO" maupun "Rekap Lengkap")
 */
function getTargetSheet(ss) {
  // 1. Coba cari nama persis "Rekap SO" atau "Rekap Lengkap"
  var s = ss.getSheetByName("Rekap SO") || ss.getSheetByName("Rekap Lengkap");
  if (s) return s;

  // 2. Coba cari case-insensitive
  var sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var name = sheets[j].getName().trim().toLowerCase();
    if (name === "rekap so" || name.indexOf("rekap so") !== -1 || name === "rekap lengkap" || name.indexOf("rekap lengkap") !== -1) {
      return sheets[j];
    }
  }

  return null;
}

/**
 * 1. SINKRONISASI INSTAN SAAT EDIT (<1 DETIK)
 * Berjalan seketika saat petugas mengetik, mengubah sel, atau memilih dropdown DONE
 */
function onEditSync(e) {
  try {
    if (!e || !e.range) {
      autoSyncCheckers();
      return;
    }

    var sheet = e.range.getSheet();
    var sheetName = sheet.getName().trim().toLowerCase();

    // STRICT CHECK: Hanya tab "Rekap SO" atau "Rekap Lengkap" yang diproses!
    var isTarget = (sheetName === "rekap so" || sheetName.indexOf("rekap so") !== -1 || sheetName === "rekap lengkap" || sheetName.indexOf("rekap lengkap") !== -1);
    if (!isTarget) return;

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
      var doneVal = colMap.done >= 0 ? String(row[colMap.done] || "").trim() : "";

      packerVal = cleanStaffName(packerVal);
      pickerVal = cleanStaffName(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal || custVal || doneVal)) {
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
          warehouse: "MBI"
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
 * Mengambil 1000 baris terbaru dari tab Rekap SO / Rekap Lengkap
 */
function autoSyncCheckers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getTargetSheet(ss);

    if (!sheet) {
      Logger.log("⚠️ GAGAL: Tab 'Rekap SO' atau 'Rekap Lengkap' tidak ditemukan.");
      return;
    }

    var lastCol = sheet.getLastColumn();
    var maxRows = sheet.getLastRow();
    if (maxRows <= 1 || lastCol <= 1) return;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = detectColumns(headers);
    if (colMap.so < 0) return;

    // Temukan baris terakhir yang benar-benar berisi No SO (mengatasi sheet dengan puluhan ribu baris kosong di bawah)
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
      var doneVal = colMap.done >= 0 ? String(row[colMap.done] || "").trim() : "";

      packerVal = cleanStaffName(packerVal);
      pickerVal = cleanStaffName(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal || custVal || doneVal)) {
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
          warehouse: "MBI"
        });
      }
    }

    if (itemsToSend.length > 0) {
      var CHUNK = 200;
      for (var i = 0; i < itemsToSend.length; i += CHUNK) {
        var chunk = itemsToSend.slice(i, i + CHUNK);
        UrlFetchApp.fetch(WEB_APP_URL, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ items: chunk }),
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
 * Filter sanitasi nama petugas
 */
function cleanStaffName(name) {
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
 * Deteksi kolom persis pada tab "Rekap SO" / "Rekap Lengkap":
 * Col A (0) = Waktu Kirim
 * Col B (1) = NO DO
 * Col C (2) = No SO
 * Col D (3) = Apotek / Pelanggan
 * Col E (4) = Tanggal SO
 * Col F (5) = Checker
 * Col G (6) = Durasi (mnt)
 * Col H (7) = Total Item
 * Col I (8) = Total Qty
 * Col J (9) = Barang Catatan
 * Col K (10) = Kategori (1P / 3P)
 * Col L (11) = Kategori Produk (FARMA / ALKES)
 * Col M (12) = Adjustment
 * Col N (13) = DONE
 */
function detectColumns(headers) {
  var map = {
    so: -1, noDo: -1, customer: -1, soDate: -1, waktuKirim: -1,
    checker: -1, packer: -1, picker: -1, kategori: -1, kategoriProduk: -1,
    totalItem: -1, totalQty: -1, barangCatatan: -1, done: -1
  };

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().trim();

    if (map.waktuKirim < 0 && (h.indexOf("waktu kirim") !== -1 || h.indexOf("waktu") !== -1 || h.indexOf("jam") !== -1)) map.waktuKirim = i;
    if (map.noDo < 0 && (h.indexOf("no do") !== -1 || h.indexOf("no. do") !== -1 || h === "do")) map.noDo = i;
    if (map.customer < 0 && (h.indexOf("apotek") !== -1 || h.indexOf("pelanggan") !== -1 || h.indexOf("customer") !== -1)) map.customer = i;
    if (map.soDate < 0 && (h.indexOf("tanggal so") !== -1 || h.indexOf("tgl so") !== -1 || h.indexOf("tanggal order") !== -1 || h.indexOf("tgl order") !== -1)) map.soDate = i;
    if (map.kategoriProduk < 0 && (h.indexOf("kategori produk") !== -1 || h.indexOf("kat produk") !== -1)) map.kategoriProduk = i;
    if (map.kategori < 0 && (h === "kategori" || h === "kat")) map.kategori = i;
    if (map.totalItem < 0 && (h.indexOf("total item") !== -1 || h.indexOf("item") !== -1)) map.totalItem = i;
    if (map.totalQty < 0 && (h.indexOf("total qty") !== -1 || h.indexOf("qty") !== -1)) map.totalQty = i;
    if (map.barangCatatan < 0 && (h.indexOf("barang c") !== -1 || h.indexOf("catatan") !== -1 || h.indexOf("brg c") !== -1)) map.barangCatatan = i;
    if (map.done < 0 && (h === "done" || h.indexOf("done") !== -1 || h === "status")) map.done = i;

    if (h.indexOf("tanggal") !== -1 || h.indexOf("tgl") !== -1 || h.indexOf("date") !== -1) {
      continue;
    }

    if (map.so < 0 && (h.indexOf("so selesai") !== -1 || h.indexOf("no so") !== -1 || h.indexOf("no. so") !== -1 || h === "so")) {
      map.so = i;
    }
    if (map.checker < 0 && (h.indexOf("checker") !== -1 || h.indexOf("qc 1") !== -1 || h === "qc1" || h === "qc")) {
      map.checker = i;
    }
    if (map.packer < 0 && (h.indexOf("packer") !== -1 || h.indexOf("packing") !== -1 || h.indexOf("qc 2") !== -1 || h === "qc2")) {
      map.packer = i;
    }
    if (map.picker < 0 && (h.indexOf("picker") !== -1 || h.indexOf("ambil") !== -1)) {
      map.picker = i;
    }
  }

  // Fallback persis urutan kolom tab "Rekap SO" Gudang MBI:
  if (map.waktuKirim < 0) map.waktuKirim = 0;       // Col A
  if (map.noDo < 0) map.noDo = 1;                   // Col B
  if (map.so < 0) map.so = 2;                       // Col C
  if (map.customer < 0) map.customer = 3;           // Col D
  if (map.soDate < 0) map.soDate = 4;               // Col E
  if (map.checker < 0) map.checker = 5;             // Col F
  if (map.totalItem < 0) map.totalItem = 7;         // Col H
  if (map.totalQty < 0) map.totalQty = 8;           // Col I
  if (map.barangCatatan < 0) map.barangCatatan = 9; // Col J: Jumlah Barang Catatan
  if (map.kategori < 0) map.kategori = 10;          // Col K
  if (map.kategoriProduk < 0) map.kategoriProduk = 11; // Col L
  if (map.done < 0) map.done = 13;                  // Col N: DONE

  return map;
}

/**
 * 3. PASANG TRIGGER OTOMATIS
 */
function setupAutoSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "autoSyncCheckers" || fn === "onEditSync") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("onEditSync").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("autoSyncCheckers").timeBased().everyMinutes(1).create();

  autoSyncCheckers();
}
