/**
 * ====================================================================
 * SINKRONISASI RESMI: SPREADSHEET "REPORT QC" (GUDANG MBI)
 * FANTASTIC ORDER REAL-TIME SINKRONISASI & REPORT QC PIPELINE
 *
 * ATURAN BAKU (SESUAI INSTRUKSI OPERASIONAL):
 * 1. NAMA PICKER, CHECKER, PACKER:
 *    - 100% DIAMBIL DARI TAB "Rekap Lengkap"
 *    - Disandingkan secara presisi berdasarkan NO SO ("No SO Selesai")
 * 2. TAB "Rekap SO":
 *    - CUMAN DIGUNAKAN UNTUK MENGAMBIL KOLOM "Catatan Barang" (Barang Catatan)
 *    - Tidak boleh menimpa nama Picker / Checker / Packer dari Rekap Lengkap!
 * 3. STATUS DONE:
 *    - Tidak disinkronkan secara realtime dari sheet (status dilakukan di sistem aplikasi)
 * 4. URUTAN ANTREAN REPORT QC DI APLIKASI:
 *    - Baris yang baru masuk / paling bawah di Google Sheet otomatis berada di ANTREAN PALING ATAS!
 * ====================================================================
 */

var WEB_APP_URL = "https://fantastic-order.vercel.app/api/tidb?action=sync_checkers&warehouse=MBI";

/**
 * Mendapatkan Sheet "Rekap Lengkap" (Sumber Utama Picker, Checker, Packer)
 */
function getRekapLengkapSheet(ss) {
  var s = ss.getSheetByName("Rekap Lengkap");
  if (s) return s;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim().toLowerCase();
    if (name === "rekap lengkap" || name.indexOf("rekap lengkap") !== -1 || name.indexOf("lengkap") !== -1) {
      return sheets[i];
    }
  }
  return null;
}

/**
 * Mendapatkan Sheet "Rekap SO" (Hanya untuk Catatan Barang & Metadata Antrean)
 */
function getRekapSOSheet(ss) {
  var s = ss.getSheetByName("Rekap SO");
  if (s) return s;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim().toLowerCase();
    if (name === "rekap so" || name.indexOf("rekap so") !== -1) {
      return sheets[i];
    }
  }
  return null;
}

/**
 * Deteksi Kolom Tab "Rekap Lengkap":
 * Col A: Tanggal SO
 * Col B: No SO Selesai (No SO)
 * Col C: Checker
 * Col D: Packer
 * Col E: Picker
 * Col F: SKU
 */
function detectLengkapColumns(headers) {
  var map = { soDate: -1, so: -1, checker: -1, packer: -1, picker: -1, sku: -1 };
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().trim();
    if (map.soDate < 0 && (h.indexOf("tanggal") !== -1 || h.indexOf("tgl") !== -1)) map.soDate = i;
    if (map.so < 0 && (h.indexOf("so selesai") !== -1 || h.indexOf("no so") !== -1 || h === "so" || h.indexOf("nomor so") !== -1)) map.so = i;
    if (map.checker < 0 && (h.indexOf("checker") !== -1 || h.indexOf("qc 1") !== -1 || h === "qc1" || h === "qc")) map.checker = i;
    if (map.packer < 0 && (h.indexOf("packer") !== -1 || h.indexOf("packing") !== -1 || h.indexOf("qc 2") !== -1 || h === "qc2")) map.packer = i;
    if (map.picker < 0 && (h.indexOf("picker") !== -1 || h.indexOf("ambil") !== -1)) map.picker = i;
    if (map.sku < 0 && h.indexOf("sku") !== -1) map.sku = i;
  }
  // Fallback standar posisi tab "Rekap Lengkap" Gudang MBI:
  if (map.soDate < 0) map.soDate = 0;   // Col A
  if (map.so < 0) map.so = 1;           // Col B (No SO Selesai)
  if (map.checker < 0) map.checker = 2; // Col C (Checker)
  if (map.packer < 0) map.packer = 3;   // Col D (Packer)
  if (map.picker < 0) map.picker = 4;   // Col E (Picker)
  if (map.sku < 0) map.sku = 5;         // Col F (SKU)
  return map;
}

