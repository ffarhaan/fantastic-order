import * as XLSX from "xlsx";
import { FakturRecord } from "./types";
import masterApotek from "./masterApotek.json";
import master2P from "./master2P.json";
import masterProduct from "./masterProduct.json";

const apotekMap = masterApotek as Record<string, string>;

export function normalize(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/apotik/g, "apotek")
    .replace(/[^a-z0-9]/g, "");
}

const normMap: Record<string, string> = {};
for (const [k, v] of Object.entries(apotekMap)) {
  normMap[normalize(k)] = v;
}

// 2P lookup structures
const master2PCodeMap = new Set<string>();
const master2PNameSet = new Set<string>();

master2P.forEach((item) => {
  if (item.codeNum) master2PCodeMap.add(item.codeNum);
  if (item.namaApotekMBI) master2PNameSet.add(normalize(item.namaApotekMBI));
  if (item.namaMerchant) master2PNameSet.add(normalize(item.namaMerchant));
});

// Product Category lookup structures (FARMA / ALKES / CCP / PREKURSOR / OOT)
const productCodeMap: Record<string, string> = {};
const productNameMap: Record<string, string> = {};
const productList: Array<{ norm: string; cat: string }> = [];

(masterProduct as Array<{
  kodeBarang?: string;
  kodeOracle?: string | number;
  kodeAccurate?: string | number;
  namaBarang: string;
  kategori: string;
}>).forEach((p) => {
  const cat = String(p.kategori || "").trim().toUpperCase();
  const codes = [p.kodeBarang, p.kodeOracle, p.kodeAccurate].filter(Boolean);
  codes.forEach((c) => {
    const cleanCode = String(c).trim();
    if (cleanCode) {
      productCodeMap[cleanCode] = cat;
      const numOnly = cleanCode.replace(/[^0-9]/g, "");
      if (numOnly) productCodeMap[numOnly] = cat;
    }
  });

  if (p.namaBarang) {
    const norm = normalize(p.namaBarang);
    productNameMap[norm] = cat;
    if (norm.length >= 8) {
      productList.push({ norm, cat });
    }
  }
});

export function getPrekursorOOTClassification(itemDescription?: string, itemCode?: string): "Prekursor" | "OOT" | null {
  if (itemCode) {
    const cleanCode = String(itemCode).trim();
    const cat = productCodeMap[cleanCode] || productCodeMap[cleanCode.replace(/[^0-9]/g, "")];
    if (cat === "PREKURSOR") return "Prekursor";
    if (cat === "OOT") return "OOT";
    if (cat === "FARMA" || cat === "ALKES" || cat === "CCP") return null;
  }

  if (itemDescription) {
    const norm = normalize(itemDescription);
    if (productNameMap[norm]) {
      const cat = productNameMap[norm];
      if (cat === "PREKURSOR") return "Prekursor";
      if (cat === "OOT") return "OOT";
      if (cat === "FARMA" || cat === "ALKES" || cat === "CCP") return null;
    }
  }

  if (!itemDescription || itemDescription === "-" || itemDescription === "Data DOO") return null;
  const s = " " + String(itemDescription).toUpperCase().replace(/[\t\r\n\s]+/g, " ") + " ";

  // OOT Matchers
  if (/\bLAPISIV[- ]?T\b/.test(s)) return "OOT";
  if (/\bSILADEX\s+(ANTITUSSIVE|DMP)\b/.test(s)) return "OOT";
  if (/\bPANADOL\s+(FLU\s*(&|\+|DAN)\s*BATUK|BATUK\s*(&|\+|DAN)\s*FLU)\b/.test(s)) return "OOT";
  if (/\bWOODS(\s+PEPPERMINT)?\s+ANTITUSSIVE\b/.test(s)) return "OOT";
  if (/\bOB[H]?\s+COMBI\s+ANTITUSSIVE\b/.test(s)) return "OOT";
  if (/\b(GRANTUSIF|IFARSYL|PROMEDEX|LODECON\s+FORTE)\b/.test(s)) return "OOT";
  if (/\bBODREX\s+FLU\s+(DAN|&|\+)\s*BATUK\b/.test(s)) return "OOT";
  if (/\bMIXAGRIP\s+FLU\s+(DAN|&|\+)\s*BATUK\b/.test(s)) return "OOT";
  if (/\bPROCOLD\s+FLU\s+(DAN|&|\+)\s*BATUK\b/.test(s)) return "OOT";
  if (/\bVICKS\s+FORMULA\s+44\b/.test(s) || /\bFORMULA\s+44\b/.test(s)) return "OOT";
  if (/\bKONIDIN\b/.test(s) && !/\bANAKONIDIN\b/.test(s)) return "OOT";

  // Prekursor Matchers
  if (/\bACTIFED\b/.test(s)) return "Prekursor";
  if (/\bALCO\b(?!\s*(HOL|KOHOL|N\b))/.test(s) && !/\bVALCOR\b/.test(s) && !/\bALCON\b/.test(s)) return "Prekursor";
  if (/\bALLERIN\b/.test(s)) return "Prekursor";
  if (/\bALPARA\b/.test(s)) return "Prekursor";
  if (/\bANADEX\b/.test(s) && !/\bLANADEXON\b/.test(s)) return "Prekursor";
  if (/\bANAKONIDIN\b/.test(s)) return "Prekursor";
  if (/\bCALORTUSIN\b/.test(s)) return "Prekursor";
  if (/\bCOPARCETIN\b/.test(s)) return "Prekursor";
  if (/\bDEMACOLIN\b/.test(s)) return "Prekursor";
  if (/\bDICOM\b/.test(s)) return "Prekursor";
  if (/\bDISUDRIN\b/.test(s)) return "Prekursor";
  if (/\bFLUTOP\b/.test(s)) return "Prekursor";
  if (/\bFLUVIR\b/.test(s)) return "Prekursor";
  if (/\bCROFED\b/.test(s)) return "Prekursor";
  if (/\bDECOLGEN\b/.test(s)) return "Prekursor";
  if (/\bINTUNAL\b/.test(s)) return "Prekursor";
  if (/\bLACOLDIN\b/.test(s)) return "Prekursor";
  if (/\bLANOS\b/.test(s) && !/\bLANOXIN\b/.test(s)) return "Prekursor";
  if (/\bDEXTRAL\b/.test(s) && !/\bDEXTROSE\b/.test(s)) return "Prekursor";
  if (/\bLAPIFED\b/.test(s)) return "Prekursor";
  if (/\bLAPISIV\b/.test(s) && !/\bLAPISIV[- ]?T\b/.test(s)) return "Prekursor";
  if (/\bMOLEXFLU\b/.test(s)) return "Prekursor";
  if (/\bFLUCADEX\b/.test(s)) return "Prekursor";
  if (/\bNEOZEP\b/.test(s)) return "Prekursor";
  if (/\bOBH\s+COMBI\b/.test(s) && /\b(BATUK\s*(PLUS|\&|\+)\s*FLU|BATUK\s*FLU|FLU)\b/.test(s)) return "Prekursor";
  if (/\bPANADOL\b.*\bCOLD\b/.test(s)) return "Prekursor";
  if (/\bPARATUSIN\b/.test(s)) return "Prekursor";
  if (/\bHUFAGRIPP\b.*\b(BP|BATUK\s*BERDAHAK\s*&\s*PILEK|BATUK\s*KERING\s*&\s*PILEK|FLU|PILEK)\b/.test(s)) return "Prekursor";
  if (/\bRHINOFED\b/.test(s)) return "Prekursor";
  if (/\bRHINOS\b/.test(s)) return "Prekursor";
  if (/\bRYVEL\s+PLUS\b/.test(s)) return "Prekursor";
  if (/\bSILADEX\b.*\b(COUGH\s*(&|\+|AND)\s*(COLD|FLU)|FLU)\b/.test(s) && !/\bHERBAL\b/.test(s)) return "Prekursor";
  if (/\bTELFAST\s+PLUS\b/.test(s)) return "Prekursor";
  if (/\bTRIAMINIC\b/.test(s)) return "Prekursor";
  if (/\bTRIFED\b/.test(s)) return "Prekursor";
  if (/\bTRIFEDRIN\b/.test(s)) return "Prekursor";
  if (/\bNALGESTAN\b/.test(s)) return "Prekursor";
  if (/\bSTOP\s+COLD\b/.test(s)) return "Prekursor";
  if (/\bDECOLSIN\b/.test(s)) return "Prekursor";
  if (/\bPIM[- ]?TRA[- ]?KOL\b/.test(s)) return "Prekursor";
  if (/\bFLUTROP\b/.test(s)) return "Prekursor";
  if (/\bNOZA\b/.test(s)) return "Prekursor";
  if (/\bINZA\b/.test(s)) return "Prekursor";
  if (/\bCOMTUSI\b.*\b(PILEK|ALERGI)\b/.test(s)) return "Prekursor";
  if (/\bEFLIN\b/.test(s)) return "Prekursor";
  if (/\bERICAF\b/.test(s)) return "Prekursor";
  if (/\bTERA[- ]?F\b/.test(s)) return "Prekursor";

  return null;
}

