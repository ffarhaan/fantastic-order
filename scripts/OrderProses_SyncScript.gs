/**
 * ====================================================================
 * SINKRONISASI RESMI: SPREADSHEET "REPORT QC" (GUDANG MBI - TAB: Rekap Lengkap)
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

      // Sanitasi nilai agar tidak salah ambil
      packerVal = cleanStaffName(packerVal);
      pickerVal = cleanStaffName(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal || custVal)) {
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

      // Sanitasi nilai
      packerVal = cleanStaffName(packerVal);
      pickerVal = cleanStaffName(pickerVal);

      if (soVal && soVal !== "-" && soVal !== "#N/A" && (checkerVal || packerVal || pickerVal || custVal)) {
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
          warehouse: "MBI"
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
  var map = {
    so: -1, noDo: -1, customer: -1, soDate: -1, waktuKirim: -1,
    checker: -1, packer: -1, picker: -1, kategori: -1, kategoriProduk: -1,
    totalItem: -1, totalQty: -1
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

    // Abaikan kata tanggal/tgl saat deteksi SO agar Tanggal SO tidak dianggap No SO
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

  // Posisi fallback baku pada tab "Rekap Lengkap" MBI:
  // Col A (0) = Waktu Kirim
  // Col B (1) = No DO
  // Col C (2) = No SO
  // Col D (3) = Apotek / Pelanggan
  // Col E (4) = Tanggal SO
  // Col F (5) = Checker
  // Col K (10) = Kategori (1P / 3P)
  // Col L (11) = Kategori Produk (FARMA / ALKES)
  if (map.waktuKirim < 0) map.waktuKirim = 0;
  if (map.noDo < 0) map.noDo = 1;
  if (map.so < 0) map.so = 2;
  if (map.customer < 0) map.customer = 3;
  if (map.soDate < 0) map.soDate = 4;
  if (map.checker < 0) map.checker = 5;
  if (map.kategori < 0) map.kategori = 10;
  if (map.kategoriProduk < 0) map.kategoriProduk = 11;

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