/**
 * Deteksi Kolom Tab "Rekap SO":
 * Col A: Waktu Kirim | B: NO DO | C: No SO | D: Apotek | E: Tanggal SO
 * Col H: Total Item | I: Total Qty | Col J: Barang Catatan | K: Kat | L: Kat Produk
 */
function detectRekapSOColumns(headers) {
  var map = {
    waktuKirim: -1, noDo: -1, so: -1, customer: -1, soDate: -1,
    totalItem: -1, totalQty: -1, barangCatatan: -1,
    kategori: -1, kategoriProduk: -1
  };
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().trim();
    if (map.waktuKirim < 0 && (h.indexOf("waktu kirim") !== -1 || h.indexOf("waktu") !== -1 || h.indexOf("jam") !== -1)) map.waktuKirim = i;
    if (map.noDo < 0 && (h.indexOf("no do") !== -1 || h.indexOf("no. do") !== -1 || h === "do")) map.noDo = i;
    if (map.so < 0 && (h.indexOf("so selesai") !== -1 || h.indexOf("no so") !== -1 || h.indexOf("no. so") !== -1 || h === "so")) map.so = i;
    if (map.customer < 0 && (h.indexOf("apotek") !== -1 || h.indexOf("pelanggan") !== -1 || h.indexOf("customer") !== -1 || h.indexOf("nama apotek") !== -1)) map.customer = i;
    if (map.soDate < 0 && (h.indexOf("tanggal so") !== -1 || h.indexOf("tgl so") !== -1 || h.indexOf("order date") !== -1)) map.soDate = i;
    if (map.totalItem < 0 && (h.indexOf("total item") !== -1 || h.indexOf("item") !== -1)) map.totalItem = i;
    if (map.totalQty < 0 && (h.indexOf("total qty") !== -1 || h.indexOf("qty") !== -1)) map.totalQty = i;
    if (map.barangCatatan < 0 && (h.indexOf("barang c") !== -1 || h.indexOf("catatan") !== -1 || h.indexOf("brg c") !== -1)) map.barangCatatan = i;
    if (map.kategori < 0 && (h === "kategori" || h === "kat")) map.kategori = i;
    if (map.kategoriProduk < 0 && (h.indexOf("kategori produk") !== -1 || h.indexOf("kat produk") !== -1 || h.indexOf("produk") !== -1)) map.kategoriProduk = i;
  }
  // Fallback standar posisi kolom tab "Rekap SO" Gudang MBI:
  if (map.waktuKirim < 0) map.waktuKirim = 0;       // Col A
  if (map.noDo < 0) map.noDo = 1;                   // Col B
  if (map.so < 0) map.so = 2;                       // Col C
  if (map.customer < 0) map.customer = 3;           // Col D
  if (map.soDate < 0) map.soDate = 4;               // Col E
  if (map.totalItem < 0) map.totalItem = 7;         // Col H
  if (map.totalQty < 0) map.totalQty = 8;           // Col I
  if (map.barangCatatan < 0) map.barangCatatan = 9; // Col J: Jumlah Barang Catatan
  if (map.kategori < 0) map.kategori = 10;          // Col K
  if (map.kategoriProduk < 0) map.kategoriProduk = 11; // Col L
  return map;
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
 * 1. SINKRONISASI INSTAN SAAT EDIT (<1 DETIK)
 * Bekerja pada tab "Rekap Lengkap" (Picker/Checker/Packer) dan "Rekap SO" (Catatan Barang)
 */
