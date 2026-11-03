"use client";

import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { FakturGroup } from "@/lib/types";
import { Building2, Download, FileSpreadsheet, Layers, CheckCircle2, Clock, Calendar, Filter } from "lucide-react";

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: FakturGroup[];
  isDarkMode?: boolean;
  initialWarehouse?: "ALL" | "MBI" | "MAI" | string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialDateBasis?: "order" | "transaction";
}

function parseInvNum(inv: string): number {
  if (!inv) return 0;
  const s = String(inv).trim().replace(/-1P$/i, "");
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function orderDateToIso(dStr: string): string | null {
  if (!dStr || dStr === "-" || dStr === "0") return null;
  const s = String(dStr).trim();
  const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mSlash) {
    const pad = (n: number | string) => String(n).padStart(2, "0");
    return `${mSlash[3]}-${pad(mSlash[2])}-${pad(mSlash[1])}`;
  }
  const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    const pad = (n: number | string) => String(n).padStart(2, "0");
    return `${mIso[1]}-${pad(mIso[2])}-${pad(mIso[3])}`;
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
}: ExportExcelModalProps) {
  // warehouseFilter: "ALL" = Semua (Dipisah Sheet MBI & MAI), "MBI" = Khusus MBI, "MAI" = Khusus MAI
  const [warehouseFilter, setWarehouseFilter] = useState<"ALL" | "MBI" | "MAI">("ALL");
  const [dateBasis, setDateBasis] = useState<"order" | "transaction">("order");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "printed" | "unprinted">("all");
  const [jenisFilter, setJenisFilter] = useState<"all" | "ORA" | "DOO">("all");
  const [katFilter, setKatFilter] = useState<"all" | "1P" | "2P" | "3P">("all");

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      if (initialWarehouse === "MBI" || initialWarehouse === "MAI" || initialWarehouse === "ALL") {
        setWarehouseFilter(initialWarehouse as "ALL" | "MBI" | "MAI");
      }
      if (initialStartDate) setStartDate(initialStartDate);
      if (initialEndDate) setEndDate(initialEndDate);
      if (initialDateBasis) setDateBasis(initialDateBasis);
    }
  }, [isOpen, initialWarehouse, initialStartDate, initialEndDate, initialDateBasis]);

  // Find date range from groups to provide smart defaults based on selected dateBasis
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

  // Filter matching data across all warehouses first (before warehouse slicing)
  const baseFilteredData = useMemo(() => {
    return groups.filter((g) => {
      // Date Range Filter based on selected dateBasis
      if (startDate || endDate) {
        const dStr = dateBasis === "transaction" ? (g.transactionDate || g.orderDate) : g.orderDate;
        const itemIso = orderDateToIso(dStr);
        if (!itemIso) return false;
        if (startDate && itemIso < startDate) return false;
        if (endDate && itemIso > endDate) return false;
      }
      // Status Filter
      if (statusFilter === "printed" && !g.allPrinted) return false;
      if (statusFilter === "unprinted" && g.allPrinted) return false;
      // Jenis Filter
      if (jenisFilter !== "all" && g.jenisTransaksi !== jenisFilter) return false;
      // Kategori Filter
      if (katFilter !== "all" && g.kategori !== katFilter) return false;

      return true;
    });
  }, [groups, dateBasis, startDate, endDate, statusFilter, jenisFilter, katFilter]);

  // Separate MBI and MAI sets
  const dataMbi = useMemo(() => {
    return baseFilteredData.filter((g) => (g.entity || "MBI") === "MBI");
  }, [baseFilteredData]);

  const dataMai = useMemo(() => {
    return baseFilteredData.filter((g) => (g.entity || "MBI") === "MAI");
  }, [baseFilteredData]);

  // Active dataset according to warehouseFilter
  const matchingData = useMemo(() => {
    if (warehouseFilter === "MBI") return dataMbi;
    if (warehouseFilter === "MAI") return dataMai;
    return baseFilteredData;
  }, [warehouseFilter, dataMbi, dataMai, baseFilteredData]);

  // Metrics calculation helper
  const calcMetrics = (list: FakturGroup[]) => {
    const soSet = new Set<string>();
    let belumCount = 0;
    let sudahCount = 0;
    let totalRp = 0;

    for (const g of list) {
      if (g.so && g.so !== "-") soSet.add(g.so);
      if (g.allPrinted) sudahCount++;
      else belumCount++;
      totalRp += (g.totalHarga || 0) * 1.11;
    }

    return {
      fakturCount: list.length,
      soCount: soSet.size,
      belumCount,
      sudahCount,
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

  // Quick Preset Handlers
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
    setStartDate(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${past.getDate()}`);
    setEndDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${now.getDate()}`);
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setStartDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
    setEndDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  // Build rows for sheet
  const formatRows = (list: FakturGroup[]) => {
    const sorted = [...list].sort((a, b) => {
      const na = parseInvNum(a.invoiceNumber);
      const nb = parseInvNum(b.invoiceNumber);
      return na - nb;
    });

    return sorted.map((g, idx) => {
      const dpp = Math.round((g.totalHarga || 0) * 100) / 100;
      const ppn = Math.round(dpp * 0.11 * 100) / 100;
      const grandTotal = Math.round(dpp * 1.11 * 100) / 100;
      const entityName = (g.entity || "MBI") === "MAI" ? "PT Medika Akses Investama (MAI)" : "PT Medika Bina Investama (MBI)";
      const entityCode = (g.entity || "MBI") === "MAI" ? "MAI" : "MBI";

      return {
        No: idx + 1,
        "Gudang / Entitas": entityName,
        "Kode Gudang": entityCode,
        "No SO": g.so,
        "No Invoice": g.invoiceNumber,
        "Tanggal Order (SO)": g.orderDate || "-",
        "Tanggal Faktur (Tx)": g.transactionDate && g.transactionDate !== "-" ? g.transactionDate : g.orderDate || "-",
        "Kat Produk": g.kategoriProduk,
        "Jenis Transaksi": g.jenisTransaksi,
        Pelanggan: g.customerName,
        Kategori: g.kategori,
        "Status Cetak": g.allPrinted ? "Sudah Terprint" : "Belum Terprint",
        "Waktu Cetak": g.allPrinted && g.printedAt ? formatPrintTime(g.printedAt) : "-",
        "Dicetak Oleh": g.allPrinted && g.printedBy ? g.printedBy : "-",
        "Subtotal (DPP)": dpp,
        "PPN (11%)": ppn,
        "Total Harga (Grand Total)": grandTotal,
      };
    });
  };

  // Helper to generate filename
  const getExportFilename = (warehouseTag: string) => {
    let filename = `Fantastic_Order_${warehouseTag}`;
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

  // Universal Download Handler
  const handleDownload = (targetMode?: "ALL_SPLIT_SHEETS" | "MBI_ONLY" | "MAI_ONLY") => {
    const mode = targetMode || (warehouseFilter === "MBI" ? "MBI_ONLY" : warehouseFilter === "MAI" ? "MAI_ONLY" : "ALL_SPLIT_SHEETS");

    if (mode === "MBI_ONLY") {
      if (dataMbi.length === 0) {
        alert("Tidak ada data faktur MBI yang sesuai kriteria filter.");
        return;
      }
      const wb = XLSX.utils.book_new();
      const wsMbi = XLSX.utils.json_to_sheet(formatRows(dataMbi));
      XLSX.utils.book_append_sheet(wb, wsMbi, "Gudang MBI");
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
      const wsMai = XLSX.utils.json_to_sheet(formatRows(dataMai));
      XLSX.utils.book_append_sheet(wb, wsMai, "Gudang MAI");
      XLSX.writeFile(wb, getExportFilename("MAI"));
      onClose();
      return;
    }

    // ALL_SPLIT_SHEETS: Both MBI and MAI separated into distinct sheets!
    if (baseFilteredData.length === 0) {
      alert("Tidak ada data faktur yang sesuai dengan kriteria filter.");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Gudang MBI
    if (dataMbi.length > 0) {
      const wsMbi = XLSX.utils.json_to_sheet(formatRows(dataMbi));
      XLSX.utils.book_append_sheet(wb, wsMbi, "Gudang MBI");
    }

    // Sheet 2: Gudang MAI
    if (dataMai.length > 0) {
      const wsMai = XLSX.utils.json_to_sheet(formatRows(dataMai));
      XLSX.utils.book_append_sheet(wb, wsMai, "Gudang MAI");
    }

    // Sheet 3: Ringkasan Rekap (Summary Breakdown)
    const summaryRows = [
      {
        "Entitas Gudang": "PT Medika Bina Investama (MBI)",
        "Kode": "MBI",
        "Total SO": metricsMbi.soCount,
        "Total Faktur": metricsMbi.fakturCount,
        "Belum Dicetak": metricsMbi.belumCount,
        "Sudah Dicetak": metricsMbi.sudahCount,
        "Total Nilai (Rp)": Math.round(metricsMbi.totalRp),
      },
      {
        "Entitas Gudang": "PT Medika Akses Investama (MAI)",
        "Kode": "MAI",
        "Total SO": metricsMai.soCount,
        "Total Faktur": metricsMai.fakturCount,
        "Belum Dicetak": metricsMai.belumCount,
        "Sudah Dicetak": metricsMai.sudahCount,
        "Total Nilai (Rp)": Math.round(metricsMai.totalRp),
      },
      {
        "Entitas Gudang": "TOTAL GABUNGAN (MBI + MAI)",
        "Kode": "TOTAL",
        "Total SO": metricsAll.soCount,
        "Total Faktur": metricsAll.fakturCount,
        "Belum Dicetak": metricsAll.belumCount,
        "Sudah Dicetak": metricsAll.sudahCount,
        "Total Nilai (Rp)": Math.round(metricsAll.totalRp),
      },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Rekap");

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
        className={`relative w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-all ${
          isDarkMode
            ? "bg-[#0c1426] border-slate-700/80 text-slate-100 shadow-black/80"
            : "bg-white border-slate-200 text-slate-800 shadow-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
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
              <h2 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                <span>Ekspor Data ke Excel</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-mono font-bold">
                  MBI & MAI Terpisah
                </span>
              </h2>
              <p className="text-[11px] text-blue-100 font-medium">
                Pilih gudang MBI, MAI, atau unduh keduanya dalam sheet/file terpisah
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors text-xs font-bold cursor-pointer"
            title="Tutup (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs sm:text-sm overflow-y-auto max-h-[82vh] custom-scrollbar">
          {/* 1. PEMISAHAN ENTITAS GUDANG (MBI / MAI / SEMUA DIPISAH) */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Pilih Entitas Gudang:</span>
              </span>
              <span className={`text-[10px] font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Total Terdata: {metricsAll.fakturCount} Faktur ({metricsAll.soCount} SO)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Tombol Semua (Dipisah Sheet) */}
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
                  {warehouseFilter === "ALL" && (
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  )}
                </div>
                <div className={`text-[10px] mt-1 font-semibold ${warehouseFilter === "ALL" ? (isDarkMode ? "text-slate-700" : "text-indigo-200") : "opacity-75"}`}>
                  Dipisah 2 Sheet (MBI & MAI)
                </div>
                <div className="mt-1 font-mono text-[10px] font-bold">
                  {metricsAll.fakturCount} Faktur
                </div>
              </button>

              {/* Tombol Gudang MBI */}
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
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                    <span>Gudang MBI</span>
                  </div>
                  {warehouseFilter === "MBI" && (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <div className={`text-[10px] mt-1 ${warehouseFilter === "MBI" ? "text-blue-100" : "opacity-75"}`}>
                  PT Medika Bina Investama
                </div>
                <div className="mt-1 font-mono text-[10px] font-bold">
                  {metricsMbi.fakturCount} Faktur ({metricsMbi.soCount} SO)
                </div>
              </button>

              {/* Tombol Gudang MAI */}
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
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span>Gudang MAI</span>
                  </div>
                  {warehouseFilter === "MAI" && (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <div className={`text-[10px] mt-1 ${warehouseFilter === "MAI" ? "text-emerald-100" : "opacity-75"}`}>
                  PT Medika Akses Investama
                </div>
                <div className="mt-1 font-mono text-[10px] font-bold">
                  {metricsMai.fakturCount} Faktur ({metricsMai.soCount} SO)
                </div>
              </button>
            </div>

            {/* Side-by-side Live Comparison Preview */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className={`p-2.5 rounded-lg border text-left ${
                isDarkMode ? "bg-[#09101d] border-blue-900/40" : "bg-blue-50/70 border-blue-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>MBI (Bina Investama)</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {metricsMbi.soCount} SO
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">
                    {metricsMbi.fakturCount} <span className="text-[10px] font-normal text-slate-500">Faktur</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Rp {formatRupiah(metricsMbi.totalRp)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                  <span className="text-amber-500 font-semibold">Belum: {metricsMbi.belumCount}</span>
                  <span>•</span>
                  <span className="text-emerald-500 font-semibold">Tercetak: {metricsMbi.sudahCount}</span>
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border text-left ${
                isDarkMode ? "bg-[#09101d] border-emerald-900/40" : "bg-emerald-50/70 border-emerald-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>MAI (Akses Investama)</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {metricsMai.soCount} SO
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">
                    {metricsMai.fakturCount} <span className="text-[10px] font-normal text-slate-500">Faktur</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Rp {formatRupiah(metricsMai.totalRp)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                  <span className="text-amber-500 font-semibold">Belum: {metricsMai.belumCount}</span>
                  <span>•</span>
                  <span className="text-emerald-500 font-semibold">Tercetak: {metricsMai.sudahCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ACUAN & RENTANG TANGGAL */}
          <div
            className={`p-3.5 rounded-xl border space-y-3 ${
              isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Acuan & Rentang Tanggal</span>
              </span>
              {availableDates.min && availableDates.max && (
                <span className={`text-[10px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  Data: {isoToDisplayDate(availableDates.min)} s/d {isoToDisplayDate(availableDates.max)}
                </span>
              )}
            </div>

            {/* Acuan Tanggal Filter Toggle */}
            <div className={`p-2.5 rounded-xl border space-y-2 ${
              isDarkMode ? "bg-[#0c1426] border-slate-700/80" : "bg-white border-slate-200 shadow-xs"
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Pilih Basis Tanggal:
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                  {dateBasis === "order" ? "✓ Berdasarkan Tanggal Masuk SO" : "✓ Berdasarkan Tanggal Terfaktur (Tx)"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDateBasis("order")}
                  className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer ${
                    dateBasis === "order"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30"
                      : isDarkMode
                      ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>📦</span>
                    <span>Tanggal Masuk SO (Order)</span>
                  </div>
                  <div className={`text-[10px] mt-1 leading-tight ${dateBasis === "order" ? "text-blue-100" : "opacity-75"}`}>
                    Mencari ada berapa SO di tanggal sekian yang sudah terfaktur
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDateBasis("transaction")}
                  className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer ${
                    dateBasis === "transaction"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30"
                      : isDarkMode
                      ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>📄</span>
                    <span>Tanggal Terfaktur (Tx Date)</span>
                  </div>
                  <div className={`text-[10px] mt-1 leading-tight ${dateBasis === "transaction" ? "text-blue-100" : "opacity-75"}`}>
                    Mencari ada berapa faktur yang diterbitkan di tanggal sekian
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Dari Tanggal ({dateBasis === "order" ? "Tgl Order SO" : "Tgl Terfaktur"}):
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium outline-hidden transition-all ${
                    isDarkMode
                      ? "bg-[#0c1426] border-slate-700 text-slate-200 focus:border-blue-500"
                      : "bg-white border-slate-300 text-slate-800 focus:border-blue-600"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Hingga Tanggal ({dateBasis === "order" ? "Tgl Order SO" : "Tgl Terfaktur"}):
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium outline-hidden transition-all ${
                    isDarkMode
                      ? "bg-[#0c1426] border-slate-700 text-slate-200 focus:border-blue-500"
                      : "bg-white border-slate-300 text-slate-800 focus:border-blue-600"
                  }`}
                />
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className={`text-[10px] font-semibold mr-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                Pilihan Cepat:
              </span>
              <button
                type="button"
                onClick={handlePresetAll}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                  !startDate && !endDate
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Semua Tanggal
              </button>
              <button
                type="button"
                onClick={handlePresetToday}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={handlePreset7Days}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={handlePresetThisMonth}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Bulan Ini
              </button>
            </div>
          </div>

          {/* 3. KRITERIA FILTER TAMBAHAN (Status, Jenis, Kategori) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Status Cetak */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Status Cetak:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "printed" | "unprinted")}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                  isDarkMode
                    ? "bg-[#111c33] border-slate-700 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800"
                }`}
              >
                <option value="all">Semua Status</option>
                <option value="printed">Sudah Dicetak (✓)</option>
                <option value="unprinted">Belum Dicetak</option>
              </select>
            </div>

            {/* Jenis Transaksi */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Jenis Transaksi:
              </label>
              <select
                value={jenisFilter}
                onChange={(e) => setJenisFilter(e.target.value as "all" | "ORA" | "DOO")}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                  isDarkMode
                    ? "bg-[#111c33] border-slate-700 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800"
                }`}
              >
                <option value="all">Semua (ORA & DOO)</option>
                <option value="ORA">Khusus ORA</option>
                <option value="DOO">Khusus DOO</option>
              </select>
            </div>

            {/* Kategori */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Kategori Prioritas:
              </label>
              <select
                value={katFilter}
                onChange={(e) => setKatFilter(e.target.value as "all" | "1P" | "2P" | "3P")}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium outline-hidden ${
                  isDarkMode
                    ? "bg-[#111c33] border-slate-700 text-slate-200"
                    : "bg-white border-slate-300 text-slate-800"
                }`}
              >
                <option value="all">Semua Kategori</option>
                <option value="1P">1P</option>
                <option value="2P">2P</option>
                <option value="3P">3P</option>
              </select>
            </div>
          </div>

          {/* 4. PRATINJAU HASIL FILTER AKHIR */}
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isDarkMode
                ? "bg-[#0b1222] border-slate-700/80"
                : "bg-blue-50/70 border-blue-200 text-blue-950"
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
              <div className={`p-2 rounded-lg border text-center ${
                isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"
              }`}>
                <div className="text-[10px] text-slate-500 font-medium">Gudang / Entitas</div>
                <div className={`text-xs font-black mt-0.5 ${
                  warehouseFilter === "MBI"
                    ? "text-blue-600 dark:text-blue-400"
                    : warehouseFilter === "MAI"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-indigo-600 dark:text-indigo-400"
                }`}>
                  {warehouseFilter === "ALL" ? "MBI & MAI (2 Sheet)" : warehouseFilter === "MBI" ? "Khusus MBI" : "Khusus MAI"}
                </div>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"
              }`}>
                <div className="text-[10px] text-slate-500 font-medium">Total SO Terfaktur</div>
                <div className="text-base font-extrabold font-mono text-blue-600 dark:text-blue-400">
                  {activeMetrics.soCount}
                </div>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"
              }`}>
                <div className="text-[10px] text-slate-500 font-medium">Total Lembar Faktur</div>
                <div className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                  {activeMetrics.fakturCount}
                </div>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                isDarkMode ? "bg-[#111c33] border-slate-700/60" : "bg-white border-blue-100"
              }`}>
                <div className="text-[10px] text-slate-500 font-medium">Basis Penarikan</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  {dateBasis === "order" ? "Tgl Order SO" : "Tgl Faktur (Tx)"}
                </div>
              </div>
            </div>

            {/* Helper notice */}
            <div className={`text-[11px] leading-relaxed p-2.5 rounded-lg border flex items-start gap-1.5 ${
              isDarkMode
                ? "bg-slate-900/60 border-slate-800 text-slate-300"
                : "bg-blue-100/60 border-blue-200 text-blue-900"
            }`}>
              <span className="text-xs mt-0.5">💡</span>
              <div>
                {warehouseFilter === "ALL" ? (
                  <span>
                    Data akan otomatis dipisahkan ke dalam <strong>Sheet &quot;Gudang MBI&quot;</strong> ({metricsMbi.fakturCount} faktur) dan <strong>Sheet &quot;Gudang MAI&quot;</strong> ({metricsMai.fakturCount} faktur) plus 1 sheet Ringkasan Rekap.
                  </span>
                ) : (
                  <span>
                    Mengekspor <strong>{activeMetrics.fakturCount} faktur</strong> ({activeMetrics.soCount} SO) khusus entitas <strong>{warehouseFilter === "MBI" ? "PT Medika Bina Investama (MBI)" : "PT Medika Akses Investama (MAI)"}</strong>.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Separated Download Actions */}
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
            {/* Quick Single Warehouse Buttons when ALL is active */}
            {warehouseFilter === "ALL" && (
              <>
                <button
                  type="button"
                  onClick={() => handleDownload("MBI_ONLY")}
                  disabled={metricsMbi.fakturCount === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    metricsMbi.fakturCount === 0
                      ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700"
                      : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30"
                  }`}
                  title="Unduh file Excel khusus data MBI saja"
                >
                  <Download className="w-3 h-3" />
                  <span>Unduh MBI Saja ({metricsMbi.fakturCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload("MAI_ONLY")}
                  disabled={metricsMai.fakturCount === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    metricsMai.fakturCount === 0
                      ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  }`}
                  title="Unduh file Excel khusus data MAI saja"
                >
                  <Download className="w-3 h-3" />
                  <span>Unduh MAI Saja ({metricsMai.fakturCount})</span>
                </button>
              </>
            )}

            {/* Primary Action Button */}
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
                  ? `Unduh Excel (2 Sheet Terpisah: ${metricsAll.fakturCount} Faktur)`
                  : warehouseFilter === "MBI"
                  ? `Unduh Excel MBI (${metricsMbi.fakturCount} Faktur)`
                  : `Unduh Excel MAI (${metricsMai.fakturCount} Faktur)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
