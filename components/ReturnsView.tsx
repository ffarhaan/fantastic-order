"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ShipmentReturnRecord } from "@/lib/types";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  User,
  Package,
  Calendar,
  Building2,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import * as XLSX from "xlsx";

interface ReturnsViewProps {
  onSelectCustomer?: (customerName: string) => void;
  onSelectInvoice?: (invoiceNo: string) => void;
}

export default function ReturnsView({ onSelectCustomer, onSelectInvoice }: ReturnsViewProps) {
  const [returns, setReturns] = useState<ShipmentReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pbfFilter, setPbfFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalAll: 0, totalResolved: 0, totalPending: 0 });
  const [selectedReturn, setSelectedReturn] = useState<ShipmentReturnRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Editable return fields state
  const [editForm, setEditForm] = useState({
    status: "Pending",
    confirm: "Approve",
    action: "Tukar fisik",
    root_cause: "Human error",
    nota_retur_no: "",
    person: "",
    note: "",
  });

  useEffect(() => {
    if (selectedReturn) {
      setEditForm({
        status: selectedReturn.status || "Pending",
        confirm: selectedReturn.confirm || "Approve",
        action: selectedReturn.action || "Tukar fisik",
        root_cause: selectedReturn.root_cause || "Human error",
        nota_retur_no: selectedReturn.nota_retur_no || "",
        person: selectedReturn.person || "",
        note: selectedReturn.note || "",
      });
    }
  }, [selectedReturn]);

  // New return form state
  const [newForm, setNewForm] = useState({
    pbf: "MBI",
    customer_name: "",
    invoice_no: "",
    so_no: "",
    product_name: "",
    qty: 1,
    batch_no: "",
    expiry_date: "",
    reason: "Fisik yang dikirim salah",
    category: "3P",
    confirm: "Approve",
    action: "Tukar fisik",
    status: "Pending",
    person: "",
    root_cause: "Human error",
    note: "",
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const limit = 50;

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "returns",
        limit: String(limit),
        offset: String(page * limit),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (pbfFilter !== "ALL") params.set("pbf", pbfFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);

      const res = await fetch(`/api/tidb?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReturns(data.data || []);
        setTotal(data.total || 0);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch returns:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, pbfFilter, categoryFilter, page]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/tidb?action=update_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: newStatus,
          resolved_date: newStatus === "Resolved" ? new Date().toISOString().split("T")[0] : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReturns((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
        );
        if (selectedReturn?.id === id) {
          setSelectedReturn((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        fetchReturns();
      }
    } catch (err) {
      alert("Gagal memperbarui status komplain.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedReturn) return;
    setIsUpdating(true);
    try {
      const isResolved = editForm.status === "Resolved";
      const res = await fetch("/api/tidb?action=update_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedReturn.id,
          ...editForm,
          resolved_date: isResolved
            ? selectedReturn.resolved_date || new Date().toISOString().split("T")[0]
            : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReturns((prev) =>
          prev.map((r) =>
            r.id === selectedReturn.id
              ? {
                  ...r,
                  ...editForm,
                  resolved_date: isResolved
                    ? selectedReturn.resolved_date || new Date().toISOString().split("T")[0]
                    : r.resolved_date,
                }
              : r
          )
        );
        setSelectedReturn(null);
        fetchReturns();
      } else {
        alert("Gagal update data: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error update: " + err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.customer_name || !newForm.product_name) {
      alert("Mohon isi Nama Apotek dan Nama Produk!");
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch("/api/tidb?action=create_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewForm({
          pbf: "MBI",
          customer_name: "",
          invoice_no: "",
          so_no: "",
          product_name: "",
          qty: 1,
          batch_no: "",
          expiry_date: "",
          reason: "Fisik yang dikirim salah",
          category: "3P",
          confirm: "Approve",
          action: "Tukar fisik",
          status: "Pending",
          person: "",
          root_cause: "Human error",
          note: "",
        });
        fetchReturns();
      } else {
        alert("Gagal menambahkan komplain: " + data.error);
      }
    } catch (err) {
      alert("Error: " + err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportExcel = () => {
    if (returns.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(returns);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shipment_Returns");
    XLSX.writeFile(wb, `Retur_Komplain_FantasticOrder_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ─── Executive KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Retur */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-blue-500/20 shadow-sm hover:border-blue-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                <Package className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>Total Komplain & Retur</span>
              </div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1.5 tracking-tight">
                {stats.totalAll.toLocaleString("id-ID")}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400 mt-1">
                Tercatat di TiDB Serverless
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs group-hover:scale-105 transition-transform">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: Selesai */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-emerald-500/20 shadow-sm hover:border-emerald-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Terselesaikan (Resolved)</span>
              </div>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5 tracking-tight">
                {stats.totalResolved.toLocaleString("id-ID")}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400 mt-1">
                {stats.totalAll > 0 ? ((stats.totalResolved / stats.totalAll) * 100).toFixed(1) : 0}% Tingkat Solusi
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Pending */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-amber-500/20 shadow-sm hover:border-amber-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Menunggu Tindak Lanjut</span>
              </div>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5 tracking-tight">
                {stats.totalPending.toLocaleString("id-ID")}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400 mt-1">
                Perlu tukar fisik / CN Retur
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-600/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Action Hub */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-indigo-500/20 shadow-sm hover:border-indigo-500/40 transition-all flex flex-col justify-between group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Aksi Cepat</span>
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">Input & Ekspor Data</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex-1 py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Baru</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 border border-zinc-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Unduh Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Search and Filters Command Bar ─── */}
      <div className="rounded-2xl p-2.5 sm:p-3 bg-white dark:bg-[#0c121f]/90 border border-zinc-200 dark:border-slate-800/80 shadow-xs flex flex-wrap gap-2.5 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No Faktur, SO, Apotek, Produk, atau Alasan..."
              className="w-full bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-zinc-900 dark:text-slate-100 placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Semua Status</option>
              <option value="Resolved">Resolved (Selesai)</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Approve">Approve</option>
            </select>
          </div>

          {/* PBF Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">PBF:</span>
            <select
              value={pbfFilter}
              onChange={(e) => {
                setPbfFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Semua PBF</option>
              <option value="MAI">PBF MAI</option>
              <option value="MBI" className="bg-slate-900 text-blue-300">PBF MBI</option>
            </select>
          </div>

          {/* Kategori Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 dark:bg-[#070b13] border border-slate-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-slate-400 font-medium">Kategori:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-slate-900 text-white">Semua Kategori</option>
              <option value="1P" className="bg-slate-900 text-purple-400">1P</option>
              <option value="2P" className="bg-slate-900 text-cyan-400">2P</option>
              <option value="3P" className="bg-slate-900 text-amber-400">3P</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchReturns}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all active:scale-95 shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── Enterprise Returns Table ─── */}
      <div className="rounded-2xl border border-zinc-300 dark:border-zinc-800/90 bg-white dark:bg-[#0a0f1c]/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 dark:bg-[#070b14] border-b-2 border-zinc-300 dark:border-zinc-800 text-[11px] font-black text-black dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3 w-16">PBF</th>
                <th className="py-2.5 px-4">Nama Apotek</th>
                <th className="py-2.5 px-3">No. Faktur</th>
                <th className="py-2.5 px-3">No. SO</th>
                <th className="py-2.5 px-4">Nama Produk & Qty</th>
                <th className="py-2.5 px-4">Alasan (Reason)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Tindakan</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 dark:divide-slate-800/50">
              {loading && returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-zinc-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span className="font-semibold text-sm">Memuat data tiket komplain & retur...</span>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-zinc-400">
                    <RotateCcw className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
                    <p className="font-semibold text-sm text-zinc-600 dark:text-slate-400">Tidak ada tiket komplain/retur yang cocok</p>
                    <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">Gunakan kata kunci lain atau ubah status filter.</p>
                  </td>
                </tr>
              ) : (
                returns.map((r) => {
                  const isResolved = (r.status || "").toLowerCase().includes("resolved");
                  const isPending = (r.status || "").toLowerCase().includes("pending");

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReturn(r)}
                      className="group hover:bg-zinc-100 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            r.pbf === "MAI"
                              ? "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30"
                              : "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                          }`}
                        >
                          {r.pbf && r.pbf !== "#N/A" ? r.pbf : "MBI"}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-bold text-black dark:text-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate max-w-[200px]" title={r.customer_name}>
                            {r.customer_name && r.customer_name !== "#N/A" ? r.customer_name : "-"}
                          </span>
                          {r.category && r.category !== "#N/A" && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                r.category === "1P"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                                  : r.category === "2P"
                                  ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                              }`}
                            >
                              {r.category}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {r.invoice_no && r.invoice_no !== "#N/A" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectInvoice) onSelectInvoice(r.invoice_no);
                            }}
                            className="font-bold text-blue-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            title="Buka Faktur Terkait"
                          >
                            <span>{r.invoice_no}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        ) : (
                          <span className="text-zinc-400 dark:text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-zinc-600 dark:text-slate-400 text-[11px]">
                        {r.so_no && r.so_no !== "#N/A" ? r.so_no : "-"}
                      </td>

                      <td className="py-2.5 px-4 max-w-[220px]">
                        <p className="truncate font-bold text-black dark:text-slate-200" title={r.product_name}>
                          {r.product_name && r.product_name !== "#N/A" ? r.product_name : "-"}
                        </p>
                        <p className="text-[10px] text-zinc-600 dark:text-slate-400">
                          Qty: <strong className="text-black dark:text-slate-200">{r.qty || 1}</strong>
                          {r.batch_no && r.batch_no !== "#N/A" && ` • Batch: ${r.batch_no}`}
                        </p>
                      </td>

                      <td className="py-2.5 px-4 max-w-[190px]">
                        <span className="truncate block text-zinc-800 dark:text-slate-300 font-semibold" title={r.reason}>
                          {r.reason && r.reason !== "#N/A" ? r.reason : "-"}
                        </span>
                        {r.root_cause && r.root_cause !== "#N/A" && (
                          <span className="text-[10px] text-zinc-500 dark:text-slate-500 truncate block">
                            Penyebab: {r.root_cause}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isResolved
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                              : isPending
                              ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                              : "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30"
                          }`}
                        >
                          {isResolved ? (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          ) : (
                            <Clock className="w-2.5 h-2.5" />
                          )}
                          <span>{r.status || "Pending"}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-zinc-800 dark:text-slate-300 max-w-[130px] truncate font-medium">
                        {r.action && r.action !== "#N/A" ? r.action : "-"}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReturn(r);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-black text-[11px] font-bold border border-zinc-300 dark:bg-slate-800 dark:hover:bg-indigo-600 dark:text-slate-200 dark:hover:text-white dark:border-slate-700 transition-all shadow-xs"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination Footer ─── */}
        <div className="bg-white dark:bg-[#070b14] border-t border-zinc-300 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-700 dark:text-slate-400">
          <div>
            Menampilkan{" "}
            <strong className="text-black dark:text-white">
              {total === 0 ? 0 : page * limit + 1} - {Math.min((page + 1) * limit, total)}
            </strong>{" "}
            dari <strong className="text-black dark:text-indigo-300">{total.toLocaleString("id-ID")}</strong> komplain
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-black disabled:opacity-30 border border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="px-3 py-1 font-bold text-black dark:text-slate-200">
              Hal {page + 1} / {totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-black disabled:opacity-30 border border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all font-semibold"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── DETAIL & EDIT MODAL ─── */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl relative my-auto">
            <button
              type="button"
              onClick={() => setSelectedReturn(null)}
              className="absolute right-4 top-4 text-zinc-500 hover:text-black dark:text-slate-400 dark:hover:text-white p-1 rounded-xl bg-zinc-100 dark:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-black dark:text-white">Edit & Rincian Komplain / Retur</h3>
                <p className="text-xs text-zinc-500 dark:text-slate-400">ID #{selectedReturn.id} • PBF {selectedReturn.pbf}</p>
              </div>
            </div>

            {/* Readonly Core Info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-slate-950/80 p-3.5 rounded-xl border border-zinc-200 dark:border-slate-800">
              <div>
                <p className="text-zinc-500 dark:text-slate-500 font-semibold">Nama Apotek / Merchant</p>
                <p className="text-black dark:text-slate-100 font-black text-sm mt-0.5">{selectedReturn.customer_name}</p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-slate-500 font-semibold">Kategori</p>
                <p className="text-amber-700 dark:text-amber-400 font-bold mt-0.5">{selectedReturn.category || "3P"}</p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-slate-500 font-semibold">No. Faktur</p>
                <p className="text-indigo-600 dark:text-indigo-400 font-mono font-black text-sm mt-0.5">
                  {selectedReturn.invoice_no || "-"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-slate-500 font-semibold">No. Sales Order</p>
                <p className="text-zinc-800 dark:text-slate-300 font-mono font-bold mt-0.5">{selectedReturn.so_no || "-"}</p>
              </div>
              <div className="col-span-2 border-t border-zinc-200 dark:border-slate-800 pt-2">
                <p className="text-zinc-500 dark:text-slate-500 font-semibold">Produk yang Dikomplain</p>
                <p className="text-black dark:text-white font-bold text-sm mt-0.5">{selectedReturn.product_name}</p>
                <p className="text-zinc-600 dark:text-slate-400 mt-0.5 font-medium">
                  Qty: <strong className="text-black dark:text-white font-bold">{selectedReturn.qty}</strong>
                  {selectedReturn.batch_no && ` • Batch: ${selectedReturn.batch_no}`}
                  {selectedReturn.expiry_date && ` • ED: ${selectedReturn.expiry_date}`}
                </p>
              </div>
              <div className="col-span-2 border-t border-zinc-200 dark:border-slate-800 pt-2">
                <p className="text-zinc-500 dark:text-slate-500 font-semibold">Alasan / Kendala Dilaporkan</p>
                <p className="text-amber-700 dark:text-amber-300 font-bold mt-0.5">{selectedReturn.reason || "-"}</p>
              </div>
            </div>

            {/* Editable Form Controls */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-slate-200">
                  Ubah Data Komplain & Retur
                </h4>
                <span className="text-[10px] text-zinc-500 dark:text-slate-400">
                  ⚡ Otomatis sinkron ke Spreadsheet & TiDB
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Status */}
                <div>
                  <label className="text-zinc-700 dark:text-slate-300 font-bold block mb-1">Status Tiket</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-zinc-300 dark:border-slate-700 rounded-xl p-2 text-black dark:text-slate-200 font-bold focus:ring-2 focus:ring-black dark:focus:ring-indigo-500 outline-none"
                  >
                    <option value="Pending">Pending (Menunggu)</option>
                    <option value="In Progress">In Progress (Sedang Diproses)</option>
                    <option value="Resolved">Resolved (Selesai)</option>
                    <option value="Approve">Approve</option>
                  </select>
                </div>

                {/* Confirm */}
                <div>
                  <label className="text-zinc-700 dark:text-slate-300 font-bold block mb-1">Status Konfirmasi (Confirm)</label>
                  <select
                    value={editForm.confirm}
                    onChange={(e) => setEditForm({ ...editForm, confirm: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-zinc-300 dark:border-slate-700 rounded-xl p-2 text-black dark:text-slate-200 font-bold focus:ring-2 focus:ring-black dark:focus:ring-indigo-500 outline-none"
                  >
                    <option value="Approve">Approve (Disetujui)</option>
                    <option value="Reject">Reject (Ditolak)</option>
                    <option value="Pending">Pending</option>
                    <option value="Review">Perlu Review</option>
                  </select>
                </div>

                {/* Action / Tindakan */}
                <div>
                  <label className="text-zinc-700 dark:text-slate-300 font-bold block mb-1">Tindakan (Action)</label>
                  <input
                    type="text"
                    value={editForm.action}
                    onChange={(e) => setEditForm({ ...editForm, action: e.target.value })}
                    placeholder="Contoh: Tukar fisik / Retur nota / Kirim susulan"
                    className="w-full bg-white dark:bg-slate-950 border border-zinc-300 dark:border-slate-700 rounded-xl p-2 text-black dark:text-slate-200 font-medium focus:ring-2 focus:ring-black dark:focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Root Cause */}
                <div>
                  <label className="text-zinc-700 dark:text-slate-300 font-bold block mb-1">Penyebab Masalah (Root Cause)</label>
                  <input
                    type="text"
                    value={editForm.root_cause}
                    onChange={(e) => setEditForm({ ...editForm, root_cause: e.target.value })}
                    placeholder="Contoh: Human error / Picker salah ambil / Driver salah kirim"
                    className="w-full bg-white dark:bg-slate-950 border border-zinc-300 dark:border-slate-700 rounded-xl p-2 text-black dark:text-slate-200 font-medium focus:ring-2 focus:ring-black dark:focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* No Nota Retur */}
                <div>
                  <label className="text-zinc-700 dark:text-slate-300 font-bold block mb-1">No. Nota Retur</label>
                  <input
                    type="text"
                    value={editForm.nota_retur_no}
                    onChange={(e) => setEditForm({ ...editForm, nota_retur_no: e.target.value })}
                    placeholder="Contoh: NR-2024-001 (opsional)"
                    className="w-full bg-white dark:bg-slate-950 border border-zinc-300 dark:border-slate-700 rounded-xl p-2 text-black dark:text-slate-200 font-medium focus:ring-2 focus:ring-black dark:focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Person / PIC */}
                <div>
                  <label className="text-zinc-700 dark:text-slate-300 font-bold block mb-1">PIC / Petugas</label>
                  <input
                    type="text"
                    value={editForm.person}
                    onChange={(e) => setEditForm({ ...editForm, person: e.target.value })}
                    placeholder="Nama PIC penanggung jawab"
                    className="w-full bg-white dark:bg-slate-950 border border-zinc-300 dark:border-slate-700 rounded-xl p-2 text-black dark:text-slate-200 font-medium focus:ring-2 focus:ring-black dark:focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Catatan / Note */}
                <div className="sm:col-span-2">
                  <label className="text-zinc-700 dark:text-slate-300 font-bold block mb-1">Catatan Tambahan (Note)</label>
                  <textarea
                    rows={2}
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    placeholder="Tulis catatan tindak lanjut atau keterangan tambahan..."
                    className="w-full bg-white dark:bg-slate-950 border border-zinc-300 dark:border-slate-700 rounded-xl p-2 text-black dark:text-slate-200 font-medium focus:ring-2 focus:ring-black dark:focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions & Submit */}
            <div className="flex flex-wrap items-center justify-between border-t border-zinc-200 dark:border-slate-800 pt-3.5 gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-black hover:bg-zinc-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                >
                  {isUpdating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan & Sync"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-black dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-zinc-300 dark:border-slate-700 transition-all"
                >
                  Batal
                </button>
              </div>

              {onSelectCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedReturn.customer_name;
                    setSelectedReturn(null);
                    onSelectCustomer(c);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Lihat di Master Customer</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD NEW RETURN MODAL ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl relative overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800/80"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Input Tiket Komplain & Retur Baru</span>
            </h3>

            <form onSubmit={handleCreateReturn} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">PBF</label>
                  <select
                    value={newForm.pbf}
                    onChange={(e) => setNewForm({ ...newForm, pbf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-semibold"
                  >
                    <option value="MBI">MBI</option>
                    <option value="MAI">MAI</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kategori</label>
                  <select
                    value={newForm.category}
                    onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-semibold"
                  >
                    <option value="1P">1P</option>
                    <option value="2P">2P</option>
                    <option value="3P">3P</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nama Apotek / RS / Merchant *</label>
                <input
                  type="text"
                  required
                  value={newForm.customer_name}
                  onChange={(e) => setNewForm({ ...newForm, customer_name: e.target.value })}
                  placeholder="Contoh: Apotek Halomedika Tebet"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">No. Faktur</label>
                  <input
                    type="text"
                    value={newForm.invoice_no}
                    onChange={(e) => setNewForm({ ...newForm, invoice_no: e.target.value })}
                    placeholder="Contoh: 14040 atau INV/..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">No. Sales Order (SO)</label>
                  <input
                    type="text"
                    value={newForm.so_no}
                    onChange={(e) => setNewForm({ ...newForm, so_no: e.target.value })}
                    placeholder="Contoh: 696000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nama Produk yang Dikomplain *</label>
                <input
                  type="text"
                  required
                  value={newForm.product_name}
                  onChange={(e) => setNewForm({ ...newForm, product_name: e.target.value })}
                  placeholder="Contoh: Paracetamol 500mg Strip"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Jumlah (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    value={newForm.qty}
                    onChange={(e) => setNewForm({ ...newForm, qty: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">No. Batch</label>
                  <input
                    type="text"
                    value={newForm.batch_no}
                    onChange={(e) => setNewForm({ ...newForm, batch_no: e.target.value })}
                    placeholder="Opsional"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={newForm.expiry_date}
                    onChange={(e) => setNewForm({ ...newForm, expiry_date: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Alasan Komplain (Reason)</label>
                <select
                  value={newForm.reason}
                  onChange={(e) => setNewForm({ ...newForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200 font-medium"
                >
                  <option value="Fisik yang dikirim salah">Fisik yang dikirim salah</option>
                  <option value="Fisik yang dikirim kurang">Fisik yang dikirim kurang</option>
                  <option value="Fisik yang dikirim lebih">Fisik yang dikirim lebih</option>
                  <option value="Barang rusak / bocor / basah">Barang rusak / bocor / basah</option>
                  <option value="ED terlalu dekat (< 6 bulan)">ED terlalu dekat (&lt; 6 bulan)</option>
                  <option value="Faktur tidak sesuai fisik">Faktur tidak sesuai fisik</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan Komplain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
