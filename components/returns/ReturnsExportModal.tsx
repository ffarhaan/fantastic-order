"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { ShipmentReturnRecord } from "@/lib/types";
import {
  Download,
  FileSpreadsheet,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
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
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
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
  const [activeTab, setActiveTab] = useState<"quick" | "custom">("quick");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pbfFilter, setPbfFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [weekFilter, setWeekFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [splitByPbf, setSplitByPbf] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      setShowAdvanced(false);
      setActiveTab("quick");
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
    setSplitByPbf(false);
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

  const fetchAndExport = async (
    mode: "FULL_SYSTEM" | "CURRENT_SCREEN" | "OPEN_CASES" | "REJECTED_CASES" | "CUSTOM"
  ) => {
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

        if (mode === "CURRENT_SCREEN") {
          if (initialSearch.trim()) params.set("search", initialSearch.trim());
          if (initialStatus !== "ALL") params.set("status", initialStatus);
          if (initialPbf !== "ALL") params.set("pbf", initialPbf);
          if (initialCategory !== "ALL") params.set("category", initialCategory);
          if (initialMonth !== "ALL") params.set("month", initialMonth);
          if (initialWeek !== "ALL") params.set("week", initialWeek);
        } else if (mode === "OPEN_CASES") {
          params.set("status", "Open case");
        } else if (mode === "REJECTED_CASES") {
          params.set("status", "Rejected");
        } else if (mode === "CUSTOM") {
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
        alert("Tidak ada data Shipment Error yang sesuai untuk diekspor.");
        return;
      }

      const wb = XLSX.utils.book_new();
      const forceAllCols = mode !== "CUSTOM";

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
      const suffixMap: Record<typeof mode, string> = {
        FULL_SYSTEM: "Keseluruhan_Sistem",
        CURRENT_SCREEN: "Sesuai_Filter_Layar",
        OPEN_CASES: "Belum_Selesai_Open",
        REJECTED_CASES: "Ditolak_Rejected",
        CUSTOM: "Custom_Filter",
      };
      XLSX.writeFile(wb, `Shipment_Error_${suffixMap[mode]}_${todayStr}.xlsx`);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65"
      onClick={() => !isExporting && onClose()}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl shadow-2xl border overflow-hidden flex flex-col bg-white dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Neutral Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base tracking-tight">
                Ekspor Excel Shipment Error
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Total di sistem: <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{totalSystemAll.toLocaleString("id-ID")}</span> data (tanpa batas 50 baris)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !isExporting && onClose()}
            disabled={isExporting}
            className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold cursor-pointer disabled:opacity-50"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        {/* 2 Simple Mode Tabs */}
        <div className="px-5 pt-3 pb-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0c0c0f] flex items-center gap-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => setActiveTab("quick")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
              activeTab === "quick"
                ? "bg-blue-700 text-white border-blue-600"
                : "bg-white dark:bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            1. Ekspor Cepat (Langsung Unduh)
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => setActiveTab("custom")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
              activeTab === "custom"
                ? "bg-blue-700 text-white border-blue-600"
                : "bg-white dark:bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            2. Ekspor Custom (Atur Filter &amp; Kolom)
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[72vh] space-y-3.5">
          {activeTab === "quick" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Semua Data (Biru) */}
              <button
                type="button"
                onClick={() => fetchAndExport("FULL_SYSTEM")}
                disabled={isExporting || totalSystemAll === 0}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-blue-600 dark:border-l-blue-500 bg-white dark:bg-[#121215] hover:bg-blue-50/40 dark:hover:bg-zinc-900 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45"
              >
                <div>
                  <div className="text-xs font-bold">Semua Data Sistem (100%)</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                      {totalSystemAll.toLocaleString("id-ID")}
                    </span>{" "}
                    baris (Semua + MBI + MAI)
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold shrink-0">
                  Unduh
                </span>
              </button>

              {/* Sesuai Filter Layar (Hijau) */}
              <button
                type="button"
                onClick={() => fetchAndExport("CURRENT_SCREEN")}
                disabled={isExporting || currentFilteredTotal === 0}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-emerald-600 dark:border-l-emerald-500 bg-white dark:bg-[#121215] hover:bg-emerald-50/40 dark:hover:bg-zinc-900 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45"
              >
                <div>
                  <div className="text-xs font-bold">Sesuai Filter Layar</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {currentFilteredTotal.toLocaleString("id-ID")}
                    </span>{" "}
                    baris (utuh semua halaman)
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
                  Unduh
                </span>
              </button>

              {/* Belum Selesai (Kuning) */}
              <button
                type="button"
                onClick={() => fetchAndExport("OPEN_CASES")}
                disabled={isExporting || totalSystemAll === 0}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-amber-500 bg-white dark:bg-[#121215] hover:bg-amber-50/40 dark:hover:bg-zinc-900 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45"
              >
                <div>
                  <div className="text-xs font-bold">Kasus Belum Selesai</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Status Pending &amp; In Progress
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300 text-xs font-bold shrink-0">
                  Unduh
                </span>
              </button>

              {/* Ditolak / Reject (Merah) */}
              <button
                type="button"
                onClick={() => fetchAndExport("REJECTED_CASES")}
                disabled={isExporting || totalSystemAll === 0}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-rose-600 dark:border-l-rose-500 bg-white dark:bg-[#121215] hover:bg-rose-50/40 dark:hover:bg-zinc-900 text-left flex items-center justify-between gap-3 cursor-pointer disabled:opacity-45"
              >
                <div>
                  <div className="text-xs font-bold">Khusus Ditolak (Rejected)</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Semua kasus reject beserta alasannya
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 text-rose-800 dark:text-rose-300 text-xs font-bold shrink-0">
                  Unduh
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Filter Utama Custom */}
              <div className="p-3.5 rounded-xl border bg-zinc-50 dark:bg-[#121215] border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">1. Pilih PBF, Status &amp; Waktu</span>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">PBF</label>
                    <select
                      value={pbfFilter}
                      onChange={(e) => setPbfFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-semibold"
                    >
                      <option value="ALL">Semua PBF</option>
                      <option value="MBI">MBI</option>
                      <option value="MAI">MAI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-semibold"
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
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Kategori</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-semibold"
                    >
                      <option value="ALL">Semua</option>
                      <option value="1P">1P</option>
                      <option value="2P">2P</option>
                      <option value="3P">3P</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Bulan</label>
                    <select
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-semibold"
                    >
                      <option value="ALL">Semua Bulan</option>
                      {["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].map((m, i) => (
                        <option key={i + 1} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Week</label>
                    <select
                      value={weekFilter}
                      onChange={(e) => setWeekFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-semibold"
                    >
                      <option value="ALL">Semua Week</option>
                      {availableWeeks.map((w) => (
                        <option key={w} value={String(w)}>W{w}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Dari Tanggal Lapor
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Hingga Tanggal Lapor
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Opsi Lanjutan & Kolom */}
              <div className="rounded-xl border bg-zinc-50 dark:bg-[#121215] border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span>2. Pencarian Kata Kunci &amp; Pilih Kolom ({selectedCols.size}/{RETURN_EXPORT_COLUMNS.length} kolom)</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvanced && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Kata kunci opsional (No Faktur, No SO, Apotek, Produk, Personil)..."
                      className="w-full px-3 py-1.5 rounded-lg border bg-white dark:bg-[#09090b] border-zinc-300 dark:border-zinc-800 text-xs font-medium"
                    />

                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={splitByPbf}
                        onChange={(e) => setSplitByPbf(e.target.checked)}
                        className="accent-blue-600 rounded w-3.5 h-3.5"
                      />
                      <span>Pisahkan sheet &quot;Khusus_MBI&quot; &amp; &quot;Khusus_MAI&quot; di dalam file</span>
                    </label>

                    <div className="space-y-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">Kolom Excel:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCols(new Set(DEFAULT_RETURN_COLS))}
                          className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                        >
                          Centang Semua
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {RETURN_EXPORT_COLUMNS.map((col) => {
                          const active = selectedCols.has(col.id);
                          return (
                            <label
                              key={col.id}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer ${
                                active
                                  ? "border-blue-500/35 bg-blue-500/10 font-semibold"
                                  : "border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={active}
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

          {progressText && (
            <div className="p-2.5 rounded-lg bg-blue-500/12 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{progressText}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0c0c0f] flex flex-wrap items-center justify-between gap-2">
          {activeTab === "custom" ? (
            <>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Data tabel saat ini: <strong className="font-mono text-zinc-900 dark:text-zinc-100">{currentFilteredTotal.toLocaleString("id-ID")}</strong> baris
              </span>
              <button
                type="button"
                onClick={() => fetchAndExport("CUSTOM")}
                disabled={isExporting}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-45"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isExporting ? "Mengunduh..." : "Unduh Excel"}</span>
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
                disabled={isExporting}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-bold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
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