export function getProductCategory(
  itemCode?: string,
  itemDescription?: string,
  productOverrides?: Record<string, string>
): string {
  if (productOverrides && Object.keys(productOverrides).length > 0) {
    if (itemCode) {
      const cleanCode = String(itemCode).trim();
      if (productOverrides[cleanCode]) return productOverrides[cleanCode].toUpperCase();
      const numOnly = cleanCode.replace(/[^0-9]/g, "");
      if (numOnly && productOverrides[numOnly]) return productOverrides[numOnly].toUpperCase();
    }
    if (itemDescription) {
      const normDesc = normalize(itemDescription);
      if (productOverrides[normDesc]) return productOverrides[normDesc].toUpperCase();
      const trimmed = itemDescription.trim();
      if (productOverrides[trimmed]) return productOverrides[trimmed].toUpperCase();
    }
  }

  if (itemCode) {
    const cleanCode = String(itemCode).trim();
    if (productCodeMap[cleanCode]) return productCodeMap[cleanCode];
    const numOnly = cleanCode.replace(/[^0-9]/g, "");
    if (numOnly && productCodeMap[numOnly]) return productCodeMap[numOnly];
  }

  if (itemDescription) {
    const normDesc = normalize(itemDescription);
    if (productNameMap[normDesc]) return productNameMap[normDesc];
  }

  if (itemDescription || itemCode) {
    const prekOot = getPrekursorOOTClassification(itemDescription, itemCode);
    if (prekOot === "Prekursor") return "PREKURSOR";
    if (prekOot === "OOT") return "OOT";
  }

  if (itemDescription) {
    const normDesc = normalize(itemDescription);
    if (normDesc.length >= 8) {
      for (const item of productList) {
        if (normDesc.includes(item.norm) || item.norm.includes(normDesc)) {
          return item.cat;
        }
      }
    }

    const s = " " + String(itemDescription).toUpperCase() + " ";
    if (/\b(TABLET|TAB\b|KAPSUL|CAPSUL|CAP\b|SIRUP|SYRUP|DROP|INJEKSI|INJ\b|CREAM|KRIM|SALEP|OINTMENT|SUSPENSI|EMULSI|SUSP\b|LARUTAN|INFUS\b|PULVIS|SACHET)\b/.test(s)) {
      return "FARMA";
    }
    if (/\b(ALCOHOL|ALKOHOL|KASA|SPUIT|SYRINGE|JARUM|UNDERPAD|MASKER|INFUSION\s+SET|IV\s+CATHETER|HANDSCOON|GLOVES|TEST\s+PACK|URINE\s+BAG|THERMOMETER|TENSIMETER|SURGICAL|COTTON\s+BALL|KAPAS\s+PEMBALUT|SAFETY\s+BOX|ABOCATH|WINGS\s+NEEDLE|SURGICAL\s+TAPE|DERMAFIX|HYPAFIX|MICROPORE)\b/.test(s)) {
      return "ALKES";
    }
  }

  return "FARMA";
}

