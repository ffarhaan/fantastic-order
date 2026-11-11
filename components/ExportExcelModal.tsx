"use client";

import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { FakturGroup } from "@/lib/types";
import {
  Building2,
  Download,
  FileSpreadsheet,
  Layers,
  Calendar,
  Filter,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  Search,
  ChevronDown,
  ChevronUp,
  CheckSquare,
} from "lucide-react";

export type ExportSpecialFilter = "all" | "retur" | "double" | "retur_or_double";
export type ExportGranularity = "summary" | "detail";

export interface CheckerResolvedInfo {
  checker?: string;
  packer?: string;
  picker?: string;
}

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: FakturGroup[];
  isDarkMode?: boolean;
  initialWarehouse?: "ALL" | "MBI" | "MAI" | string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialDateBasis?: "order" | "transaction";
  initialSpecialFilter?: ExportSpecialFilter;
  initialStatusFilter?: "all" | "printed" | "unprinted";
  initialJenisFilter?: "all" | "ORA" | "DOO";
  initialKatFilter?: "all" | "1P" | "2P" | "3P";
  initialDklkFilter?: "all" | "DK" | "LK";
  initialKlasFilter?: "all" | "prekursor" | "oot" | "ccp" | "alkes" | "farma";
  initialSearch?: string;
  resolveChecker?: (g: FakturGroup) => CheckerResolvedInfo | null;
}

const ALL_EXPORT_COLUMNS = [
  { id: "no", label: "No" },
  { id: "entity_name", label: "Gudang / Entitas" },
  { id: "entity_code", label: "Kode Gudang" },
  { id: "no_so", label: "No SO" },
  { id: "no_invoice", label: "No Invoice" },
  { id: "special_note", label: "Keterangan Khusus (Retur/Double)" },
  { id: "order_date", label: "Tanggal Order (SO)" },
  { id: "tx_date", label: "Tanggal Faktur (Tx)" },
  { id: "kat_produk", label: "Kat Produk" },
  { id: "jenis_transaksi", label: "Jenis Transaksi" },
  { id: "pelanggan", label: "Pelanggan" },
  { id: "kategori", label: "Kategori (1P/2P/3P)" },
  { id: "wilayah", label: "Wilayah (DK/LK)" },
  { id: "checker", label: "Checker" },
  { id: "packer", label: "Packer" },
  { id: "picker", label: "Picker" },
  { id: "status_cetak", label: "Status Cetak" },
  { id: "waktu_cetak", label: "Waktu Cetak" },
  { id: "dicetak_oleh", label: "Dicetak Oleh" },
  { id: "jumlah_item", label: "Jumlah Item" },
  { id: "dpp", label: "Subtotal (DPP)" },
  { id: "ppn", label: "PPN (11%)" },
  { id: "grand_total", label: "Total Harga (Grand Total)" },
] as const;

type ExportColumnId = (typeof ALL_EXPORT_COLUMNS)[number]["id"];

const DEFAULT_SELECTED_COLS: ExportColumnId[] = ALL_EXPORT_COLUMNS.map((c) => c.id);

const MONTH_NAME_MAP: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  MEI: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  AGU: "08",
  SEP: "09",
  OCT: "10",
  OKT: "10",
  NOV: "11",
  DEC: "12",
  DES: "12",
};

function parseInvNum(inv: string): number {
  if (!inv) return 0;
  const s = String(inv).trim().replace(/-1P$/i, "");
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function orderDateToIso(dStr: string): string | null {
  if (!dStr || dStr === "-" || dStr === "0") return null;
  const s = String(dStr).trim();
  const pad = (n: number | string) => String(n).padStart(2, "0");

  // DD/MM/YYYY
  const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mSlash) {
    return `${mSlash[3]}-${pad(mSlash[2])}-${pad(mSlash[1])}`;
  }
  // YYYY-MM-DD or YYYY/MM/DD
  const mIso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (mIso) {
    return `${mIso[1]}-${pad(mIso[2])}-${pad(mIso[3])}`;
  }
  // DD-MM-YYYY
  const mDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (mDash) {
    return `${mDash[3]}-${pad(mDash[2])}-${pad(mDash[1])}`;
  }
  // Oracle DD-MMM-YYYY or DD-MMM-YY (e.g. 11-NOV-2026)
  const mMon = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})/);
  if (mMon) {
    const mon = MONTH_NAME_MAP[mMon[2].toUpperCase()];
    if (mon) {
      const yr = mMon[3].length === 2 ? `20${mMon[3]}` : mMon[3];
      return `${yr}-${mon}-${pad(mMon[1])}`;
    }
  }
  return null;
}

function isoToDisplayDate(iso: string): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}

function formatPrintTime(dStr?: string | null): string {
  if (!dStr) return "-";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dStr;
  }
}

