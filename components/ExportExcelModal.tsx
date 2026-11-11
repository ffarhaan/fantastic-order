"use client";

import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { FakturGroup } from "@/lib/types";
import {
  Download,
  FileSpreadsheet,
  RotateCcw,
  ChevronDown,
  ChevronUp,
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

  const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mSlash) return `${mSlash[3]}-${pad(mSlash[2])}-${pad(mSlash[1])}`;

  const mIso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (mIso) return `${mIso[1]}-${pad(mIso[2])}-${pad(mIso[3])}`;

  const mDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (mDash) return `${mDash[3]}-${pad(mDash[2])}-${pad(mDash[1])}`;

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

function formatPrintTime(dStr?: string | null): string {
  if (!dStr) return "-";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
  const [activeTab, setActiveTab] = useState<"quick" | "custom">("quick");
  const [quickWarehouse, setQuickWarehouse] = useState<"ALL" | "MBI" | "MAI">("ALL");

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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [selectedCols, setSelectedCols] = useState<Set<ExportColumnId>>(() => new Set(DEFAULT_SELECTED_COLS));

  useEffect(() => {
    if (isOpen) {
      const initWh =
        initialWarehouse === "MBI" || initialWarehouse === "MAI" ? initialWarehouse : "ALL";
      setWarehouseFilter(initWh);
      setQuickWarehouse("ALL");
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
      setShowAdvanced(false);
      // Buka langsung tab Custom jika user membuka modal sambil filter khusus aktif
      const hasPresetSpecial =
        initialSpecialFilter && initialSpecialFilter !== "all";
      setActiveTab(hasPresetSpecial ? "custom" : "quick");
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

  const quickCounts = useMemo(() => {
    let all = 0;
    let retur = 0;
    let double = 0;
    let returOrDouble = 0;
    let unprinted = 0;
    for (const g of groups) {
      const ent = (g.entity || "MBI") === "MAI" ? "MAI" : "MBI";
      if (quickWarehouse !== "ALL" && ent !== quickWarehouse) continue;
      all++;
      if (g.isRetur) retur++;
      if (g.isDoubleInv) double++;
      if (g.isRetur || g.isDoubleInv) returOrDouble++;
      if (!g.allPrinted) unprinted++;
    }
    return { all, retur, double, returOrDouble, unprinted };
  }, [groups, quickWarehouse]);

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
    setExportGranularity("summary");
  };

  const handlePresetAll = () => {
    setStartDate("");
    setEndDate("");
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
        if (next.size <= 1) return prev;
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const formatRows = (list: FakturGroup[], forceAllCols = false) => {
    const sorted = [...list].sort((a, b) => parseInvNum(a.invoiceNumber) - parseInvNum(b.invoiceNumber));
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

  const todayStamp = () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const buildSummarySheet = (list: FakturGroup[]) => {
    const mbi = list.filter((g) => (g.entity || "MBI") === "MBI");
    const mai = list.filter((g) => (g.entity || "MBI") === "MAI");
    const mMbi = calcMetrics(mbi);
    const mMai = calcMetrics(mai);
    const mAll = calcMetrics(list);
    return [
      {
        "Entitas Gudang": "PT Medika Bina Investama (MBI)",
        Kode: "MBI",
        "Total SO": mMbi.soCount,
        "Total Faktur": mMbi.fakturCount,
        Retur: mMbi.returCount,
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
        Retur: mMai.returCount,
        "Double INV": mMai.doubleCount,
        "Belum Dicetak": mMai.belumCount,
        "Sudah Dicetak": mMai.sudahCount,
        "Total Nilai (Rp)": Math.round(mMai.totalRp),
      },
      {
        "Entitas Gudang": "TOTAL KESELURUHAN",
        Kode: "TOTAL",
        "Total SO": mAll.soCount,
        "Total Faktur": mAll.fakturCount,
        Retur: mAll.returCount,
        "Double INV": mAll.doubleCount,
        "Belum Dicetak": mAll.belumCount,
        "Sudah Dicetak": mAll.sudahCount,
        "Total Nilai (Rp)": Math.round(mAll.totalRp),
      },
    ];
  };

  // Ekspor Cepat 1-Klik
  const handleQuickExport = (kind: "all" | "retur" | "double" | "retur_double" | "unprinted") => {
    const scoped = groups.filter((g) => {
      const ent = (g.entity || "MBI") === "MAI" ? "MAI" : "MBI";
      return quickWarehouse === "ALL" || ent === quickWarehouse;
    });

    let targetList = scoped;
    let label = "Keseluruhan_Sistem";
    if (kind === "retur") {
      targetList = scoped.filter((g) => Boolean(g.isRetur));
      label = "Khusus_Retur";
    } else if (kind === "double") {
      targetList = scoped.filter((g) => Boolean(g.isDoubleInv));
      label = "Khusus_Double_INV";
    } else if (kind === "retur_double") {
      targetList = scoped.filter((g) => Boolean(g.isRetur || g.isDoubleInv));
      label = "Retur_dan_Double_INV";
    } else if (kind === "unprinted") {
      targetList = scoped.filter((g) => !g.allPrinted);
      label = "Belum_Terprint";
    }

    if (targetList.length === 0) {
      alert("Tidak ada data yang cocok untuk diunduh pada pilihan ini.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const mbiRows = targetList.filter((g) => (g.entity || "MBI") === "MBI");
    const maiRows = targetList.filter((g) => (g.entity || "MBI") === "MAI");

    if (kind === "all") {
      if (mbiRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(mbiRows, true)), "Gudang MBI");
      if (maiRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(maiRows, true)), "Gudang MAI");
      const allRet = targetList.filter((g) => Boolean(g.isRetur));
      const allDbl = targetList.filter((g) => Boolean(g.isDoubleInv));
      if (allRet.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(allRet, true)), "Semua Retur");
      if (allDbl.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(allDbl, true)), "Semua Double INV");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummarySheet(targetList)), "Ringkasan Rekap");
    } else if (kind === "retur_double") {
      const retRows = targetList.filter((g) => Boolean(g.isRetur));
      const dblRows = targetList.filter((g) => Boolean(g.isDoubleInv));
      if (retRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(retRows, true)), "Khusus Retur");
      if (dblRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dblRows, true)), "Khusus Double INV");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummarySheet(targetList)), "Ringkasan Rekap");
    } else {
      if (quickWarehouse === "ALL") {
        if (mbiRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(mbiRows, true)), "Gudang MBI");
        if (maiRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(maiRows, true)), "Gudang MAI");
      } else {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(targetList, true)), `Gudang ${quickWarehouse}`);
      }
    }

    const whTag = quickWarehouse === "ALL" ? "MBI_dan_MAI" : quickWarehouse;
    XLSX.writeFile(wb, `Fantastic_Order_${whTag}_${label}_${todayStamp()}.xlsx`);
    onClose();
  };

  // Ekspor Custom (1 Tombol Utama)
  const handleCustomDownload = () => {
    const targetList =
      warehouseFilter === "MBI" ? dataMbi : warehouseFilter === "MAI" ? dataMai : baseFilteredData;

    if (targetList.length === 0) {
      alert("Tidak ada data faktur yang sesuai kriteria filter.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const appendSpecialSplit = (source: FakturGroup[]) => {
      if (!splitSpecialSheets) return;
      const retRows = source.filter((g) => Boolean(g.isRetur));
      const dblRows = source.filter((g) => Boolean(g.isDoubleInv));
      if (retRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(retRows)), "Khusus Retur");
      if (dblRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dblRows)), "Khusus Double INV");
    };

    if (warehouseFilter === "ALL") {
      if (dataMbi.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dataMbi)), "Gudang MBI");
      if (dataMai.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(dataMai)), "Gudang MAI");
      appendSpecialSplit(targetList);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummarySheet(targetList)), "Ringkasan Rekap");
    } else {
      if (splitSpecialSheets && specialFilter === "retur_or_double") {
        appendSpecialSplit(targetList);
      } else {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatRows(targetList)), `Gudang ${warehouseFilter}`);
        appendSpecialSplit(targetList);
      }
    }

    let suffix = "";
    if (specialFilter === "retur") suffix += "_Khusus_Retur";
    else if (specialFilter === "double") suffix += "_Khusus_Double_INV";
    else if (specialFilter === "retur_or_double") suffix += "_Retur_Double";
    if (exportGranularity === "detail") suffix += "_Detail_Item";

    const whTag = warehouseFilter === "ALL" ? "MBI_dan_MAI" : warehouseFilter;
    XLSX.writeFile(wb, `Fantastic_Order_${whTag}${suffix}_${todayStamp()}.xlsx`);
    onClose();
  };

  if (!isOpen) return null;

  const boxCls = isDarkMode
    ? "bg-[#121215] border-zinc-800 text-zinc-100"
    : "bg-zinc-50 border-zinc-200 text-zinc-900";
  const inputCls = isDarkMode
    ? "bg-[#09090b] border-zinc-800 text-zinc-100"
    : "bg-white border-zinc-300 text-zinc-900";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden flex flex-col ${
          isDarkMode
            ? "bg-[#09090b] border-zinc-800 text-zinc-100"
            : "bg-white border-zinc-200 text-zinc-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Neutral Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
            isDarkMode ? "bg-[#09090b] border-zinc-800" : "bg-white border-zinc-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base tracking-tight">
                Ekspor Excel Daftar Faktur
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Total di sistem: <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{groups.length.toLocaleString("id-ID")}</span> faktur siap ditarik utuh
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold cursor-pointer"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        {/* 2 Simple Mode Tabs */}
        <div
          className={`px-5 pt-3 pb-2.5 border-b flex items-center gap-2 ${
            isDarkMode ? "bg-[#0c0c0f] border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
              activeTab === "quick"
                ? "bg-blue-700 text-white border-blue-600"
                : isDarkMode
                ? "bg-transparent border-zinc-800 text-zinc-400 hover:text-zinc-200"
                : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900"
            }`}
          >
            1. Ekspor Cepat (Langsung Unduh)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
              activeTab === "custom"
                ? "bg-blue-700 text-white border-blue-600"
                : isDarkMode
                ? "bg-transparent border-zinc-800 text-zinc-400 hover:text-zinc-200"
                : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900"
            }`}
          >
            2. Ekspor Custom (Atur Filter &amp; Kolom)
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[72vh] space-y-3.5">
          {activeTab === "quick" ? (
            <>
              {/* Quick Warehouse Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  Pilih Gudang yang Mau Diunduh:
                </span>
                <div className="flex items-center gap-1.5">
                  {(["ALL", "MBI", "MAI"] as const).map((wh) => (
                    <button
                      key={wh}
                      type="button"
                      onClick={() => setQuickWarehouse(wh)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        quickWarehouse === wh
                          ? "bg-blue-600/15 border-blue-500/40 text-blue-700 dark:text-blue-300"
                          : isDarkMode
                          ? "bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          : "bg-white border-zinc-300 text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {wh === "ALL" ? "Semua (MBI + MAI)" : `Gudang ${wh}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 Main 1-Click Cards + 1 Unprinted Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Semua Data Sistem (Biru) */}
                <button
                  type="button"
                  onClick={() => handleQuickExport("all")}
                  disabled={quickCounts.all === 0}
                  className={`p-3.5 rounded-xl border border-l-4 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45 ${
                    isDarkMode
                      ? "bg-[#121215] border-zinc-800 border-l-blue-500 hover:bg-zinc-900"
                      : "bg-white border-zinc-200 border-l-blue-600 hover:bg-blue-50/40"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Semua Data Sistem (100%)
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                        {quickCounts.all.toLocaleString("id-ID")}
                      </span>{" "}
                      faktur (tanpa terlewat)
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold shrink-0">
                    Unduh
                  </span>
                </button>

                {/* Khusus Retur (Kuning) */}
                <button
                  type="button"
                  onClick={() => handleQuickExport("retur")}
                  disabled={quickCounts.retur === 0}
                  className={`p-3.5 rounded-xl border border-l-4 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45 ${
                    isDarkMode
                      ? "bg-[#121215] border-zinc-800 border-l-amber-500 hover:bg-zinc-900"
                      : "bg-white border-zinc-200 border-l-amber-500 hover:bg-amber-50/40"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Khusus Retur Saja
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                        {quickCounts.retur.toLocaleString("id-ID")}
                      </span>{" "}
                      faktur retur
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300 text-xs font-bold shrink-0">
                    Unduh
                  </span>
                </button>

                {/* Khusus Double INV (Merah) */}
                <button
                  type="button"
                  onClick={() => handleQuickExport("double")}
                  disabled={quickCounts.double === 0}
                  className={`p-3.5 rounded-xl border border-l-4 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45 ${
                    isDarkMode
                      ? "bg-[#121215] border-zinc-800 border-l-rose-500 hover:bg-zinc-900"
                      : "bg-white border-zinc-200 border-l-rose-600 hover:bg-rose-50/40"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Khusus Double Invoice Saja
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
                        {quickCounts.double.toLocaleString("id-ID")}
                      </span>{" "}
                      faktur double inv
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 text-rose-800 dark:text-rose-300 text-xs font-bold shrink-0">
                    Unduh
                  </span>
                </button>

                {/* Retur & Double INV (Hijau) */}
                <button
                  type="button"
                  onClick={() => handleQuickExport("retur_double")}
                  disabled={quickCounts.returOrDouble === 0}
                  className={`p-3.5 rounded-xl border border-l-4 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45 ${
                    isDarkMode
                      ? "bg-[#121215] border-zinc-800 border-l-emerald-500 hover:bg-zinc-900"
                      : "bg-white border-zinc-200 border-l-emerald-600 hover:bg-emerald-50/40"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Retur &amp; Double INV (2 Sheet)
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {quickCounts.returOrDouble.toLocaleString("id-ID")}
                      </span>{" "}
                      faktur terpisah per sheet
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
                    Unduh
                  </span>
                </button>
              </div>

              {/* Belum Terprint Bar */}
              <button
                type="button"
                onClick={() => handleQuickExport("unprinted")}
                disabled={quickCounts.unprinted === 0}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45 ${
                  isDarkMode
                    ? "bg-[#121215] border-zinc-800 hover:bg-zinc-900"
                    : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <div className="text-xs">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    Atau unduh yang Belum Terprint saja
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                    (<span className="font-mono font-bold">{quickCounts.unprinted.toLocaleString("id-ID")}</span> faktur antre)
                  </span>
                </div>
                <span className="px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 shrink-0">
                  Unduh Belum Print
                </span>
              </button>
            </>
          ) : (
            <>
              {/* Custom Filter: 3 Clean Blocks */}
              <div className={`p-3.5 rounded-xl border space-y-3 ${boxCls}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">1. Pilih Gudang &amp; Tipe Khusus</span>
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Gudang
                    </label>
                    <select
                      value={warehouseFilter}
                      onChange={(e) => setWarehouseFilter(e.target.value as any)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                    >
                      <option value="ALL">Semua Gudang ({metricsAll.fakturCount.toLocaleString("id-ID")})</option>
                      <option value="MBI">Gudang MBI ({metricsMbi.fakturCount.toLocaleString("id-ID")})</option>
                      <option value="MAI">Gudang MAI ({metricsMai.fakturCount.toLocaleString("id-ID")})</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Fokus Retur / Double Invoice
                    </label>
                    <select
                      value={specialFilter}
                      onChange={(e) => setSpecialFilter(e.target.value as ExportSpecialFilter)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                    >
                      <option value="all">Semua Faktur ({specialCounts.all.toLocaleString("id-ID")})</option>
                      <option value="retur">Khusus Retur ({specialCounts.retur.toLocaleString("id-ID")})</option>
                      <option value="double">Khusus Double INV ({specialCounts.double.toLocaleString("id-ID")})</option>
                      <option value="retur_or_double">Retur &amp; Double INV ({specialCounts.returOrDouble.toLocaleString("id-ID")})</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Tanggal */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${boxCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold">2. Rentang Tanggal (Opsional)</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={handlePresetAll}
                      className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer ${
                        !startDate && !endDate
                          ? "bg-blue-600/15 border-blue-500/40 text-blue-700 dark:text-blue-300"
                          : inputCls
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={handlePreset7Days}
                      className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer ${inputCls}`}
                    >
                      7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={handlePresetThisMonth}
                      className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer ${inputCls}`}
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Acuan Tanggal
                    </label>
                    <select
                      value={dateBasis}
                      onChange={(e) => setDateBasis(e.target.value as "order" | "transaction")}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                    >
                      <option value="order">Tanggal Order (SO)</option>
                      <option value="transaction">Tanggal Faktur (Tx)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Dari Tanggal
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold ${inputCls}`}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Opsi Lanjutan & Kolom (Lipatan Rapi) */}
              <div className={`rounded-xl border overflow-hidden ${boxCls}`}>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span>3. Opsi Lanjutan &amp; Pilih Kolom Excel ({selectedCols.size}/{ALL_EXPORT_COLUMNS.length} kolom)</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvanced && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari No Invoice, No SO, atau Nama Apotek (opsional)..."
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs font-medium ${inputCls}`}
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                      >
                        <option value="all">Semua Status Cetak</option>
                        <option value="unprinted">Belum Terprint</option>
                        <option value="printed">Sudah Terprint</option>
                      </select>

                      <select
                        value={jenisFilter}
                        onChange={(e) => setJenisFilter(e.target.value as any)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                      >
                        <option value="all">Semua Jenis (DOO &amp; ORA)</option>
                        <option value="DOO">DOO</option>
                        <option value="ORA">ORA</option>
                      </select>

                      <select
                        value={katFilter}
                        onChange={(e) => setKatFilter(e.target.value as any)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                      >
                        <option value="all">Semua Kategori</option>
                        <option value="1P">1P</option>
                        <option value="2P">2P</option>
                        <option value="3P">3P</option>
                      </select>

                      <select
                        value={dklkFilter}
                        onChange={(e) => setDklkFilter(e.target.value as any)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                      >
                        <option value="all">Semua Wilayah</option>
                        <option value="DK">Dalam Kota (DK)</option>
                        <option value="LK">Luar Kota (LK)</option>
                      </select>

                      <select
                        value={klasFilter}
                        onChange={(e) => setKlasFilter(e.target.value as any)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                      >
                        <option value="all">Semua Produk</option>
                        <option value="farma">FARMA</option>
                        <option value="alkes">ALKES</option>
                        <option value="ccp">CCP</option>
                        <option value="prekursor">PREKURSOR</option>
                        <option value="oot">OOT</option>
                      </select>

                      <select
                        value={exportGranularity}
                        onChange={(e) => setExportGranularity(e.target.value as ExportGranularity)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputCls}`}
                      >
                        <option value="summary">1 Baris = 1 Faktur</option>
                        <option value="detail">1 Baris = 1 Barang</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={splitSpecialSheets}
                        onChange={(e) => setSplitSpecialSheets(e.target.checked)}
                        className="accent-blue-600 rounded w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Pisahkan sheet &quot;Khusus Retur&quot; &amp; &quot;Khusus Double INV&quot; di dalam file</span>
                    </label>

                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">Kolom Excel:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCols(new Set(DEFAULT_SELECTED_COLS))}
                          className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                        >
                          Centang Semua
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {ALL_EXPORT_COLUMNS.map((col) => {
                          const checked = selectedCols.has(col.id);
                          return (
                            <label
                              key={col.id}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer ${
                                checked
                                  ? "border-blue-500/35 bg-blue-500/10 font-semibold"
                                  : isDarkMode
                                  ? "border-zinc-800 text-zinc-400"
                                  : "border-zinc-200 text-zinc-500"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleColumn(col.id)}
                                className="accent-blue-600 rounded w-3.5 h-3.5"
                              />
                              <span className="truncate">{col.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Clean Single Footer */}
        <div
          className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3 ${
            isDarkMode ? "bg-[#0c0c0f] border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}
        >
          {activeTab === "custom" ? (
            <>
              <div className="text-xs text-zinc-600 dark:text-zinc-300 flex flex-wrap items-center gap-2">
                <span>
                  Hasil: <strong className="font-mono text-zinc-900 dark:text-white">{activeMetrics.fakturCount.toLocaleString("id-ID")}</strong> faktur
                </span>
                <span className="text-zinc-400">·</span>
                <span>
                  Retur: <strong className="font-mono text-amber-700 dark:text-amber-400">{activeMetrics.returCount.toLocaleString("id-ID")}</strong>
                </span>
                <span className="text-zinc-400">·</span>
                <span>
                  Double: <strong className="font-mono text-rose-700 dark:text-rose-400">{activeMetrics.doubleCount.toLocaleString("id-ID")}</strong>
                </span>
                <span className="text-zinc-400">·</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  Rp {formatRupiah(activeMetrics.totalRp)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCustomDownload}
                disabled={activeMetrics.fakturCount === 0}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-45"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Excel ({activeMetrics.fakturCount.toLocaleString("id-ID")})</span>
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Klik salah satu kotak di atas untuk langsung mengunduh file Excel.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-bold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Tutup
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
