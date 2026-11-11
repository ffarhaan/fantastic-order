"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { ShipmentReturnRecord } from "@/lib/types";
import {
  Download,
  FileSpreadsheet,
  RotateCcw,
  SlidersHorizontal,
  Search,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";

interface ReturnsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalSystemAll: number;
  currentFilteredTotal: number;
  availableWeeks: number[];
  initialSearch?: string;
  initialStatus?: string;
  initialPbf?: string;
  initialCategory?: string;
  initialMonth?: string;
  initialWeek?: string;
  getInvoiceDate: (r: ShipmentReturnRecord) => string;
  formatDate: (d: string | null | undefined) => string;
  calculateDaysUntilToday: (d?: string | null) => number | string;
  calculateDaysUntilClose: (r?: string | null, res?: string | null, s?: string) => number | string;
}

const RETURN_EXPORT_COLUMNS = [
  { id: "no", label: "No" },
  { id: "pbf", label: "PBF" },
  { id: "month", label: "Bulan" },
  { id: "week", label: "Week" },
  { id: "customer_name", label: "Nama Apotek" },
  { id: "invoice_no", label: "No. Faktur" },
  { id: "invoice_date", label: "Tanggal Faktur" },
  { id: "report_date", label: "Tanggal Lapor" },
  { id: "so_no", label: "No. SO" },
  { id: "product_name", label: "Nama Produk" },
  { id: "qty", label: "Qty" },
  { id: "batch_no", label: "Batch" },
  { id: "expiry_date", label: "ED" },
  { id: "reason", label: "Alasan (Reason)" },
  { id: "status", label: "Status" },
  { id: "inprogress_type", label: "Tipe In Progress" },
  { id: "resolved_date", label: "Tanggal Penyelesaian" },
  { id: "days_today", label: "Days until Today" },
  { id: "days_close", label: "Days until close" },
  { id: "action", label: "Tindakan" },
  { id: "confirm", label: "Status Konfirmasi" },
  { id: "nota_retur_no", label: "No. Nota Retur" },
  { id: "person", label: "Person (Pelaku)" },
  { id: "root_cause", label: "Akar Masalah (Root Cause)" },
  { id: "reject_reason", label: "Alasan Reject" },
  { id: "category", label: "Kategori" },
  { id: "note", label: "Catatan" },
] as const;

type ReturnColId = (typeof RETURN_EXPORT_COLUMNS)[number]["id"];
const DEFAULT_RETURN_COLS: ReturnColId[] = RETURN_EXPORT_COLUMNS.map((c) => c.id);

