/**
 * Helper & Parser untuk Modul Report QC
 * Mengikuti logika pembacaan Catatan Barang & Rekap SO dari checker-do 100% presisi.
 */

export interface QcCatatanBarangEntry {
  waktuKirim: string;
  noDo: string;
  so: string;
  customer: string;
  name: string;
  kode: string;
  batch: string;
  batchBaru: string;
  ed?: string;
  edBaru?: string;
  qty: number | string;
  noteType: string;
  keterangan: string;
}

export interface QcReportRecord {
  warehouse: "MBI" | "MAI";
  so_number: string;
  no_do?: string | null;
  customer_name?: string | null;
  so_date?: string | null;
  waktu_kirim?: string | null;
  checker_name?: string | null;
  packer_name?: string | null;
  picker_name?: string | null;
  kategori?: string | null;
  kategori_produk?: string | null;
  total_item?: number;
  total_qty?: number;
  barang_catatan?: number;
  is_done?: string | null;
  done_by?: string | null;
  done_at?: string | null;
  noted_items?: QcCatatanBarangEntry[] | null;
  status?: string;
  sheet_row?: number;
  updated_at?: string;
}

export function parseNote(raw: any) {
  if (!raw || typeof raw === "string") {
    return { types: [], type: "", batch: "", ed: "", batchQty: null, batchChanges: [], qtyMinus: null, text: raw || "" };
  }
  const types = Array.isArray(raw.types) ? raw.types : raw.type ? [raw.type] : [];
  const _rawBC = raw.batchChanges;
  const batchChanges = _rawBC ? (Array.isArray(_rawBC) ? _rawBC : Object.values(_rawBC)) : [];
  return {
    types,
    type: types[0] || "",
    batch: raw.batch || (batchChanges[0] && (batchChanges[0] as any).batch) || "",
    ed: raw.ed || (batchChanges[0] && (batchChanges[0] as any).ed) || "",
    batchQty: raw.batchQty ?? null,
    batchChanges,
    qtyMinus: raw.qtyMinus ?? null,
    text: raw.text || "",
  };
}

export function adaCatatan(item: any): boolean {
  if (!item) return false;
  if (item.np || item.noShip) return true;
  const n = parseNote(item.note || "");
  return !!(n.types && n.types.length) || !!String(n.text || "").trim();
}

export function labelCatatan(item: any): string {
  const L: Record<string, string> = { BATCH: "PERUBAHAN BATCH", MINUS: "QTY MINUS", TAKEOUT: "TAKEOUT" };
  if (item && item.np) return item.npTipe === "MINUS" ? "QTY MINUS" : "TAKEOUT";
  const n = parseNote((item && item.note) || "");
  const t = (n.types || []).map((x: string) => L[x] || x);
  if (item && item.noShip) t.push("TANPA SHIPMENT");
  return t.join("+") || "CATATAN";
}

export function ketCatatan(item: any): string {
  const n = parseNote((item && item.note) || "");
  if (item && item.np) return (n.text ? n.text + " · " : "") + "tidak dipicking gudang";
  return (n.text || "") + (item && item.noShip ? (n.text ? " · " : "") + "nomor Shipment kosong" : "");
}

/**
 * Ekstraksi list Catatan Barang dari item list checker-do
 */
export function extractNotedItems(
  items: any[],
  meta: { waktuKirim: string; noDo: string; so: string; customer: string }
): QcCatatanBarangEntry[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const res: QcCatatanBarangEntry[] = [];

  for (const item of items) {
    if (!adaCatatan(item)) continue;
    const n = parseNote(item.note || "");
    res.push({
      waktuKirim: meta.waktuKirim,
      noDo: meta.noDo,
      so: meta.so,
      customer: meta.customer,
      name: item.name || item.nama_barang || "-",
      kode: String(item.kode || item.kode_barang || "-"),
      batch: item.batch || "-",
      batchBaru: n.batch || "-",
      ed: item.ed || "",
      edBaru: n.ed || "",
      qty: item.qty || 1,
      noteType: labelCatatan(item),
      keterangan: ketCatatan(item) || "-",
    });
  }
  return res;
}