/**
 * ATURAN BAKU KLASIFIKASI TRANSAKSI (LOCKED):
 * - ORA: HANYA untuk PT Helios Alchemist Kesehatan / HAK / 1001.
 * - DOO: Semua transaksi reguler DOO.
 */
export function isOraCustomer(customerName?: string): boolean {
  const upperCust = String(customerName || "").toUpperCase().trim();
  return (
    upperCust.includes("HELIOS") ||
    upperCust.startsWith("HAK") ||
    upperCust.startsWith("IHC") ||
    upperCust.includes("CA-900001") ||
    upperCust === "1001"
  );
}

/**
 * ATURAN BAKU KATEGORI PRIORITAS (LOCKED):
 * - 1P: PT Helios (ORA) + Apotek Prioritas 1 DOO (Medika Prima, SBS, Pasti Hemat, Halomedika, Medika Akses).
 * - 2P: Apotek Prioritas 2 (dicek via master 2P).
 * - 3P: Apotek Reguler lainnya.
 */
export function categorize(
  jenisTransaksi: string,
  customerName: string,
  sourceFile?: string,
  shipToSite?: string,
  billToSite?: string
): "1P" | "2P" | "3P" {
  const cust = String(customerName || "").trim();
  const upper = cust.toUpperCase();
  const rawJenis = String(jenisTransaksi || "").toUpperCase();
  const rawSource = String(sourceFile || "").toUpperCase();

  if (
    rawSource.includes("ORA") ||
    rawJenis === "ORA" ||
    upper.includes("HELIOS") ||
    upper.startsWith("HAK") ||
    upper.startsWith("IHC") ||
    upper.includes("CA-900001") ||
    upper === "1001" ||
    upper.includes("HALOMEDIKA") ||
    upper.includes("MEDIKA PRIMA") ||
    upper.includes("SBS") ||
    upper.includes("PASTI HEMAT") ||
    upper.includes("MEDIKA AKSES")
  ) {
    return "1P";
  }

  if (shipToSite) {
    const num = String(shipToSite).replace(/[^0-9]/g, "").replace(/^0+/, "");
    if (num && master2PCodeMap.has(num)) return "2P";
  }

  if (billToSite) {
    const num = String(billToSite).replace(/[^0-9]/g, "").replace(/^0+/, "");
    if (num && master2PCodeMap.has(num)) return "2P";
  }

  const normCust = normalize(cust);
  if (master2PNameSet.has(normCust)) return "2P";

  const exact = apotekMap[cust.toLowerCase()];
  if (exact === "1P" || exact === "2P" || exact === "3P") return exact as "1P" | "2P" | "3P";

  const norm = normMap[normCust];
  if (norm === "1P" || norm === "2P" || norm === "3P") return norm as "1P" | "2P" | "3P";

  return "3P";
}

function detectDoubleInvoices(records: FakturRecord[]): void {
  const soInvMap: Record<string, Set<string>> = {};
  for (const r of records) {
    if (r.orderNumber && r.orderNumber !== "-") {
      if (!soInvMap[r.orderNumber]) soInvMap[r.orderNumber] = new Set();
      if (r.invoiceNumber && r.invoiceNumber !== "-") {
        soInvMap[r.orderNumber].add(r.invoiceNumber);
      }
    }
  }
  for (const r of records) {
    if (r.orderNumber && r.orderNumber !== "-" && soInvMap[r.orderNumber]?.size > 1) {
      r.isDoubleInv = true;
    }
  }
}

export function parseNumeric(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let s = String(val).trim();
  if (!s || s === "-" || s === "0") return 0;
  const isNegative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()]/g, "");
  s = s.replace(/^(rp|idr|\$)\s*/i, "").trim();

  if (s.includes(".") && s.includes(",")) {
    if (s.indexOf(".") < s.lastIndexOf(",")) {
      // Indonesian/EU: 1.234.567,89
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234,567.89
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    if (/,\d{3}$/.test(s) && !/,\d{1,2}$/.test(s)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  } else if (s.includes(".")) {
    if (/\.\d{3}(\.\d{3})*$/.test(s) || /^\d{1,3}\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, "");
    }
  }

  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return 0;
  return isNegative ? -Math.abs(n) : n;
}