function toIsoDate(val?: string | null): string | null {
  if (!val || val === "-" || val === "#N/A") return null;
  const s = String(val).trim().split("T")[0].split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export default function ReturnsExportModal({
  isOpen,
  onClose,
  totalSystemAll,
  currentFilteredTotal,
  availableWeeks,
  initialSearch = "",
  initialStatus = "ALL",
  initialPbf = "ALL",
  initialCategory = "ALL",
  initialMonth = "ALL",
  initialWeek = "ALL",
  getInvoiceDate,
  formatDate,
  calculateDaysUntilToday,
  calculateDaysUntilClose,
}: ReturnsExportModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pbfFilter, setPbfFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [weekFilter, setWeekFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [splitByPbf, setSplitByPbf] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedCols, setSelectedCols] = useState<Set<ReturnColId>>(() => new Set(DEFAULT_RETURN_COLS));

  const [isExporting, setIsExporting] = useState(false);
  const [progressText, setProgressText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialSearch || "");
      setStatusFilter(initialStatus || "ALL");
      setPbfFilter(initialPbf || "ALL");
      setCategoryFilter(initialCategory || "ALL");
      setMonthFilter(initialMonth || "ALL");
      setWeekFilter(initialWeek || "ALL");
      setStartDate("");
      setEndDate("");
      setProgressText("");
    }
  }, [isOpen, initialSearch, initialStatus, initialPbf, initialCategory, initialMonth, initialWeek]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setPbfFilter("ALL");
    setCategoryFilter("ALL");
    setMonthFilter("ALL");
    setWeekFilter("ALL");
    setStartDate("");
    setEndDate("");
  };

  const toggleColumn = (id: ReturnColId) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatReturnRows = (rows: ShipmentReturnRecord[], forceAllCols = false) => {
    const useCol = (id: ReturnColId) => forceAllCols || selectedCols.has(id);
    return rows.map((r, idx) => {
      const row: Record<string, string | number> = {};
      if (useCol("no")) row["No"] = idx + 1;
      if (useCol("pbf")) row["PBF"] = r.pbf || "MBI";
      if (useCol("month")) row["Bulan"] = r.month || "-";
      if (useCol("week")) row["Week"] = r.week ? `W${r.week}` : "-";
      if (useCol("customer_name")) row["Nama Apotek"] = r.customer_name || "-";
      if (useCol("invoice_no")) row["No. Faktur"] = r.invoice_no || "-";
      if (useCol("invoice_date")) row["Tanggal Faktur"] = formatDate(getInvoiceDate(r));
      if (useCol("report_date")) {
        row["Tanggal Lapor"] = r.report_date
          ? formatDate(r.report_date)
          : r.created_at
          ? formatDate(r.created_at.split(" ")[0])
          : "-";
      }
      if (useCol("so_no")) row["No. SO"] = r.so_no || "-";
      if (useCol("product_name")) row["Nama Produk"] = r.product_name || "-";
      if (useCol("qty")) row["Qty"] = r.qty || 1;
      if (useCol("batch_no")) row["Batch"] = r.batch_no || "-";
      if (useCol("expiry_date")) row["ED"] = r.expiry_date || "-";
      if (useCol("reason")) row["Alasan (Reason)"] = r.reason || "-";
      if (useCol("status")) row["Status"] = r.status || "Pending";
      if (useCol("inprogress_type")) row["Tipe In Progress"] = r.inprogress_type || "-";
      if (useCol("resolved_date")) row["Tanggal Penyelesaian"] = formatDate(r.resolved_date);
      if (useCol("days_today")) row["Days until Today"] = calculateDaysUntilToday(r.report_date);
      if (useCol("days_close")) row["Days until close"] = calculateDaysUntilClose(r.report_date, r.resolved_date, r.status);
      if (useCol("action")) row["Tindakan"] = r.action || "-";
      if (useCol("confirm")) row["Status Konfirmasi"] = r.confirm || "-";
      if (useCol("nota_retur_no")) row["No. Nota Retur"] = r.nota_retur_no || "-";
      if (useCol("person")) row["Person (Pelaku)"] = r.person || "-";
      if (useCol("root_cause")) row["Akar Masalah (Root Cause)"] = r.root_cause || "-";
      if (useCol("reject_reason")) row["Alasan Reject"] = r.reject_reason || "-";
      if (useCol("category")) row["Kategori"] = r.category || "-";
      if (useCol("note")) row["Catatan"] = r.note || "-";
      return row;
    });
  };

  const fetchAndExport = async (mode: "FULL_SYSTEM" | "CUSTOM") => {
    if (isExporting) return;
    setIsExporting(true);
    setProgressText("Menghubungkan ke database...");

    try {
      const allRows: ShipmentReturnRecord[] = [];
      const seenIds = new Set<number>();
      const BATCH_SIZE = 2000;
      let offset = 0;
      let expectedTotal = 0;
      const cacheBuster = String(Date.now());

      while (true) {
        const params = new URLSearchParams({
          action: "returns",
          limit: String(BATCH_SIZE),
          offset: String(offset),
          fresh: "true",
          _t: cacheBuster,
        });

        if (mode === "CUSTOM") {
          if (searchQuery.trim()) params.set("search", searchQuery.trim());
          if (statusFilter !== "ALL") params.set("status", statusFilter);
          if (pbfFilter !== "ALL") params.set("pbf", pbfFilter);
          if (categoryFilter !== "ALL") params.set("category", categoryFilter);
          if (monthFilter !== "ALL") params.set("month", monthFilter);
          if (weekFilter !== "ALL") params.set("week", weekFilter);
        }

        const res = await fetch(`/api/tidb?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Server mengembalikan HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Gagal mengambil data shipment error dari database.");
        }

        if (expectedTotal === 0 && typeof data.total === "number") {
          expectedTotal = data.total;
        }

        const batch: ShipmentReturnRecord[] = Array.isArray(data.data) ? data.data : [];
        if (batch.length === 0) break;

        for (const item of batch) {
          if (item.id != null) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
          }
          allRows.push(item);
        }

        setProgressText(
          `Mengambil data: ${allRows.length.toLocaleString("id-ID")}${
            expectedTotal > 0 ? ` / ${expectedTotal.toLocaleString("id-ID")}` : ""
          } baris...`
        );

        offset += batch.length;
        if (batch.length < BATCH_SIZE) break;
        if (expectedTotal > 0 && allRows.length >= expectedTotal) break;
      }

      // Optional client-side custom date range filter on report_date
      let finalRows = allRows;
      if (mode === "CUSTOM" && (startDate || endDate)) {
        finalRows = allRows.filter((r) => {
          const iso = toIsoDate(r.report_date) || toIsoDate(r.created_at);
          if (!iso) return false;
          if (startDate && iso < startDate) return false;
          if (endDate && iso > endDate) return false;
          return true;
        });
      }

      if (finalRows.length === 0) {
        alert("Tidak ada data Shipment Error yang sesuai kriteria filter untuk diekspor.");
        return;
      }

      const wb = XLSX.utils.book_new();
      const forceAllCols = mode === "FULL_SYSTEM";

      if (splitByPbf || mode === "FULL_SYSTEM") {
        const mbiRows = finalRows.filter((r) => (r.pbf || "MBI").toUpperCase() === "MBI");
        const maiRows = finalRows.filter((r) => (r.pbf || "MBI").toUpperCase() === "MAI");
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(formatReturnRows(finalRows, forceAllCols)),
          "Semua_Shipment_Returns"
        );
        if (mbiRows.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(formatReturnRows(mbiRows, forceAllCols)),
            "Khusus_MBI"
          );
        }
        if (maiRows.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(formatReturnRows(maiRows, forceAllCols)),
            "Khusus_MAI"
          );
        }
      } else {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(formatReturnRows(finalRows, forceAllCols)),
          "Shipment_Returns"
        );
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const suffix = mode === "FULL_SYSTEM" ? "Keseluruhan_Sistem" : "Custom_Filter";
      XLSX.writeFile(wb, `Shipment_Error_${suffix}_${todayStr}.xlsx`);
      onClose();
    } catch (err: any) {
      console.error("ReturnsExportModal export error:", err);
      alert("Gagal mengekspor data Shipment Error: " + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
      setProgressText("");
    }
  };

  if (!isOpen) return null;

  const hasCustomFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "ALL" ||
    pbfFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    monthFilter !== "ALL" ||
    weekFilter !== "ALL" ||
    Boolean(startDate) ||
    Boolean(endDate);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => !isExporting && onClose()}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col bg-white dark:bg-[#0c1426] border-zinc-200 dark:border-slate-700/80 text-zinc-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-slate-800 bg-gradient-to-r from-indigo-700 via-blue-700 to-emerald-700 text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-2 flex-wrap">
                <span>Ekspor Data Shipment Error (Custom & Keseluruhan)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono font-bold">
                  {totalSystemAll.toLocaleString("id-ID")} Total Data Sistem
                </span>
              </h2>
              <p className="text-[11px] text-blue-100 font-medium">
                Tarik 100% seluruh data di sistem tanpa batas 50 baris, atau atur custom filter &amp; kolom
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isExporting && onClose()}
            disabled={isExporting}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto max-h-[78vh] text-xs">
          {/* Quick Full System Banner */}
          <div className="p-3.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Ekspor Keseluruhan Sistem (Tanpa Filter, 0 Terlewat)</span>
              </div>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                Menarik 100% seluruh <strong>{totalSystemAll.toLocaleString("id-ID")} data</strong> komplain &amp; retur di database (termasuk sheet gabungan + sheet terpisah MBI &amp; MAI).
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchAndExport("FULL_SYSTEM")}
              disabled={isExporting || totalSystemAll === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting ? "Memproses..." : `Ekspor Semua (${totalSystemAll.toLocaleString("id-ID")} Baris)`}
              </span>
            </button>
          </div>

          {/* Custom Filter Section */}
          <div className="p-3.5 rounded-xl border bg-zinc-50 dark:bg-[#111c33] border-zinc-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-zinc-700 dark:text-slate-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                <span>Atau Custom Filter Tarikan Data:</span>
              </span>
              {hasCustomFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kata kunci opsional (No Faktur, No SO, Apotek, Produk, Alasan, Personil)..."
                className="w-full pl-8 pr-8 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-slate-400 mb-1">PBF</label>
                <select
                  value={pbfFilter}
                  onChange={(e) => setPbfFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs font-semibold"
                >
                  <option value="ALL">Semua PBF</option>
                  <option value="MBI">MBI</option>
                  <option value="MAI">MAI</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-slate-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs font-semibold"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress (Semua)</option>
                  <option value="In Progress (Operasional)">In Progress (Operasional)</option>
                  <option value="In Progress (Klaim & Retur)">In Progress (Klaim &amp; Retur)</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Open case">Belum Selesai (Open)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-slate-400 mb-1">Kategori</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs font-semibold"
                >
                  <option value="ALL">Semua</option>
                  <option value="1P">1P</option>
                  <option value="2P">2P</option>
                  <option value="3P">3P</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-slate-400 mb-1">Bulan</label>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs font-semibold"
                >
                  <option value="ALL">Semua Bulan</option>
                  {[
                    "Januari",
                    "Februari",
                    "Maret",
                    "April",
                    "Mei",
                    "Juni",
                    "Juli",
                    "Agustus",
                    "September",
                    "Oktober",
                    "November",
                    "Desember",
                  ].map((mName, idx) => (
                    <option key={idx + 1} value={String(idx + 1)}>
                      {mName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-slate-400 mb-1">Week</label>
                <select
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs font-semibold"
                >
                  <option value="ALL">Semua Week</option>
                  {availableWeeks.map((w) => (
                    <option key={w} value={String(w)}>
                      W{w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rentang Tanggal Lapor Custom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" />
                  <span>Dari Tanggal Lapor (Opsional):</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" />
                  <span>Hingga Tanggal Lapor (Opsional):</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-300 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-[11px] font-semibold text-zinc-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={splitByPbf}
                onChange={(e) => setSplitByPbf(e.target.checked)}
                className="accent-indigo-600 rounded w-3.5 h-3.5 cursor-pointer"
              />
              <span>Pisahkan juga ke Sheet &quot;Khusus_MBI&quot; &amp; &quot;Khusus_MAI&quot; di dalam file Excel</span>
            </label>

            {/* Custom Columns Picker */}
            <div className="rounded-lg border bg-white dark:bg-[#0c1426] border-zinc-200 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setShowColumnPicker((v) => !v)}
                className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                  <span>
                    Custom Kolom Excel ({selectedCols.size}/{RETURN_EXPORT_COLUMNS.length} kolom aktif)
                  </span>
                </span>
                {showColumnPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showColumnPicker && (
                <div className="px-3 pb-3 pt-1 border-t border-zinc-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedCols(new Set(DEFAULT_RETURN_COLS))}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
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
                            "pbf",
                            "customer_name",
                            "invoice_no",
                            "report_date",
                            "so_no",
                            "product_name",
                            "qty",
                            "reason",
                            "status",
                            "person",
                          ])
                        )
                      }
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                    >
                      Kolom Ringkas
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {RETURN_EXPORT_COLUMNS.map((col) => {
                      const active = selectedCols.has(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] cursor-pointer select-none ${
                            active
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700/60 text-blue-900 dark:text-blue-200 font-semibold"
                              : "bg-zinc-50 dark:bg-slate-900 border-zinc-200 dark:border-slate-800 text-zinc-400 dark:text-slate-500"
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

          {progressText && (
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs text-center animate-pulse">
              {progressText}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-[#0e1935] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 dark:text-slate-400 hover:bg-zinc-200 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-medium">
              Filter tabel saat ini: <strong>{currentFilteredTotal.toLocaleString("id-ID")}</strong> baris
            </span>
            <button
              type="button"
              onClick={() => fetchAndExport("CUSTOM")}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Mengunduh..." : "Unduh Sesuai Filter Custom"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