function formatRupiah(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "0";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ExportExcelModal({
  isOpen,
  onClose,
  groups,
  isDarkMode,
  initialWarehouse = "ALL",
  initialStartDate = "",
  initialEndDate = "",
  initialDateBasis = "order",
  initialSpecialFilter = "all",
  initialStatusFilter = "all",
  initialJenisFilter = "all",
  initialKatFilter = "all",
  initialDklkFilter = "all",
  initialKlasFilter = "all",
  initialSearch = "",
  resolveChecker,
}: ExportExcelModalProps) {
  const [warehouseFilter, setWarehouseFilter] = useState<"ALL" | "MBI" | "MAI">("ALL");
  const [dateBasis, setDateBasis] = useState<"order" | "transaction">("order");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "printed" | "unprinted">("all");
  const [jenisFilter, setJenisFilter] = useState<"all" | "ORA" | "DOO">("all");
  const [katFilter, setKatFilter] = useState<"all" | "1P" | "2P" | "3P">("all");
  const [dklkFilter, setDklkFilter] = useState<"all" | "DK" | "LK">("all");
  const [klasFilter, setKlasFilter] = useState<"all" | "prekursor" | "oot" | "ccp" | "alkes" | "farma">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [specialFilter, setSpecialFilter] = useState<ExportSpecialFilter>("all");
  const [splitSpecialSheets, setSplitSpecialSheets] = useState<boolean>(false);
  const [exportGranularity, setExportGranularity] = useState<ExportGranularity>("summary");
  const [showColumnPicker, setShowColumnPicker] = useState<boolean>(false);
  const [selectedCols, setSelectedCols] = useState<Set<ExportColumnId>>(() => new Set(DEFAULT_SELECTED_COLS));

  // Sync initial props cleanly whenever modal opens (prevents stale date/filter carryover)
  useEffect(() => {
    if (isOpen) {
      if (initialWarehouse === "MBI" || initialWarehouse === "MAI" || initialWarehouse === "ALL") {
        setWarehouseFilter(initialWarehouse as "ALL" | "MBI" | "MAI");
      }
      setStartDate(initialStartDate || "");
      setEndDate(initialEndDate || "");
      setDateBasis(initialDateBasis || "order");
      setSpecialFilter(initialSpecialFilter || "all");
      setStatusFilter(initialStatusFilter || "all");
      setJenisFilter(initialJenisFilter || "all");
      setKatFilter(initialKatFilter || "all");
      setDklkFilter(initialDklkFilter || "all");
      setKlasFilter(initialKlasFilter || "all");
      setSearchQuery(initialSearch || "");
      setSplitSpecialSheets(false);
    }
  }, [
    isOpen,
    initialWarehouse,
    initialStartDate,
    initialEndDate,
    initialDateBasis,
    initialSpecialFilter,
    initialStatusFilter,
    initialJenisFilter,
    initialKatFilter,
    initialDklkFilter,
    initialKlasFilter,
    initialSearch,
  ]);

  const availableDates = useMemo(() => {
    const isoDates: string[] = [];
    groups.forEach((g) => {
      const dStr = dateBasis === "transaction" ? (g.transactionDate || g.orderDate) : g.orderDate;
      const iso = orderDateToIso(dStr);
      if (iso) isoDates.push(iso);
    });
    isoDates.sort();
    return {
      min: isoDates.length > 0 ? isoDates[0] : "",
      max: isoDates.length > 0 ? isoDates[isoDates.length - 1] : "",
    };
  }, [groups, dateBasis]);

  // System-wide raw totals (100% unfiltered) for transparency
  const systemTotals = useMemo(() => {
    let totalAll = 0;
    let totalMbi = 0;
    let totalMai = 0;
    let totalRetur = 0;
    let totalDouble = 0;
    for (const g of groups) {
      totalAll++;
      if ((g.entity || "MBI") === "MAI") totalMai++;
      else totalMbi++;
      if (g.isRetur) totalRetur++;
      if (g.isDoubleInv) totalDouble++;
    }
    return { totalAll, totalMbi, totalMai, totalRetur, totalDouble };
  }, [groups]);

  // Filter matching data across all warehouses BEFORE specialFilter (used for live Retur / Double INV counters)
  const preSpecialFilteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groups.filter((g) => {
      if (startDate || endDate) {
        const dStr = dateBasis === "transaction" ? (g.transactionDate || g.orderDate) : g.orderDate;
        const itemIso = orderDateToIso(dStr);
        if (!itemIso) return false;
        if (startDate && itemIso < startDate) return false;
        if (endDate && itemIso > endDate) return false;
      }
      if (statusFilter === "printed" && !g.allPrinted) return false;
      if (statusFilter === "unprinted" && g.allPrinted) return false;
      if (jenisFilter !== "all" && g.jenisTransaksi !== jenisFilter) return false;
      if (katFilter !== "all" && g.kategori !== katFilter) return false;
      if (dklkFilter !== "all" && g.dklk !== dklkFilter) return false;
      if (klasFilter === "prekursor" && !g.hasPrekursor) return false;
      if (klasFilter === "oot" && !g.hasOOT) return false;
      if (klasFilter === "ccp" && !g.hasCCP) return false;
      if (klasFilter === "alkes" && !g.hasAlkes) return false;
      if (klasFilter === "farma" && !g.hasFarma) return false;
      if (q) {
        const matchStr =
          g.searchStr ||
          `${g.so} ${g.invoiceNumber} ${g.customerName} ${g.kategoriProduk}`.toLowerCase();
        if (!matchStr.includes(q)) return false;
      }
      return true;
    });
  }, [
    groups,
    dateBasis,
    startDate,
    endDate,
    statusFilter,
    jenisFilter,
    katFilter,
    dklkFilter,
    klasFilter,
    searchQuery,
  ]);

  // Live counts for Special Filter buttons (matches selected warehouseFilter)
  const specialCounts = useMemo(() => {
    let all = 0;
    let retur = 0;
    let double = 0;
    let returOrDouble = 0;

    for (const g of preSpecialFilteredData) {
      const ent = g.entity || "MBI";
      if (warehouseFilter !== "ALL" && ent !== warehouseFilter) continue;
      all++;
      if (g.isRetur) retur++;
      if (g.isDoubleInv) double++;
      if (g.isRetur || g.isDoubleInv) returOrDouble++;
    }

    return { all, retur, double, returOrDouble };
  }, [preSpecialFilteredData, warehouseFilter]);

  const baseFilteredData = useMemo(() => {
    if (specialFilter === "all") return preSpecialFilteredData;
    return preSpecialFilteredData.filter((g) => {
      if (specialFilter === "retur") return Boolean(g.isRetur);
      if (specialFilter === "double") return Boolean(g.isDoubleInv);
      if (specialFilter === "retur_or_double") return Boolean(g.isRetur || g.isDoubleInv);
      return true;
    });
  }, [preSpecialFilteredData, specialFilter]);

  const dataMbi = useMemo(() => baseFilteredData.filter((g) => (g.entity || "MBI") === "MBI"), [baseFilteredData]);
  const dataMai = useMemo(() => baseFilteredData.filter((g) => (g.entity || "MBI") === "MAI"), [baseFilteredData]);

  const calcMetrics = (list: FakturGroup[]) => {
    const soSet = new Set<string>();
    let belumCount = 0;
    let sudahCount = 0;
    let returCount = 0;
    let doubleCount = 0;
    let itemCount = 0;
    let totalRp = 0;

    for (const g of list) {
      if (g.so && g.so !== "-") soSet.add(g.so);
      if (g.allPrinted) sudahCount++;
      else belumCount++;
      if (g.isRetur) returCount++;
      if (g.isDoubleInv) doubleCount++;
      itemCount += g.items?.length || g.totalItems || 1;
      totalRp += (g.totalHarga || 0) * 1.11;
    }

    return {
      fakturCount: list.length,
      soCount: soSet.size,
      belumCount,
      sudahCount,
      returCount,
      doubleCount,
      itemCount,
      totalRp,
    };
  };

  const metricsAll = useMemo(() => calcMetrics(baseFilteredData), [baseFilteredData]);
  const metricsMbi = useMemo(() => calcMetrics(dataMbi), [dataMbi]);
  const metricsMai = useMemo(() => calcMetrics(dataMai), [dataMai]);
  const activeMetrics = useMemo(() => {
    if (warehouseFilter === "MBI") return metricsMbi;
    if (warehouseFilter === "MAI") return metricsMai;
    return metricsAll;
  }, [warehouseFilter, metricsMbi, metricsMai, metricsAll]);

  const hasActiveCustomFilters =
    Boolean(startDate) ||
    Boolean(endDate) ||
    statusFilter !== "all" ||
    jenisFilter !== "all" ||
    katFilter !== "all" ||
    dklkFilter !== "all" ||
    klasFilter !== "all" ||
    Boolean(searchQuery.trim()) ||
    specialFilter !== "all" ||
    warehouseFilter !== "ALL";

  const handleResetAllFilters = () => {
    setWarehouseFilter("ALL");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setJenisFilter("all");
    setKatFilter("all");
    setDklkFilter("all");
    setKlasFilter("all");
    setSearchQuery("");
    setSpecialFilter("all");
    setSplitSpecialSheets(false);
  };

  const handlePresetAll = () => {
    setStartDate("");
    setEndDate("");
  };

  const handlePresetToday = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    setStartDate(today);
    setEndDate(today);
  };

  const handlePreset7Days = () => {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 7);
    const pad = (n: number) => String(n).padStart(2, "0");
    setStartDate(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`);
    setEndDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setStartDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
    setEndDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  const toggleColumn = (colId: ExportColumnId) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        if (next.size <= 1) return prev; // Keep at least 1 column
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  // Build rows for sheet (100% full dataset, never paginated/sliced)
  const formatRows = (list: FakturGroup[], forceAllCols = false) => {
    const sorted = [...list].sort((a, b) => {
      const na = parseInvNum(a.invoiceNumber);
      const nb = parseInvNum(b.invoiceNumber);
      return na - nb;
    });

    const useCol = (id: ExportColumnId) => forceAllCols || selectedCols.has(id);

    const buildBaseRow = (g: FakturGroup, idx: number, overrideDpp?: number) => {
      const dpp = Math.round(((overrideDpp !== undefined ? overrideDpp : g.totalHarga) || 0) * 100) / 100;
      const ppn = Math.round(dpp * 0.11 * 100) / 100;
      const grandTotal = Math.round(dpp * 1.11 * 100) / 100;
      const entityName =
        (g.entity || "MBI") === "MAI" ? "PT Medika Akses Investama (MAI)" : "PT Medika Bina Investama (MBI)";
      const entityCode = (g.entity || "MBI") === "MAI" ? "MAI" : "MBI";
      const specialTags: string[] = [];
      if (g.isRetur) specialTags.push("RETUR");
      if (g.isDoubleInv) specialTags.push("DOUBLE INV");

      const qcInfo = resolveChecker ? resolveChecker(g) : null;
      const checkerName = qcInfo?.checker || g.checker || "-";
      const packerName = qcInfo?.packer || g.packer || "-";
      const pickerName = qcInfo?.picker || g.picker || "-";

      const row: Record<string, string | number> = {};
      if (useCol("no")) row["No"] = idx + 1;
      if (useCol("entity_name")) row["Gudang / Entitas"] = entityName;
      if (useCol("entity_code")) row["Kode Gudang"] = entityCode;
      if (useCol("no_so")) row["No SO"] = g.so;
      if (useCol("no_invoice")) row["No Invoice"] = g.invoiceNumber;
      if (useCol("special_note")) {
        row["Keterangan Khusus"] = specialTags.length > 0 ? specialTags.join(" & ") : "Normal";
      }
      if (useCol("order_date")) row["Tanggal Order (SO)"] = g.orderDate || "-";
      if (useCol("tx_date")) {
        row["Tanggal Faktur (Tx)"] =
          g.transactionDate && g.transactionDate !== "-" ? g.transactionDate : g.orderDate || "-";
      }
      if (useCol("kat_produk")) row["Kat Produk"] = g.kategoriProduk;
      if (useCol("jenis_transaksi")) row["Jenis Transaksi"] = g.jenisTransaksi;
      if (useCol("pelanggan")) row["Pelanggan"] = g.customerName;
      if (useCol("kategori")) row["Kategori"] = g.kategori;
      if (useCol("wilayah")) row["Wilayah"] = g.dklk || "-";
      if (useCol("checker")) row["Checker"] = checkerName;
      if (useCol("packer")) row["Packer"] = packerName;
      if (useCol("picker")) row["Picker"] = pickerName;
      if (useCol("status_cetak")) row["Status Cetak"] = g.allPrinted ? "Sudah Terprint" : "Belum Terprint";
      if (useCol("waktu_cetak")) {
        row["Waktu Cetak"] = g.allPrinted && g.printedAt ? formatPrintTime(g.printedAt) : "-";
      }
      if (useCol("dicetak_oleh")) {
        row["Dicetak Oleh"] = g.allPrinted && g.printedBy ? g.printedBy : "-";
      }
      if (useCol("jumlah_item")) row["Jumlah Item"] = g.items?.length || g.totalItems || 1;
      if (useCol("dpp")) row["Subtotal (DPP)"] = dpp;
      if (useCol("ppn")) row["PPN (11%)"] = ppn;
      if (useCol("grand_total")) row["Total Harga (Grand Total)"] = grandTotal;
      return row;
    };

    if (exportGranularity === "detail" && !forceAllCols) {
      const detailRows: Array<Record<string, string | number>> = [];
      let rowNum = 0;
      for (const g of sorted) {
        const items = g.items && g.items.length > 0 ? g.items : null;
        if (!items) {
          const row = buildBaseRow(g, rowNum++);
          row["Kode Barang"] = "-";
          row["Nama Barang"] = "-";
          row["Qty"] = 0;
          row["Satuan"] = "-";
          row["Lot Number"] = "-";
          detailRows.push(row);
          continue;
        }
        for (const it of items) {
          const row = buildBaseRow(g, rowNum++, it.totalHarga);
          row["Kode Barang"] = it.itemCode || "-";
          row["Nama Barang"] = it.itemDescription || "-";
          row["Qty"] = it.qty ?? 0;
          row["Satuan"] = it.uom || "-";
          row["Lot Number"] = it.lotNumber || "-";
          detailRows.push(row);
        }
      }
      return detailRows;
    }

    return sorted.map((g, idx) => buildBaseRow(g, idx));
  };

  const getExportFilename = (warehouseTag: string, isFullAllSystem = false) => {
    let filename = `Fantastic_Order_${warehouseTag}`;
    if (isFullAllSystem) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const d = new Date();
      return `${filename}_Keseluruhan_Sistem_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`;
    }
    if (specialFilter === "retur") filename += "_Hanya_Retur";
    else if (specialFilter === "double") filename += "_Hanya_Double_INV";
    else if (specialFilter === "retur_or_double") filename += "_Retur_dan_Double_INV";
    if (exportGranularity === "detail") filename += "_Detail_Item";
    filename += dateBasis === "order" ? "_TglOrder_SO" : "_TglFaktur_Tx";
    if (startDate && endDate) {
      filename += `_${startDate}_sd_${endDate}`;
    } else if (startDate) {
      filename += `_dari_${startDate}`;
    } else if (endDate) {
      filename += `_sd_${endDate}`;
    } else {
      const pad = (n: number) => String(n).padStart(2, "0");
      const d = new Date();
      filename += `_Semua_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return filename + ".xlsx";
  };

  const handleDownloadFullSystem = () => {
    if (groups.length === 0) {
      alert("Tidak ada data faktur di sistem.");
      return;
    }
    const allMbi = groups.filter((g) => (g.entity || "MBI") === "MBI");
    const allMai = groups.filter((g) => (g.entity || "MBI") === "MAI");
    const allRetur = groups.filter((g) => Boolean(g.isRetur));
    const allDouble = groups.filter((g) => Boolean(g.isDoubleInv));

    const mMbi = calcMetrics(allMbi);
    const mMai = calcMetrics(allMai);
    const mAll = calcMetrics(groups);

    const wb = XLSX.utils.book_new();
    if (allMbi.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(allMbi, true)), "Gudang MBI");
    }
    if (allMai.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(allMai, true)), "Gudang MAI");
    }
    if (allRetur.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(allRetur, true)), "Semua Retur");
    }
    if (allDouble.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(allDouble, true)), "Semua Double INV");
    }

    const summaryRows = [
      {
        "Entitas Gudang": "PT Medika Bina Investama (MBI)",
        Kode: "MBI",
        "Total SO": mMbi.soCount,
        "Total Faktur": mMbi.fakturCount,
        "Retur": mMbi.returCount,
        "Double INV": mMbi.doubleCount,
        "Belum Dicetak": mMbi.belumCount,
        "Sudah Dicetak": mMbi.sudahCount,
        "Total Nilai (Rp)": Math.round(mMbi.totalRp),
      },
      {
        "Entitas Gudang": "PT Medika Akses Investama (MAI)",
        Kode: "MAI",
        "Total SO": mMai.soCount,
        "Total Faktur": mMai.fakturCount,
        "Retur": mMai.returCount,
        "Double INV": mMai.doubleCount,
        "Belum Dicetak": mMai.belumCount,
        "Sudah Dicetak": mMai.sudahCount,
        "Total Nilai (Rp)": Math.round(mMai.totalRp),
      },
      {
        "Entitas Gudang": "TOTAL KESELURUHAN SISTEM (MBI + MAI)",
        Kode: "TOTAL",
        "Total SO": mAll.soCount,
        "Total Faktur": mAll.fakturCount,
        "Retur": mAll.returCount,
        "Double INV": mAll.doubleCount,
        "Belum Dicetak": mAll.belumCount,
        "Sudah Dicetak": mAll.sudahCount,
        "Total Nilai (Rp)": Math.round(mAll.totalRp),
      },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan Rekap");
    XLSX.writeFile(wb, getExportFilename("MBI_dan_MAI", true));
    onClose();
  };

  // Universal Custom Download Handler
  const handleDownload = (targetMode?: "ALL_SPLIT_SHEETS" | "MBI_ONLY" | "MAI_ONLY") => {
    const mode =
      targetMode ||
      (warehouseFilter === "MBI" ? "MBI_ONLY" : warehouseFilter === "MAI" ? "MAI_ONLY" : "ALL_SPLIT_SHEETS");

    const appendSpecialSplitIfEnabled = (wb: XLSX.WorkBook, sourceList: FakturGroup[]) => {
      if (!splitSpecialSheets) return;
      const returRows = sourceList.filter((g) => Boolean(g.isRetur));
      const doubleRows = sourceList.filter((g) => Boolean(g.isDoubleInv));
      if (returRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(returRows)), "Khusus Retur");
      }
      if (doubleRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(doubleRows)), "Khusus Double INV");
      }
    };

    if (mode === "MBI_ONLY") {
      if (dataMbi.length === 0) {
        alert("Tidak ada data faktur MBI yang sesuai kriteria filter.");
        return;
      }
      const wb = XLSX.utils.book_new();
      if (splitSpecialSheets && specialFilter === "retur_or_double") {
        appendSpecialSplitIfEnabled(wb, dataMbi);
      } else {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dataMbi)), "Gudang MBI");
        appendSpecialSplitIfEnabled(wb, dataMbi);
      }
      XLSX.writeFile(wb, getExportFilename("MBI"));
      onClose();
      return;
    }

    if (mode === "MAI_ONLY") {
      if (dataMai.length === 0) {
        alert("Tidak ada data faktur MAI yang sesuai kriteria filter.");
        return;
      }
      const wb = XLSX.utils.book_new();
      if (splitSpecialSheets && specialFilter === "retur_or_double") {
        appendSpecialSplitIfEnabled(wb, dataMai);
      } else {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dataMai)), "Gudang MAI");
        appendSpecialSplitIfEnabled(wb, dataMai);
      }
      XLSX.writeFile(wb, getExportFilename("MAI"));
      onClose();
      return;
    }

    if (baseFilteredData.length === 0) {
      alert("Tidak ada data faktur yang sesuai dengan kriteria filter.");
      return;
    }

    const wb = XLSX.utils.book_new();

    if (dataMbi.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dataMbi)), "Gudang MBI");
    }
    if (dataMai.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dataMai)), "Gudang MAI");
    }
    appendSpecialSplitIfEnabled(wb, baseFilteredData);

    const summaryRows = [
      {
        "Entitas Gudang": "PT Medika Bina Investama (MBI)",
        Kode: "MBI",
        "Total SO": metricsMbi.soCount,
        "Total Faktur": metricsMbi.fakturCount,
        "Retur": metricsMbi.returCount,
        "Double INV": metricsMbi.doubleCount,
        "Belum Dicetak": metricsMbi.belumCount,
        "Sudah Dicetak": metricsMbi.sudahCount,
        "Total Nilai (Rp)": Math.round(metricsMbi.totalRp),
      },
      {
        "Entitas Gudang": "PT Medika Akses Investama (MAI)",
        Kode: "MAI",
        "Total SO": metricsMai.soCount,
        "Total Faktur": metricsMai.fakturCount,
        "Retur": metricsMai.returCount,
        "Double INV": metricsMai.doubleCount,
        "Belum Dicetak": metricsMai.belumCount,
        "Sudah Dicetak": metricsMai.sudahCount,
        "Total Nilai (Rp)": Math.round(metricsMai.totalRp),
      },
      {
        "Entitas Gudang": "TOTAL GABUNGAN (MBI + MAI)",
        Kode: "TOTAL",
        "Total SO": metricsAll.soCount,
        "Total Faktur": metricsAll.fakturCount,
        "Retur": metricsAll.returCount,
        "Double INV": metricsAll.doubleCount,
        "Belum Dicetak": metricsAll.belumCount,
        "Sudah Dicetak": metricsAll.sudahCount,
        "Total Nilai (Rp)": Math.round(metricsAll.totalRp),
      },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan Rekap");

    XLSX.writeFile(wb, getExportFilename("MBI_dan_MAI_Terpisah"));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-all ${
          isDarkMode
            ? "bg-[#0c1426] border-slate-700/80 text-slate-100 shadow-black/80"
            : "bg-white border-slate-200 text-slate-800 shadow-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-2 ${
            isDarkMode
              ? "bg-[#0e1935] border-slate-800"
              : "bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center text-base shadow-xs">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>Ekspor Data Daftar Faktur (Custom & Keseluruhan)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-mono font-bold">
                  {systemTotals.totalAll.toLocaleString("id-ID")} Total Faktur di Sistem
                </span>
              </h2>
              <p className="text-[11px] text-blue-100 font-medium">
                Tarik 100% seluruh data sistem tanpa batas halaman, atau custom filter Retur, Double INV, & Kolom
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors text-xs font-bold cursor-pointer shrink-0"
            title="Tutup (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs sm:text-sm overflow-y-auto max-h-[78vh] custom-scrollbar">
          {/* Quick Banner: Reset / Ekspor Keseluruhan */}
          <div
            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
              isDarkMode
                ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
                : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}
          >
            <div className="text-[11px] leading-snug">
              <div className="font-extrabold flex items-center gap-1.5">
                <span>📦 Ekspor Keseluruhan Sistem (Tanpa Ada yang Terlewat)</span>
              </div>
              <div className="opacity-80 mt-0.5">
                Total di sistem: <strong>{systemTotals.totalAll.toLocaleString("id-ID")} faktur</strong> (MBI:{" "}
                {systemTotals.totalMbi.toLocaleString("id-ID")} • MAI: {systemTotals.totalMai.toLocaleString("id-ID")} • Retur:{" "}
                {systemTotals.totalRetur.toLocaleString("id-ID")} • Double INV: {systemTotals.totalDouble.toLocaleString("id-ID")})
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {hasActiveCustomFilters && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition ${
                    isDarkMode
                      ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                      : "bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadFullSystem}
                disabled={systemTotals.totalAll === 0}
                className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
                title="Unduh 100% seluruh data sistem (Sheet MBI, Sheet MAI, Sheet Retur, Sheet Double INV, dan Ringkasan)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Keseluruhan ({systemTotals.totalAll.toLocaleString("id-ID")})</span>
              </button>
            </div>
          </div>

          {/* 1. PEMISAHAN ENTITAS GUDANG */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                  isDarkMode ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span>1. Pilih Entitas Gudang:</span>
              </span>
              <span className={`text-[10px] font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Sesuai Filter: {metricsAll.fakturCount.toLocaleString("id-ID")} Faktur ({metricsAll.soCount.toLocaleString("id-ID")} SO)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setWarehouseFilter("ALL")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  warehouseFilter === "ALL"
                    ? "bg-slate-900 text-white border-slate-700 shadow-md ring-2 ring-indigo-500/50 dark:bg-white dark:text-black"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-xs flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Semua Gudang</span>
                  </div>
                </div>
                <div
                  className={`text-[10px] mt-0.5 font-semibold ${
                    warehouseFilter === "ALL" ? (isDarkMode ? "text-slate-700" : "text-indigo-200") : "opacity-75"
                  }`}
                >
                  Dipisah Sheet MBI & MAI
                </div>
                <div className="mt-1 font-mono text-[11px] font-bold">
                  {metricsAll.fakturCount.toLocaleString("id-ID")} Faktur
                </div>
              </button>

              <button
                type="button"
                onClick={() => setWarehouseFilter("MBI")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  warehouseFilter === "MBI"
                    ? "bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400/50"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="font-extrabold text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  <span>Gudang MBI</span>
                </div>
                <div className={`text-[10px] mt-0.5 ${warehouseFilter === "MBI" ? "text-blue-100" : "opacity-75"}`}>
                  PT Medika Bina Investama
                </div>
                <div className="mt-1 font-mono text-[11px] font-bold">
                  {metricsMbi.fakturCount.toLocaleString("id-ID")} Faktur ({metricsMbi.soCount.toLocaleString("id-ID")} SO)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setWarehouseFilter("MAI")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  warehouseFilter === "MAI"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400/50"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="font-extrabold text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>Gudang MAI</span>
                </div>
                <div className={`text-[10px] mt-0.5 ${warehouseFilter === "MAI" ? "text-emerald-100" : "opacity-75"}`}>
                  PT Medika Akses Investama
                </div>
                <div className="mt-1 font-mono text-[11px] font-bold">
                  {metricsMai.fakturCount.toLocaleString("id-ID")} Faktur ({metricsMai.soCount.toLocaleString("id-ID")} SO)
                </div>
              </button>
            </div>
          </div>

          {/* 2. FILTER TIPE FAKTUR KHUSUS (SEMUA / RETUR / DOUBLE INV) */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span
                className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                  isDarkMode ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>2. Filter Khusus (Retur & Double Invoice):</span>
              </span>
              {specialFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSpecialFilter("all")}
                  className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Tampilkan Semua</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSpecialFilter("all")}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  specialFilter === "all"
                    ? "bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400/40"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="font-bold text-[11px]">Semua Faktur</div>
                <div className="font-mono text-xs font-black mt-0.5">{specialCounts.all.toLocaleString("id-ID")}</div>
              </button>

              <button
                type="button"
                onClick={() => setSpecialFilter("retur")}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  specialFilter === "retur"
                    ? "bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-400/40"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="font-bold text-[11px]">Khusus Retur</div>
                <div className="font-mono text-xs font-black mt-0.5">{specialCounts.retur.toLocaleString("id-ID")}</div>
              </button>

              <button
                type="button"
                onClick={() => setSpecialFilter("double")}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  specialFilter === "double"
                    ? "bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-400/40"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="font-bold text-[11px]">Khusus Double INV</div>
                <div className="font-mono text-xs font-black mt-0.5">{specialCounts.double.toLocaleString("id-ID")}</div>
              </button>

              <button
                type="button"
                onClick={() => setSpecialFilter("retur_or_double")}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  specialFilter === "retur_or_double"
                    ? "bg-purple-600 text-white border-purple-500 shadow-md ring-2 ring-purple-400/40"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/80"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="font-bold text-[11px]">Retur & Double INV</div>
                <div className="font-mono text-xs font-black mt-0.5">{specialCounts.returOrDouble.toLocaleString("id-ID")}</div>
              </button>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={splitSpecialSheets}
                onChange={(e) => setSplitSpecialSheets(e.target.checked)}
                className="accent-indigo-600 rounded w-3.5 h-3.5 cursor-pointer"
              />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>
                Tambahkan sheet terpisah khusus <strong>&quot;Khusus Retur&quot;</strong> &amp;{" "}
                <strong>&quot;Khusus Double INV&quot;</strong> di dalam file Excel
              </span>
            </label>
          </div>

          {/* 3. ACUAN & RENTANG TANGGAL */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                  isDarkMode ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>3. Rentang Tanggal (Kosongkan untuk Semua Tanggal):</span>
              </span>
              {availableDates.min && availableDates.max && (
                <span className={`text-[10px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Rentang Data: {isoToDisplayDate(availableDates.min)} s/d {isoToDisplayDate(availableDates.max)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDateBasis("order")}
                className={`p-2 rounded-lg text-left border transition-all cursor-pointer text-xs font-bold ${
                  dateBasis === "order"
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700 text-slate-300"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                📦 Tanggal Masuk SO (Order)
              </button>
              <button
                type="button"
                onClick={() => setDateBasis("transaction")}
                className={`p-2 rounded-lg text-left border transition-all cursor-pointer text-xs font-bold ${
                  dateBasis === "transaction"
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDarkMode
                    ? "bg-slate-800/80 border-slate-700 text-slate-300"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                📄 Tanggal Terfaktur (Tx Date)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Dari Tanggal:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                    isDarkMode ? "bg-[#0c1426] border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Hingga Tanggal:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                    isDarkMode ? "bg-[#0c1426] border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-semibold mr-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                Preset:
              </span>
              {[
                { label: "Semua Tanggal", fn: handlePresetAll, active: !startDate && !endDate },
                { label: "Hari Ini", fn: handlePresetToday, active: false },
                { label: "7 Hari Terakhir", fn: handlePreset7Days, active: false },
                { label: "Bulan Ini", fn: handlePresetThisMonth, active: false },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={p.fn}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                    p.active
                      ? "bg-blue-600 text-white border-blue-600"
                      : isDarkMode
                      ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. FILTER CUSTOM TAMBAHAN & KATA KUNCI */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                  isDarkMode ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                <span>4. Filter Custom Tambahan & Format Baris:</span>
              </span>
            </div>

            {/* Search custom */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter kata kunci opsional (No Invoice, No SO, Pelanggan, Produk)..."
                className={`w-full pl-8 pr-8 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                  isDarkMode
                    ? "bg-[#0c1426] border-slate-700 text-slate-200 placeholder:text-slate-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Status Cetak
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "printed" | "unprinted")}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                    isDarkMode ? "bg-[#0c1426] border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
                >
                  <option value="all">Semua</option>
                  <option value="printed">Sudah Cetak</option>
                  <option value="unprinted">Belum Cetak</option>
                </select>
              </div>

              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Jenis (ORA/DOO)
                </label>
                <select
                  value={jenisFilter}
                  onChange={(e) => setJenisFilter(e.target.value as "all" | "ORA" | "DOO")}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                    isDarkMode ? "bg-[#0c1426] border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
                >
                  <option value="all">Semua</option>
                  <option value="ORA">ORA</option>
                  <option value="DOO">DOO</option>
                </select>
              </div>

              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Prioritas
                </label>
                <select
                  value={katFilter}
                  onChange={(e) => setKatFilter(e.target.value as "all" | "1P" | "2P" | "3P")}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                    isDarkMode ? "bg-[#0c1426] border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
                >
                  <option value="all">Semua</option>
                  <option value="1P">1P</option>
                  <option value="2P">2P</option>
                  <option value="3P">3P</option>
                </select>
              </div>

              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Wilayah
                </label>
                <select
                  value={dklkFilter}
                  onChange={(e) => setDklkFilter(e.target.value as "all" | "DK" | "LK")}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                    isDarkMode ? "bg-[#0c1426] border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
                >
                  <option value="all">Semua</option>
                  <option value="DK">DK</option>
                  <option value="LK">LK</option>
                </select>
              </div>

              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Produk
                </label>
                <select
                  value={klasFilter}
                  onChange={(e) =>
                    setKlasFilter(e.target.value as "all" | "prekursor" | "oot" | "ccp" | "alkes" | "farma")
                  }
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                    isDarkMode ? "bg-[#0c1426] border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  }`}
                >
                  <option value="all">Semua</option>
                  <option value="farma">Farma</option>
                  <option value="alkes">Alkes</option>
                  <option value="ccp">CCP</option>
                  <option value="prekursor">Prekursor</option>
                  <option value="oot">OOT</option>
                </select>
              </div>
            </div>

            {/* Granularity + Column Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setExportGranularity("summary")}
                className={`p-2 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition ${
                  exportGranularity === "summary"
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : isDarkMode
                    ? "bg-[#0c1426] border-slate-700 text-slate-300"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                📋 Per Faktur (1 Baris = 1 Faktur) — {activeMetrics.fakturCount.toLocaleString("id-ID")} baris
              </button>
              <button
                type="button"
                onClick={() => setExportGranularity("detail")}
                className={`p-2 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition ${
                  exportGranularity === "detail"
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : isDarkMode
                    ? "bg-[#0c1426] border-slate-700 text-slate-300"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                💊 Detail Item Barang (1 Baris = 1 Item) — {activeMetrics.itemCount.toLocaleString("id-ID")} baris
              </button>
            </div>

            {/* Collapsible Custom Column Selector */}
            <div
              className={`rounded-lg border ${
                isDarkMode ? "bg-[#0c1426] border-slate-700/80" : "bg-white border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setShowColumnPicker((v) => !v)}
                className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                  <span>
                    Custom Kolom Excel ({selectedCols.size}/{ALL_EXPORT_COLUMNS.length} kolom aktif)
                  </span>
                </span>
                {showColumnPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showColumnPicker && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedCols(new Set(DEFAULT_SELECTED_COLS))}
                      className="text-blue-500 hover:underline font-bold cursor-pointer"
                    >
                      Pilih Semua Kolom
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCols(
                          new Set([
                            "no",
                            "entity_code",
                            "no_so",
                            "no_invoice",
                            "special_note",
                            "order_date",
                            "tx_date",
                            "pelanggan",
                            "status_cetak",
                            "grand_total",
                          ])
                        )
                      }
                      className="text-indigo-500 hover:underline font-bold cursor-pointer"
                    >
                      Kolom Ringkas
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {ALL_EXPORT_COLUMNS.map((col) => {
                      const active = selectedCols.has(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] cursor-pointer select-none ${
                            active
                              ? isDarkMode
                                ? "bg-blue-950/40 border-blue-700/60 text-blue-200"
                                : "bg-blue-50 border-blue-200 text-blue-900 font-semibold"
                              : isDarkMode
                              ? "bg-slate-900 border-slate-800 text-slate-500"
                              : "bg-slate-50 border-slate-200 text-slate-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleColumn(col.id)}
                            className="accent-blue-600 rounded w-3 h-3 cursor-pointer"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5. PRATINJAU HASIL FILTER AKHIR */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isDarkMode ? "bg-[#0b1222] border-slate-700/80" : "bg-blue-50/70 border-blue-200 text-blue-950"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-80">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-500" />
                <span>Pratinjau Hasil yang Akan Diekspor:</span>
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                Rp {formatRupiah(activeMetrics.totalRp)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className={`p-2 rounded-lg border text-center ${isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"}`}>
                <div className="text-[10px] text-slate-500 font-medium">Total SO</div>
                <div className="text-base font-extrabold font-mono text-blue-600 dark:text-blue-400">
                  {activeMetrics.soCount.toLocaleString("id-ID")}
                </div>
              </div>
              <div className={`p-2 rounded-lg border text-center ${isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"}`}>
                <div className="text-[10px] text-slate-500 font-medium">
                  {exportGranularity === "detail" ? "Total Baris Item" : "Total Faktur"}
                </div>
                <div className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                  {(exportGranularity === "detail" ? activeMetrics.itemCount : activeMetrics.fakturCount).toLocaleString("id-ID")}
                </div>
              </div>
              <div className={`p-2 rounded-lg border text-center ${isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"}`}>
                <div className="text-[10px] text-slate-500 font-medium">Retur</div>
                <div className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                  {activeMetrics.returCount.toLocaleString("id-ID")}
                </div>
              </div>
              <div className={`p-2 rounded-lg border text-center ${isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"}`}>
                <div className="text-[10px] text-slate-500 font-medium">Double INV</div>
                <div className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
                  {activeMetrics.doubleCount.toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2.5 ${
            isDarkMode ? "bg-[#0e1935] border-slate-800" : "bg-slate-50 border-slate-200"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-200 text-slate-600"
            }`}
          >
            Batal
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {warehouseFilter === "ALL" && (
              <>
                <button
                  type="button"
                  onClick={() => handleDownload("MBI_ONLY")}
                  disabled={metricsMbi.fakturCount === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    metricsMbi.fakturCount === 0
                      ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700"
                      : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/30"
                  }`}
                >
                  <Download className="w-3 h-3" />
                  <span>MBI Saja ({metricsMbi.fakturCount.toLocaleString("id-ID")})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload("MAI_ONLY")}
                  disabled={metricsMai.fakturCount === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    metricsMai.fakturCount === 0
                      ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                  }`}
                >
                  <Download className="w-3 h-3" />
                  <span>MAI Saja ({metricsMai.fakturCount.toLocaleString("id-ID")})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleDownload()}
              disabled={activeMetrics.fakturCount === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                activeMetrics.fakturCount === 0
                  ? "opacity-50 cursor-not-allowed bg-slate-400 text-white"
                  : warehouseFilter === "MBI"
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 active:scale-95"
                  : warehouseFilter === "MAI"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-95"
                  : "bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white shadow-indigo-600/30 active:scale-95"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {warehouseFilter === "ALL"
                  ? `Unduh Custom (${metricsAll.fakturCount.toLocaleString("id-ID")} Faktur)`
                  : warehouseFilter === "MBI"
                  ? `Unduh Excel MBI (${metricsMbi.fakturCount.toLocaleString("id-ID")} Faktur)`
                  : `Unduh Excel MAI (${metricsMai.fakturCount.toLocaleString("id-ID")} Faktur)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