function onEditReportQcMBI(e) {
  try {
    if (!e || !e.range) {
      syncReportQcMBI();
      return;
    }

    var sheet = e.range.getSheet();
    var sheetName = sheet.getName().trim().toLowerCase();

    var isLengkap = (sheetName === "rekap lengkap" || sheetName.indexOf("rekap lengkap") !== -1 || sheetName.indexOf("lengkap") !== -1);
    var isSO = (sheetName === "rekap so" || sheetName.indexOf("rekap so") !== -1);

    if (!isLengkap && !isSO) return;

    var startRow = e.range.getRow();
    var numRows = e.range.getNumRows();
    if (startRow + numRows - 1 <= 1) return;

    var actualStart = Math.max(2, startRow);
    var actualNumRows = (startRow + numRows - 1) - actualStart + 1;

    var lastCol = Math.max(12, sheet.getLastColumn());
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var dataRange = sheet.getRange(actualStart, 1, actualNumRows, lastCol).getValues();
    var itemsToSend = [];

    if (isLengkap) {
      var colMapL = detectLengkapColumns(headers);
      for (var r = 0; r < dataRange.length; r++) {
        var rowL = dataRange[r];
        var soValL = String(rowL[colMapL.so] || "").trim();
        if (!soValL || soValL === "-" || soValL === "#N/A") continue;

        var checkerVal = colMapL.checker >= 0 ? cleanStaffName(rowL[colMapL.checker]) : "";
        var packerVal = colMapL.packer >= 0 ? cleanStaffName(rowL[colMapL.packer]) : "";
        var pickerVal = colMapL.picker >= 0 ? cleanStaffName(rowL[colMapL.picker]) : "";
        var soDateVal = colMapL.soDate >= 0 ? String(rowL[colMapL.soDate] || "").trim() : "";
        var rowNumberL = actualStart + r;

        itemsToSend.push({
          so: soValL,
          checker: checkerVal,
          packer: packerVal,
          picker: pickerVal,
          so_date: soDateVal,
          sheet_row: rowNumberL,
          source: "rekap_lengkap",
          warehouse: "MBI"
        });
      }
    } else if (isSO) {
      var colMapS = detectRekapSOColumns(headers);
      for (var s = 0; s < dataRange.length; s++) {
        var rowS = dataRange[s];
        var soValS = String(rowS[colMapS.so] || "").trim();
        if (!soValS || soValS === "-" || soValS === "#N/A") continue;

        var brgCatatan = colMapS.barangCatatan >= 0 ? Number(rowS[colMapS.barangCatatan]) || 0 : 0;
        var cust = colMapS.customer >= 0 ? String(rowS[colMapS.customer] || "").trim() : "";
        var noDo = colMapS.noDo >= 0 ? String(rowS[colMapS.noDo] || "").trim() : "";
        var waktuKirim = colMapS.waktuKirim >= 0 ? String(rowS[colMapS.waktuKirim] || "").trim() : "";
        var kat = colMapS.kategori >= 0 ? String(rowS[colMapS.kategori] || "").trim() : "";
        var katProd = colMapS.kategoriProduk >= 0 ? String(rowS[colMapS.kategoriProduk] || "").trim() : "";
        var totItem = colMapS.totalItem >= 0 ? Number(rowS[colMapS.totalItem]) || 0 : 0;
        var totQty = colMapS.totalQty >= 0 ? Number(rowS[colMapS.totalQty]) || 0 : 0;
        var rowNumberS = actualStart + s;

        itemsToSend.push({
          so: soValS,
          no_do: noDo,
          customer: cust,
          waktu_kirim: waktuKirim,
          kategori: kat,
          kategori_produk: katProd,
          total_item: totItem,
          total_qty: totQty,
          barang_catatan: brgCatatan,
          sheet_row: rowNumberS,
          source: "rekap_so",
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
    Logger.log("Error onEditReportQcMBI: " + err);
  }
}

/**
 * 2. SINKRONISASI BATCH MENYELURUH (SETIAP 1 MENIT)
 * - TAB "Rekap Lengkap": Sumber 100% mutlak untuk Picker, Checker, dan Packer
 * - TAB "Rekap SO": CUMAN untuk mengambil Catatan Barang (dan info pendukung no_do/customer)
 * - STATUS DONE: Gak usah disinkronkan dari sheet
 * - sheet_row: Dikirim agar urutan antrean Report QC di aplikasi selalu menempatkan order terbaru di paling atas!
 */
function syncReportQcMBI() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetLengkap = getRekapLengkapSheet(ss);
    var sheetSO = getRekapSOSheet(ss);

    if (!sheetLengkap && !sheetSO) {
      Logger.log("⚠️ GAGAL: Tab 'Rekap Lengkap' atau 'Rekap SO' tidak ditemukan.");
      return;
    }

    var itemsMap = {}; // key: so -> merged item
    var soOrder = [];

    // 1. Baca TAB "Rekap Lengkap" terlebih dahulu (Sumber Utama Staff QC)
    if (sheetLengkap) {
      var lastColLengkap = Math.max(6, sheetLengkap.getLastColumn());
      var maxRowsLengkap = sheetLengkap.getLastRow();
      if (maxRowsLengkap > 1) {
        var headersLengkap = sheetLengkap.getRange(1, 1, 1, lastColLengkap).getValues()[0];
        var colMapLengkap = detectLengkapColumns(headersLengkap);

        var soColVals = sheetLengkap.getRange(1, colMapLengkap.so + 1, maxRowsLengkap, 1).getValues();
        var actualLastRow = 1;
        for (var k = soColVals.length - 1; k >= 0; k--) {
          var val = String(soColVals[k][0] || "").trim();
          if (val && val !== "-" && val !== "#N/A" && val.toLowerCase() !== "no so" && val.toLowerCase() !== "so selesai") {
            actualLastRow = k + 1;
            break;
          }
        }

        if (actualLastRow > 1) {
          var startRow = Math.max(2, actualLastRow - 999);
          var numRows = actualLastRow - startRow + 1;
          var dataLengkap = sheetLengkap.getRange(startRow, 1, numRows, lastColLengkap).getValues();

          for (var r = 0; r < dataLengkap.length; r++) {
            var row = dataLengkap[r];
            var soVal = String(row[colMapLengkap.so] || "").trim();
            if (!soVal || soVal === "-" || soVal === "#N/A") continue;

            var checkerVal = colMapLengkap.checker >= 0 ? cleanStaffName(row[colMapLengkap.checker]) : "";
            var packerVal = colMapLengkap.packer >= 0 ? cleanStaffName(row[colMapLengkap.packer]) : "";
            var pickerVal = colMapLengkap.picker >= 0 ? cleanStaffName(row[colMapLengkap.picker]) : "";
            var soDateVal = colMapLengkap.soDate >= 0 ? String(row[colMapLengkap.soDate] || "").trim() : "";
            var rowNumber = startRow + r;

            if (!itemsMap[soVal]) {
              soOrder.push(soVal);
            }
            itemsMap[soVal] = {
              so: soVal,
              checker: checkerVal,
              packer: packerVal,
              picker: pickerVal,
              so_date: soDateVal,
              barang_catatan: 0,
              sheet_row: rowNumber,
              source: "rekap_lengkap",
              warehouse: "MBI"
            };
          }
        }
      }
    }

    // 2. Baca TAB "Rekap SO" HANYA UNTUK KOLOM CATATAN BARANG
    if (sheetSO) {
      var lastColSO = Math.max(12, sheetSO.getLastColumn());
      var maxRowsSO = sheetSO.getLastRow();
      if (maxRowsSO > 1) {
        var headersSO = sheetSO.getRange(1, 1, 1, lastColSO).getValues()[0];
        var colMapSO = detectRekapSOColumns(headersSO);

        var soColValsSO = sheetSO.getRange(1, colMapSO.so + 1, maxRowsSO, 1).getValues();
        var actualLastRowSO = 1;
        for (var m = soColValsSO.length - 1; m >= 0; m--) {
          var valSO = String(soColValsSO[m][0] || "").trim();
          if (valSO && valSO !== "-" && valSO !== "#N/A" && valSO.toLowerCase() !== "no so") {
            actualLastRowSO = m + 1;
            break;
          }
        }

        if (actualLastRowSO > 1) {
          var startRowSO = Math.max(2, actualLastRowSO - 999);
          var numRowsSO = actualLastRowSO - startRowSO + 1;
          var dataSO = sheetSO.getRange(startRowSO, 1, numRowsSO, lastColSO).getValues();

          for (var s = 0; s < dataSO.length; s++) {
            var rowSO = dataSO[s];
            var soKey = String(rowSO[colMapSO.so] || "").trim();
            if (!soKey || soKey === "-" || soKey === "#N/A") continue;

            var brgCatatan = colMapSO.barangCatatan >= 0 ? Number(rowSO[colMapSO.barangCatatan]) || 0 : 0;
            var cust = colMapSO.customer >= 0 ? String(rowSO[colMapSO.customer] || "").trim() : "";
            var noDo = colMapSO.noDo >= 0 ? String(rowSO[colMapSO.noDo] || "").trim() : "";
            var waktuKirim = colMapSO.waktuKirim >= 0 ? String(rowSO[colMapSO.waktuKirim] || "").trim() : "";
            var kat = colMapSO.kategori >= 0 ? String(rowSO[colMapSO.kategori] || "").trim() : "";
            var katProd = colMapSO.kategoriProduk >= 0 ? String(rowSO[colMapSO.kategoriProduk] || "").trim() : "";
            var totItem = colMapSO.totalItem >= 0 ? Number(rowSO[colMapSO.totalItem]) || 0 : 0;
            var totQty = colMapSO.totalQty >= 0 ? Number(rowSO[colMapSO.totalQty]) || 0 : 0;
            var rowNumberSO = startRowSO + s;

            if (itemsMap[soKey]) {
              // HANYA ambil barang_catatan & metadata pendukung dari Rekap SO
              // Checker, Packer, Picker TETAP DIAMBIL DARI REKAP LENGKAP!
              itemsMap[soKey].barang_catatan = brgCatatan;
              itemsMap[soKey].sheet_row = Math.max(itemsMap[soKey].sheet_row || 0, rowNumberSO);
              if (cust) itemsMap[soKey].customer = cust;
              if (noDo) itemsMap[soKey].no_do = noDo;
              if (waktuKirim) itemsMap[soKey].waktu_kirim = waktuKirim;
              if (kat) itemsMap[soKey].kategori = kat;
              if (katProd) itemsMap[soKey].kategori_produk = katProd;
              if (totItem > 0) itemsMap[soKey].total_item = totItem;
              if (totQty > 0) itemsMap[soKey].total_qty = totQty;
            } else {
              // Jika SO belum tercatat di Rekap Lengkap, daftarkan dengan barang_catatan
              soOrder.push(soKey);
              itemsMap[soKey] = {
                so: soKey,
                no_do: noDo,
                customer: cust,
                waktu_kirim: waktuKirim,
                kategori: kat,
                kategori_produk: katProd,
                total_item: totItem,
                total_qty: totQty,
                barang_catatan: brgCatatan,
                sheet_row: rowNumberSO,
                checker: "",
                packer: "",
                picker: "",
                source: "rekap_so",
                warehouse: "MBI"
              };
            }
          }
        }
      }
    }

    var itemsToSend = [];
    for (var i = 0; i < soOrder.length; i++) {
      var it = itemsMap[soOrder[i]];
      if (it && (it.checker || it.packer || it.picker || it.barang_catatan > 0 || it.customer)) {
        itemsToSend.push(it);
      }
    }

    if (itemsToSend.length > 0) {
      var CHUNK = 200;
      for (var c = 0; c < itemsToSend.length; c += CHUNK) {
        var chunk = itemsToSend.slice(c, c + CHUNK);
        UrlFetchApp.fetch(WEB_APP_URL, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ items: chunk }),
          muteHttpExceptions: true
        });
      }
      Logger.log("✅ Berhasil sync " + itemsToSend.length + " baris (Picker/Checker/Packer dari Rekap Lengkap, Catatan Barang dari Rekap SO, dengan Urutan Antrean Teratas).");
    }
  } catch (err) {
    Logger.log("Error syncReportQcMBI: " + err);
  }
}

/**
 * 3. PASANG TRIGGER OTOMATIS (MBI)
 * Jalankan fungsi ini SEKALI di Google Apps Script untuk mengaktifkan sinkronisasi otomatis
 */
function setupReportQcMBI() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "syncReportQcMBI" || fn === "onEditReportQcMBI" || fn === "autoSyncCheckers" || fn === "onEditSync") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("onEditReportQcMBI").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("syncReportQcMBI").timeBased().everyMinutes(1).create();

  syncReportQcMBI();
  Logger.log("🚀 Trigger Berhasil Dipasang: OnEdit (<1 detik) & Timer (1 menit).");
}

function autoSyncCheckers() {
  syncReportQcMBI();
}

function onEditSync(e) {
  onEditReportQcMBI(e);
}

function setupAutoSyncTrigger() {
  setupReportQcMBI();
}