export function normalizeDateStr(v: unknown): string {
  if (!v) return "-";
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    }
  }
  let s = String(v).trim();
  if (!s || s === "-" || s === "0") return "-";
  const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Number(mIso[3]))}/${pad(Number(mIso[2]))}/${mIso[1]}`;
  }
  const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mSlash) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Number(mSlash[1]))}/${pad(Number(mSlash[2]))}/${mSlash[3]}`;
  }
  const mDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (mDash) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Number(mDash[1]))}/${pad(Number(mDash[2]))}/${mDash[3]}`;
  }
  const mMon = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (mMon) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      mei: "05", ags: "08", agu: "08", okt: "10", des: "12"
    };
    const pad = (n: number) => String(n).padStart(2, "0");
    const mon = months[mMon[2].toLowerCase()] || "01";
    return `${pad(Number(mMon[1]))}/${mon}/${mMon[3]}`;
  }
  const m2Digit = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
  if (m2Digit) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yr = Number(m2Digit[3]) < 70 ? `20${m2Digit[3]}` : `19${m2Digit[3]}`;
    return `${pad(Number(m2Digit[1]))}/${pad(Number(m2Digit[2]))}/${yr}`;
  }
  return s;
}

function parseXXCUST(
  data: unknown[][],
  headerIdx: number,
  productOverrides?: Record<string, string>
): FakturRecord[] {
  // 1. Scan top metadata rows (rows 0 to headerIdx) for Entity (e.g. "Entity : MBI LE" or "Entity : MAI LE")
  let fileEntity: "MAI" | "MBI" | null = null;
  for (let r = 0; r < Math.min(headerIdx, 25); r++) {
    const row = data[r];
    if (!row) continue;
    for (const cell of row) {
      const s = String(cell || "").toUpperCase().trim();
      if (s.includes("MAI LE") || s.includes("MAI_LE") || s.includes("MAI BUSINESS UNIT")) {
        fileEntity = "MAI";
        break;
      } else if (s.includes("MBI LE") || s.includes("MBI_LE") || s.includes("MBI BUSINESS UNIT")) {
        fileEntity = "MBI";
        break;
      }
    }
    if (fileEntity) break;
  }

  // Fallback: If not found in metadata title rows, scan rows around header and first data rows
  if (!fileEntity) {
    for (let r = headerIdx; r < Math.min(data.length, headerIdx + 25); r++) {
      const row = data[r];
      if (!row) continue;
      for (const cell of row) {
        const s = String(cell || "").toUpperCase().trim();
        if (s.includes("MAI LE") || s.includes("MAI_LE") || s.includes("MAI BUSINESS UNIT")) {
          fileEntity = "MAI";
          break;
        } else if (s.includes("MBI LE") || s.includes("MBI_LE") || s.includes("MBI BUSINESS UNIT")) {
          fileEntity = "MBI";
          break;
        }
      }
      if (fileEntity) break;
    }
  }

  const header = data[headerIdx] as string[];
  const colMap: Record<string, number> = {};
  header.forEach((h: string, i: number) => {
    if (h) {
      const key = String(h).trim().toLowerCase();
      if (!colMap[key]) colMap[key] = i;
      const cleanKey = key.replace(/[^a-z0-9]/g, "");
      if (!colMap[cleanKey]) colMap[cleanKey] = i;
    }
  });

  const getCol = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const lk = k.toLowerCase().trim();
      const ck = lk.replace(/[^a-z0-9]/g, "");
      if (colMap[lk] !== undefined) return colMap[lk];
      if (colMap[ck] !== undefined) return colMap[ck];
    }
    // Partial substring match if exact key not found
    for (const k of keys) {
      const lk = k.toLowerCase().trim();
      for (const [colName, idx] of Object.entries(colMap)) {
        if (colName.includes(lk) || lk.includes(colName)) return idx;
      }
    }
    return undefined;
  };

  const idx = {
    entity: getCol("entity", "legal entity", "legal_entity", "le", "nama entity", "company"),
    businessUnit: getCol("business unit", "bu", "operating unit", "ou"),
    jenisTransaksi: getCol("jenis transaksi", "jenis", "transaction type", "trx type", "tipe transaksi", "source"),
    customerName: getCol("nama pelanggan", "customer name", "pelanggan", "customer", "customer / supplier name", "cust name", "nama customer", "nama apotek", "apotek", "ship-to customer", "bill-to customer", "nama pembeli"),
    customerCode: getCol("kode pelanggan", "customer code", "kode cust", "cust code", "customer / supplier number", "cust number", "kode apotek", "kode outlet", "customer no", "cust no"),
    invoiceNumber: getCol(
      "no invoice ar", "ar number", "ar no", "no ar", "invoice number", "no invoice",
      "no faktur", "nomor faktur", "no. faktur", "faktur", "invoice", "inv number",
      "inv no", "no inv", "no. inv", "nomor inv", "trx number", "transaction number",
      "no transaksi", "nomor transaksi", "doc number", "document number", "no dokumen",
      "nomor dokumen", "ar invoice", "no. invoice", "inv"
    ),
    transactionDate: getCol("transaction date", "tanggal transaksi", "tgl transaksi", "tanggal faktur", "tgl faktur", "invoice date", "inv date", "tanggal inv", "tgl inv", "trx date", "tx date"),
    orderDate: getCol("order date", "tanggal order", "date", "accounting date", "tgl order", "tgl so", "tanggal so", "so date", "tanggal pesanan", "tgl pesanan", "tanggal", "tgl"),
    accountingDate: getCol("accounting date", "tanggal akuntansi", "tgl akuntansi"),
    orderNumber: getCol("order number", "order no", "no order", "no so", "so number", "nomor order", "nomor pesanan", "no pesanan", "so no", "order", "sales order", "sales order no", "sales order number", "no sales order", "nomor sales order", "reference", "no ref", "ref no"),
    itemCode: getCol("item code", "kode barang", "kode produk", "kode item", "item", "item number", "item no", "product code", "part number", "kode obat", "sku", "kode"),
    itemDescription: getCol("item description", "nama barang", "deskripsi barang", "description", "item desc", "nama produk", "deskripsi produk", "item name", "nama item", "nama obat", "deskripsi", "product name"),
    qty: getCol("qty", "quantity", "jumlah", "kuantiti", "qty ordered", "ordered quantity", "shipped quantity", "qty shipped", "banyak", "vol", "volume"),
    uom: getCol("uom", "satuan", "unit", "unit of measure", "kemasan"),
    lotNumber: getCol("lot number", "batch number", "lot", "batch", "no lot", "no batch", "nomor lot", "nomor batch", "no. lot", "no. batch"),
    totalHarga: getCol("total harga", "total amount", "amount", "total", "nilai faktur", "harga total", "net amount", "line amount", "entered amount", "extended amount", "subtotal", "nilai", "grand total", "dpp", "total net"),
    segmentation: getCol("segmentation", "segmen", "segmentasi"),
    kategoriPPIC: getCol("nama kategori product", "kategori product", "kategori produk", "product category", "category"),
  };

  const records: FakturRecord[] = [];
  let lastOrderNumber = "";
  let lastInvoiceNumber = "";
  let lastCustomerName = "";
  let lastCustomerCode = "";
  let lastOrderDate = "";
  let lastTxDate = "";

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const val = (cIdx: number | undefined) => (cIdx !== undefined && cIdx >= 0 ? String(row[cIdx] ?? "").trim() : "");
    const rawVal = (cIdx: number | undefined) => (cIdx !== undefined && cIdx >= 0 ? row[cIdx] : undefined);

    let orderNumber = val(idx.orderNumber);
    let invoiceNumber = val(idx.invoiceNumber);

    const itemCode = val(idx.itemCode);
    const itemDescription = val(idx.itemDescription);
    const rawQty = rawVal(idx.qty) ?? val(idx.qty);
    const rawTotal = rawVal(idx.totalHarga) ?? val(idx.totalHarga);
    const hasItemData = Boolean(itemCode || itemDescription || rawQty || rawTotal);

    // Support merged cells / continuation rows where invoiceNumber is not repeated on each sub-item row
    if (!orderNumber && !invoiceNumber) {
      if (hasItemData && (lastInvoiceNumber || lastOrderNumber)) {
        orderNumber = lastOrderNumber;
        invoiceNumber = lastInvoiceNumber;
      } else {
        continue;
      }
    }

    // Fallback: if invoiceNumber is empty but orderNumber exists, use orderNumber
    if (!invoiceNumber && orderNumber) {
      invoiceNumber = orderNumber;
    }
    if (!orderNumber && invoiceNumber) {
      orderNumber = "-";
    }

    let customerName = val(idx.customerName);
    let customerCode = val(idx.customerCode);
    if (!customerName && lastCustomerName && invoiceNumber === lastInvoiceNumber) {
      customerName = lastCustomerName;
      customerCode = lastCustomerCode;
    }

    const isOra = isOraCustomer(customerName) || isOraCustomer(customerCode) || customerCode === "CA-900001";
    const jenisTransaksi: "ORA" | "DOO" = isOra ? "ORA" : "DOO";
    const kategori = categorize(jenisTransaksi, customerName, jenisTransaksi);

    const rawEntity = (val(idx.entity) || val(idx.businessUnit) || fileEntity || "").toUpperCase();
    let rowEntity: "MAI" | "MBI" = "MBI";
    if (rawEntity.includes("MAI")) {
      rowEntity = "MAI";
    } else if (rawEntity.includes("MBI")) {
      rowEntity = "MBI";
    }

    const cleanInv = invoiceNumber.replace(/-1P$/i, "");
    const baseKey = isOra ? `${cleanInv}-1P` : cleanInv;
    const invoiceKey = rowEntity === "MAI" ? `MAI-${baseKey}` : baseKey;

    let orderDate = normalizeDateStr(rawVal(idx.orderDate) ?? val(idx.orderDate));
    let txDate = idx.transactionDate !== undefined ? normalizeDateStr(rawVal(idx.transactionDate) ?? val(idx.transactionDate)) : undefined;
    if ((!orderDate || orderDate === "-") && lastOrderDate && invoiceNumber === lastInvoiceNumber) {
      orderDate = lastOrderDate;
    }
    if ((!txDate || txDate === "-") && lastTxDate && invoiceNumber === lastInvoiceNumber) {
      txDate = lastTxDate;
    }

    // Cache last valid headers for subsequent line items
    lastOrderNumber = orderNumber;
    lastInvoiceNumber = invoiceNumber;
    lastCustomerName = customerName;
    lastCustomerCode = customerCode;
    lastOrderDate = orderDate;
    lastTxDate = txDate || orderDate;

    const rawSeg = val(idx.segmentation).toUpperCase();
    const rawPPIC = val(idx.kategoriPPIC).toUpperCase();
    let kategoriProduk = getProductCategory(itemCode, itemDescription, productOverrides) || undefined;

    // Official Oracle PPIC Category Mapping
    if (rawPPIC.includes("CCP") || rawSeg.includes("CCP")) {
      kategoriProduk = "CCP";
    } else if (rawSeg.includes("ALAT KESEHATAN") || rawSeg.includes("MEDIS HABIS PAKAI")) {
      kategoriProduk = "ALKES";
    } else if (
      rawSeg.includes("OBAT") ||
      rawSeg.includes("HERBAL") ||
      rawSeg.includes("VITAMIN") ||
      rawSeg.includes("SUPLEMEN") ||
      rawSeg.includes("KONSUMEN")
    ) {
      if (kategoriProduk !== "PREKURSOR" && kategoriProduk !== "OOT") {
        kategoriProduk = "FARMA";
      }
    }

    const klasifikasiObat =
      kategoriProduk === "PREKURSOR"
        ? "Prekursor"
        : kategoriProduk === "OOT"
        ? "OOT"
        : getPrekursorOOTClassification(itemDescription, itemCode) || undefined;

    const parsedQty = parseNumeric(rawVal(idx.qty) ?? val(idx.qty));
    const parsedTotal = parseNumeric(rawVal(idx.totalHarga) ?? val(idx.totalHarga));

    records.push({
      orderDate: orderDate || "-",
      transactionDate: txDate,
      orderNumber: orderNumber || "-",
      invoiceNumber: invoiceNumber || "-",
      invoiceKey,
      jenisTransaksi,
      customerName: customerName || "-",
      itemCode: itemCode || "-",
      itemDescription: itemDescription || "-",
      qty: parsedQty || (rawVal(idx.qty) as number | string) || 0,
      uom: val(idx.uom) || "-",
      lotNumber: val(idx.lotNumber) || "-",
      totalHarga: parsedTotal,
      kategori,
      kategoriProduk,
      klasifikasiObat,
      entity: rowEntity,
      isDoubleInv: false,
      sourceFile: "XXCUST",
      rowIndex: i,
    });
  }

  if (records.length === 0) {
    throw new Error("⚠️ File Ditolak: File tidak memiliki baris data transaksi yang valid.");
  }

  // Strict Validation: File MUST contain Entity (MBI LE or MAI LE)
  const hasRecognizedEntity = fileEntity !== null || (idx.entity !== undefined) || (idx.businessUnit !== undefined);
  if (!hasRecognizedEntity) {
    throw new Error("⚠️ File Ditolak: Hanya file XXCUST resmi yang memiliki kolom Entity (MBI LE / MAI LE) yang diizinkan untuk diupload.");
  }

  detectDoubleInvoices(records);
  return records;
}

function parseHTMLTable(html: string): FakturRecord[] {
  const htmlUpper = html.toUpperCase();
  let htmlEntity: "MAI" | "MBI" = "MBI";
  if (htmlUpper.includes("MAI LE") || htmlUpper.includes("MAI_LE") || htmlUpper.includes("MAI BUSINESS UNIT")) {
    htmlEntity = "MAI";
  } else if (htmlUpper.includes("MBI LE") || htmlUpper.includes("MBI_LE") || htmlUpper.includes("MBI BUSINESS UNIT")) {
    htmlEntity = "MBI";
  }

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
  const stripHtml = (s: string) =>
    s
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"')
      .trim();

  let headerCells: string[] = [];
  let trMatch: RegExpExecArray | null;
  const rawRows: string[][] = [];

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowContent = trMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.push(stripHtml(cellMatch[1]));
    }
    if (cells.length > 0) rawRows.push(cells);
  }

  let dataStartIdx = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const texts = rawRows[i];
    if (texts.some((t) => {
      const s = t.toLowerCase();
      return (
        s.includes("reference") ||
        s.includes("transaction number") ||
        s.includes("order number") ||
        s.includes("no invoice") ||
        s.includes("no faktur") ||
        s.includes("entered amount")
      );
    })) {
      headerCells = texts;
      dataStartIdx = i + 1;
      break;
    }
  }

  if (!headerCells.length && rawRows.length > 0) {
    headerCells = rawRows[0];
    dataStartIdx = 1;
  }

  if (!headerCells.length) throw new Error("Header tabel tidak ditemukan di file export.");

  const colMap: Record<string, number> = {};
  headerCells.forEach((h, i) => {
    const s = h.toLowerCase().trim();
    if (s.includes("transaction date") || s.includes("tanggal transaksi") || s.includes("tanggal faktur")) {
      if (colMap["txDate"] === undefined) colMap["txDate"] = i;
    }
    if (s.includes("accounting date") || s.includes("order date") || s.includes("tanggal order") || s === "date" || s === "tanggal") {
      if (colMap["date"] === undefined) colMap["date"] = i;
    }
    if (s.includes("reference") || s.includes("order number") || s.includes("no order") || s.includes("no so") || s.includes("so number") || s.includes("sales order")) {
      if (colMap["so"] === undefined) colMap["so"] = i;
    }
    if (s.includes("transaction number") || s.includes("invoice number") || s.includes("no invoice") || s.includes("no faktur") || s.includes("nomor faktur") || s.includes("ar number") || s.includes("no inv") || s === "faktur" || s === "invoice") {
      if (colMap["inv"] === undefined) colMap["inv"] = i;
    }
    if (s.includes("ship-to customer") || s.includes("customer name") || s.includes("nama pelanggan") || s.includes("pelanggan") || s.includes("customer")) {
      if (colMap["customer"] === undefined) colMap["customer"] = i;
    }
    if (s.includes("bill-to customer") || s.includes("bill to")) {
      if (colMap["billTo"] === undefined) colMap["billTo"] = i;
    }
    if (s.includes("ship-to site")) colMap["shipSite"] = i;
    if (s.includes("bill-to customer site") || s.includes("bill-to site")) colMap["billSite"] = i;
    if (s.includes("transaction source") || s.includes("source") || s.includes("jenis")) colMap["source"] = i;
    if (s.includes("entered amount") || s.includes("total amount") || s.includes("amount") || s.includes("total") || s.includes("total harga") || s.includes("nilai faktur")) {
      if (colMap["amount"] === undefined) colMap["amount"] = i;
    }
  });

  const records: FakturRecord[] = [];
  for (let i = dataStartIdx; i < rawRows.length; i++) {
    const texts = rawRows[i];
    if (!texts || texts.length < 2) continue;
    if (texts[0] === "Context Value") continue;

    const soVal = (colMap["so"] !== undefined ? texts[colMap["so"]] : texts[1]) || "";
    const invVal = (colMap["inv"] !== undefined ? texts[colMap["inv"]] : texts[2]) || "";
    if (!soVal && !invVal) continue;

    const customerName = (colMap["customer"] !== undefined && texts[colMap["customer"]])
      ? texts[colMap["customer"]]
      : (colMap["billTo"] !== undefined && texts[colMap["billTo"]])
      ? texts[colMap["billTo"]]
      : "";
    const rawSource = String((colMap["source"] !== undefined ? texts[colMap["source"]] : "") || "").trim().toUpperCase();
    const isOra = rawSource.includes("ORA_") || isOraCustomer(customerName);
    const jenisTransaksi: "ORA" | "DOO" = isOra ? "ORA" : "DOO";

    const shipSite = colMap["shipSite"] !== undefined ? texts[colMap["shipSite"]] : "";
    const billSite = colMap["billSite"] !== undefined ? texts[colMap["billSite"]] : "";

    const kategori = isOra ? "1P" : categorize(jenisTransaksi, customerName, jenisTransaksi, shipSite, billSite);
    const finalInv = invVal || soVal;
    const cleanInv = finalInv.replace(/-1P$/i, "");
    const invoiceKey = isOra ? `${cleanInv}-1P` : cleanInv;
    const finalSO = isOra ? "-" : (soVal || "-");
    const txVal = colMap["txDate"] !== undefined ? texts[colMap["txDate"]] : undefined;
    const rawAmt = colMap["amount"] !== undefined ? texts[colMap["amount"]] : texts[11];
    const totalHarga = parseNumeric(rawAmt);

    records.push({
      orderDate: normalizeDateStr(texts[colMap["date"] ?? 0] || ""),
      transactionDate: txVal ? normalizeDateStr(txVal) : undefined,
      orderNumber: finalSO,
      invoiceNumber: finalInv,
      invoiceKey,
      jenisTransaksi,
      customerName,
      itemCode: "-",
      itemDescription: "-",
      qty: 1,
      uom: "-",
      lotNumber: "-",
      totalHarga,
      kategori,
      isDoubleInv: false,
      sourceFile: "EXPORT",
      rowIndex: i,
    });
  }

  detectDoubleInvoices(records);
  return records;
}

function parseExportArray(data: unknown[][], headerIdx: number): FakturRecord[] {
  let fileEntity: "MAI" | "MBI" = "MBI";
  for (let r = 0; r < Math.min(data.length, 30); r++) {
    const row = data[r];
    if (!row) continue;
    for (const cell of row) {
      const s = String(cell || "").toUpperCase().trim();
      if (s.includes("MAI LE") || s.includes("MAI_LE") || s.includes("MAI BUSINESS UNIT")) {
        fileEntity = "MAI";
        break;
      } else if (s.includes("MBI LE") || s.includes("MBI_LE") || s.includes("MBI BUSINESS UNIT")) {
        fileEntity = "MBI";
        break;
      }
    }
    if (fileEntity === "MAI") break;
  }

  const header = data[headerIdx] as string[];
  const colMap: Record<string, number> = {};
  header.forEach((h, i) => {
    if (!h) return;
    const s = String(h || "").toLowerCase().trim();
    if (s.includes("transaction date") || s.includes("tanggal transaksi") || s.includes("tanggal faktur")) {
      if (colMap["txDate"] === undefined) colMap["txDate"] = i;
    }
    if (s.includes("accounting date") || s.includes("order date") || s.includes("tanggal order") || s === "date" || s === "tanggal") {
      if (colMap["date"] === undefined) colMap["date"] = i;
    }
    if (s.includes("reference") || s.includes("order number") || s.includes("no order") || s.includes("no so") || s.includes("so number") || s.includes("sales order")) {
      if (colMap["so"] === undefined) colMap["so"] = i;
    }
    if (s.includes("transaction number") || s.includes("invoice number") || s.includes("no invoice") || s.includes("no faktur") || s.includes("nomor faktur") || s.includes("ar number") || s.includes("no inv") || s === "faktur" || s === "invoice") {
      if (colMap["inv"] === undefined) colMap["inv"] = i;
    }
    if (s.includes("ship-to customer") || s.includes("customer name") || s.includes("nama pelanggan") || s.includes("pelanggan") || s.includes("customer")) {
      if (colMap["customer"] === undefined) colMap["customer"] = i;
    }
    if (s.includes("bill-to customer") || s.includes("bill to")) {
      if (colMap["billTo"] === undefined) colMap["billTo"] = i;
    }
    if (s.includes("ship-to site")) colMap["shipSite"] = i;
    if (s.includes("bill-to customer site") || s.includes("bill-to site")) colMap["billSite"] = i;
    if (s.includes("transaction source") || s.includes("source") || s.includes("jenis")) colMap["source"] = i;
    if (s.includes("entered amount") || s.includes("total amount") || s.includes("amount") || s.includes("total") || s.includes("total harga") || s.includes("nilai faktur")) {
      if (colMap["amount"] === undefined) colMap["amount"] = i;
    }
  });

  const records: FakturRecord[] = [];
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;

    const soVal = String((colMap["so"] !== undefined ? row[colMap["so"]] : row[1]) ?? "").trim();
    const invVal = String((colMap["inv"] !== undefined ? row[colMap["inv"]] : row[2]) ?? "").trim();
    if (!soVal && !invVal) continue;
    if (soVal.toLowerCase() === "reference" || invVal.toLowerCase().includes("transaction number")) continue;

    const customerName = String(
      (colMap["customer"] !== undefined && row[colMap["customer"]] ? row[colMap["customer"]] : "") ||
      (colMap["billTo"] !== undefined && row[colMap["billTo"]] ? row[colMap["billTo"]] : "") ||
      row[3] || ""
    ).trim();

    const rawSource = String((colMap["source"] !== undefined ? row[colMap["source"]] : row[4]) || "").trim().toUpperCase();
    const isOra = rawSource.includes("ORA_") || isOraCustomer(customerName);
    const jenisTransaksi: "ORA" | "DOO" = isOra ? "ORA" : "DOO";

    const shipSite = String((colMap["shipSite"] !== undefined ? row[colMap["shipSite"]] : "") || "");
    const billSite = String((colMap["billSite"] !== undefined ? row[colMap["billSite"]] : "") || "");

    const kategori = isOra ? "1P" : categorize(jenisTransaksi, customerName, jenisTransaksi, shipSite, billSite);
    const finalInv = invVal || soVal;
    const cleanInv = finalInv.replace(/-1P$/i, "");
    const baseKey = isOra ? `${cleanInv}-1P` : cleanInv;
    const invoiceKey = fileEntity === "MAI" ? `MAI-${baseKey}` : baseKey;
    const rawAmount = colMap["amount"] !== undefined ? row[colMap["amount"]] : row[11];
    const totalHarga = parseNumeric(rawAmount);
    const finalSO = isOra ? "-" : (soVal || "-");
    const txVal = colMap["txDate"] !== undefined ? row[colMap["txDate"]] : undefined;

    records.push({
      orderDate: normalizeDateStr(row[colMap["date"] ?? 0]),
      transactionDate: txVal ? normalizeDateStr(txVal) : undefined,
      orderNumber: finalSO,
      invoiceNumber: finalInv,
      invoiceKey,
      jenisTransaksi,
      customerName,
      itemCode: "-",
      itemDescription: "-",
      qty: 1,
      uom: "-",
      lotNumber: "-",
      totalHarga,
      kategori,
      entity: fileEntity,
      isDoubleInv: false,
      sourceFile: "EXPORT",
      rowIndex: i,
    });
  }

  detectDoubleInvoices(records);
  return records;
}

export async function parseExcelFile(
  file: File,
  productOverrides?: Record<string, string>
): Promise<FakturRecord[]> {
  const buffer = await file.arrayBuffer();

  // 1. Try HTML format for Oracle .xls exports
  const headerSample = new TextDecoder().decode(buffer.slice(0, 4096)).toLowerCase();
  if (
    headerSample.includes("<table") ||
    headerSample.includes("<tr") ||
    headerSample.includes("<html") ||
    headerSample.includes("<!doctype") ||
    headerSample.includes("xmlns:") ||
    headerSample.includes("<?xml")
  ) {
    const fullText = new TextDecoder().decode(buffer);
    return parseHTMLTable(fullText);
  }

  // 2. Binary Excel format (.xlsx)
  try {
    const wb = XLSX.read(buffer, {
      type: "array",
      dense: true,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      cellStyles: false,
    });
    // Prioritize tab "Rekap Lengkap" if present in the workbook (Order Proses GSheet requirement)
    const sheetNames = wb.SheetNames;
    // Order sheets to check: prioritized first, then all others
    const prioritizedSheetNames = [
      ...sheetNames.filter((s) => {
        const l = s.toLowerCase();
        return l.includes("rekap") || l.includes("xxcust") || l.includes("gross") || l.includes("profit") || l.includes("data");
      }),
      ...sheetNames.filter((s) => {
        const l = s.toLowerCase();
        return !l.includes("rekap") && !l.includes("xxcust") && !l.includes("gross") && !l.includes("profit") && !l.includes("data");
      }),
    ];

    // Find the sheet and robust header row that contains the actual transactions
    for (const sheetName of prioritizedSheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const data = (ws["!data"]
        ? (ws["!data"] as Array<Array<{ v: unknown } | undefined>>).map((row) =>
            row ? row.map((c) => (c ? c.v : undefined)) : []
          )
        : XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })) as unknown[][];

      if (!data || data.length < 2) continue;

      // Find robust table header: At least 2 columns indicating a real data table
      // (prevents mistakenly matching top metadata title rows like "Entity : MBI LE")
      let headerIdx = data.findIndex((row) => {
        if (!row || row.length < 2) return false;
        let score = 0;
        for (const cell of row) {
          const s = String(cell || "").toLowerCase().trim();
          if (
            s.includes("no invoice") ||
            s.includes("ar number") ||
            s.includes("no faktur") ||
            s.includes("nomor faktur") ||
            s.includes("invoice number") ||
            s.includes("order number") ||
            s.includes("no so") ||
            s.includes("no order") ||
            s.includes("so number")
          ) {
            score += 2;
          } else if (
            s.includes("nama pelanggan") ||
            s.includes("customer name") ||
            s.includes("nama barang") ||
            s.includes("item description") ||
            s.includes("kode barang") ||
            s.includes("item code") ||
            s.includes("total harga") ||
            s.includes("total amount") ||
            s.includes("jenis transaksi")
          ) {
            score += 1;
          }
        }
        return score >= 2;
      });

      // Fallback: search for explicit invoice or order header
      if (headerIdx === -1) {
        headerIdx = data.findIndex(
          (row) =>
            row &&
            row.some((cell) => {
              const s = String(cell || "").toLowerCase().trim();
              return (
                s.includes("no invoice ar") ||
                s.includes("no invoice") ||
                s.includes("ar number") ||
                s.includes("order number") ||
                s.includes("no faktur") ||
                s.includes("nomor faktur") ||
                s.includes("invoice number")
              );
            })
        );
      }

      if (headerIdx !== -1) {
        try {
          const parsed = parseXXCUST(data, headerIdx, productOverrides);
          if (parsed && parsed.length > 0) {
            return parsed;
          }
        } catch (parseErr: any) {
          if (parseErr && parseErr.message && parseErr.message.includes("File Ditolak: Anda sedang membuka Gudang")) {
            throw parseErr;
          }
          // Try next sheet if available
        }
      }
    }

    throw new Error("⚠️ File Ditolak: Hanya file XXCUST resmi yang memiliki kolom Entity (MBI LE / MAI LE) yang diizinkan untuk diupload.");
  } catch (err: any) {
    if (err && err.message && err.message.includes("File Ditolak")) {
      throw err;
    }
    throw new Error("⚠️ File Ditolak: Hanya file XXCUST resmi yang memiliki kolom Entity (MBI LE / MAI LE) yang diizinkan untuk diupload.");
  }
}
