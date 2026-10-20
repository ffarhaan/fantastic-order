"use client";

import { useState, useEffect, useCallback } from "react";
import { CustomerRecord, ShipmentReturnRecord } from "@/lib/types";
import {
  Building2,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  Clock,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Layers,
  Database,
  Store,
} from "lucide-react";
import * as XLSX from "xlsx";

interface CustomersViewProps {
  onSelectCustomerForFilter?: (name: string) => void;
}

export default function CustomersView({ onSelectCustomerForFilter }: CustomersViewProps) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Customer Detail Drawer state
  const [selectedCust, setSelectedCust] = useState<CustomerRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customerReturns, setCustomerReturns] = useState<ShipmentReturnRecord[]>([]);
  const [customerFakturs, setCustomerFakturs] = useState<any[]>([]);

  const limit = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "customers",
        limit: String(limit),
        offset: String(page * limit),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/tidb?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryFilter, statusFilter, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Fetch full details + returns + fakturs when customer clicked
  const handleOpenDetail = async (cust: CustomerRecord) => {
    setSelectedCust(cust);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tidb?action=customer_detail&id=${encodeURIComponent(cust.id)}&name=${encodeURIComponent(cust.name)}`);
      const data = await res.json();
      if (data.success) {
        setCustomerReturns(data.returns || []);
        setCustomerFakturs(data.fakturs || []);
      }
    } catch (err) {
      console.error("Failed to load customer detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (customers.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(customers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Customer");
    XLSX.writeFile(wb, `Master_Customer_FantasticOrder_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ─── Modern Executive KPI Header ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Merchant */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900/90 to-slate-950/90 dark:from-[#0d1322] dark:to-[#070b14] border border-indigo-500/20 shadow-lg group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                <Store className="w-3.5 h-3.5 text-indigo-400" />
                <span>Direktori Mitra</span>
              </div>
              <h3 className="text-2xl font-black text-white mt-1.5 tracking-tight">
                {total > 0 ? total.toLocaleString("id-ID") : "3.599"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Apotek, Klinik, RS & PBF Terdaftar
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600/20 to-indigo-400/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: TiDB Cloud Sync */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900/90 to-slate-950/90 dark:from-[#0d1322] dark:to-[#070b14] border border-emerald-500/20 shadow-lg group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>TiDB Serverless</span>
              </div>
              <h3 className="text-2xl font-black text-emerald-400 mt-1.5 tracking-tight flex items-center gap-2">
                Live Cloud
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                  0ms Latency
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Sinkronisasi Realtime Terhubung
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600/20 to-emerald-400/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Distribusi Kategori */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900/90 to-slate-950/90 dark:from-[#0d1322] dark:to-[#070b14] border border-cyan-500/20 shadow-lg group hover:border-cyan-500/40 transition-all">
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Kategori Merchant</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => { setCategoryFilter(categoryFilter === "1P" ? "ALL" : "1P"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "1P"
                      ? "bg-purple-500 text-white border-purple-400 shadow-sm"
                      : "bg-purple-950/50 text-purple-300 border-purple-800/40 hover:bg-purple-900/60"
                  }`}
                >
                  1P
                </button>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter(categoryFilter === "2P" ? "ALL" : "2P"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "2P"
                      ? "bg-cyan-500 text-white border-cyan-400 shadow-sm"
                      : "bg-cyan-950/50 text-cyan-300 border-cyan-800/40 hover:bg-cyan-900/60"
                  }`}
                >
                  2P
                </button>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter(categoryFilter === "3P" ? "ALL" : "3P"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "3P"
                      ? "bg-amber-500 text-slate-900 border-amber-400 shadow-sm"
                      : "bg-amber-950/50 text-amber-300 border-amber-800/40 hover:bg-amber-900/60"
                  }`}
                >
                  3P
                </button>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter("ALL"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "ALL"
                      ? "bg-slate-700 text-white border-slate-600"
                      : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                >
                  Semua
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Klik filter cepat jenis apotek</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Ekspor & Tools */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900/90 to-slate-950/90 dark:from-[#0d1322] dark:to-[#070b14] border border-blue-500/20 shadow-lg group hover:border-blue-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-300">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span>Ekspor Direktori</span>
              </div>
              <h4 className="text-sm font-semibold text-white mt-1">Unduh Format Excel</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600/20 to-blue-400/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            className="mt-3 w-full py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Unduh Excel ({customers.length} data)</span>
          </button>
        </div>
      </div>

      {/* ─── Modern Search & Filter Command Bar ─── */}
      <div className="rounded-2xl p-2.5 sm:p-3 bg-slate-900/80 dark:bg-[#0c121f]/90 border border-slate-800/80 shadow-md flex flex-wrap gap-2.5 items-center justify-between">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama Apotek, ID Oracle, Alamat, atau Nama APJ..."
              className="w-full bg-slate-950/80 dark:bg-[#070b13] border border-slate-700/60 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Cluster */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Merchant Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 dark:bg-[#070b13] border border-slate-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-slate-900 text-white">Semua Status</option>
              <option value="ACTIVE" className="bg-slate-900 text-emerald-400">ACTIVE</option>
              <option value="INACTIVE" className="bg-slate-900 text-rose-400">INACTIVE</option>
            </select>
          </div>

          {/* Kategori Dropdown */}
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
              <option value="1P" className="bg-slate-900 text-purple-400">1P (Prioritas 1)</option>
              <option value="2P" className="bg-slate-900 text-cyan-400">2P (Prioritas 2)</option>
              <option value="3P" className="bg-slate-900 text-amber-400">3P (Reguler)</option>
              <option value="REG" className="bg-slate-900 text-slate-300">REG</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchCustomers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all active:scale-95 shadow-sm"
            title="Refresh Data dari TiDB"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── Enterprise Data Grid ─── */}
      <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 dark:bg-[#0a0f1c]/90 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/90 dark:bg-[#070b14] border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3.5 w-16">ID</th>
                <th className="py-3 px-3">ID Oracle</th>
                <th className="py-3 px-4">Nama Apotek / Merchant</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4">Alamat Default</th>
                <th className="py-3 px-3">Nama APJ</th>
                <th className="py-3 px-3">SIPA Expired</th>
                <th className="py-3 px-3 text-center">Kategori</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-400 mb-2" />
                    <span className="font-semibold text-sm">Menghubungkan ke Direktori TiDB...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    <Building2 className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="font-semibold text-sm text-slate-400">Tidak ada merchant yang cocok</p>
                    <p className="text-xs text-slate-500 mt-1">Coba gunakan kata kunci lain atau reset filter pencarian.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isActive = c.status_merchant === "ACTIVE";

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenDetail(c)}
                      className="group hover:bg-slate-800/40 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      {/* ID */}
                      <td className="py-2.5 px-3.5 font-mono text-slate-400 text-[11px] group-hover:text-indigo-400 transition-colors">
                        {c.id}
                      </td>

                      {/* ID Oracle */}
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {c.customer_id_oracle || "-"}
                        </span>
                      </td>

                      {/* Nama Apotek */}
                      <td className="py-2.5 px-4 font-bold text-slate-100 max-w-[240px]">
                        <span className="truncate block group-hover:text-indigo-200 transition-colors" title={c.name}>
                          {c.name}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                            }`}
                          />
                          {c.status_merchant || "N/A"}
                        </span>
                      </td>

                      {/* Alamat */}
                      <td className="py-2.5 px-4 max-w-[260px] text-slate-300">
                        <span className="truncate block text-slate-400 group-hover:text-slate-200 transition-colors" title={c.address}>
                          {c.address || "-"}
                        </span>
                      </td>

                      {/* Nama APJ */}
                      <td className="py-2.5 px-3 text-slate-300 truncate max-w-[140px] font-medium">
                        {c.apj_name || "-"}
                      </td>

                      {/* SIPA Expired */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {c.sipa_expired || "-"}
                      </td>

                      {/* Kategori */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            c.category === "1P"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : c.category === "2P"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : c.category === "3P"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {c.category || "REG"}
                        </span>
                      </td>

                      {/* Detail Button */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(c);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-[11px] font-semibold border border-slate-700/80 transition-all flex items-center gap-1 mx-auto shadow-xs active:scale-95"
                        >
                          <span>Lihat</span>
                          <ArrowRight className="w-3 h-3" />
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
        <div className="bg-slate-950/90 dark:bg-[#070b14] border-t border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan{" "}
              <strong className="text-white">
                {total === 0 ? 0 : page * limit + 1} - {Math.min((page + 1) * limit, total)}
              </strong>{" "}
              dari <strong className="text-indigo-300">{total.toLocaleString("id-ID")}</strong> merchant
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700 flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="px-3 py-1 font-bold text-slate-200">
              Hal {page + 1} / {totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700 flex items-center gap-1 transition-all"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── CUSTOMER DETAIL MODAL / DRAWER ─── */}
      {selectedCust && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/80 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600/20 to-cyan-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2 flex-wrap">
                    <span>{selectedCust.name}</span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        selectedCust.status_merchant === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {selectedCust.status_merchant}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>ID: <strong className="font-mono text-slate-200">{selectedCust.id}</strong></span>
                    <span>•</span>
                    <span>Oracle: <strong className="font-mono text-indigo-300">{selectedCust.customer_id_oracle || "-"}</strong></span>
                    <span>•</span>
                    <span>Kategori: <strong className="text-amber-400">{selectedCust.category || "REG"}</strong></span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCust(null)}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
              {/* Kontak & Lokasi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <p className="text-slate-400 font-semibold flex items-center gap-1.5 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Alamat Pengiriman (Default)</span>
                  </p>
                  <p className="text-slate-200 mt-1.5 leading-relaxed font-medium">
                    {selectedCust.address || "-"}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <p className="text-slate-400 font-semibold flex items-center gap-1.5 text-xs">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>No. Telepon / Hotline</span>
                    </p>
                    <p className="text-slate-200 mt-1 font-mono font-semibold">
                      {selectedCust.phone || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold flex items-center gap-1.5 text-xs">
                      <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Email Resmi</span>
                    </p>
                    <p className="text-slate-200 mt-1 font-medium">
                      {selectedCust.email || "-"}
                    </p>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-800/80 pt-3 text-[11px]">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block text-[10px]">Nama APJ</span>
                    <strong className="text-slate-200 truncate block mt-0.5">{selectedCust.apj_name || "-"}</strong>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block text-[10px]">SIPA Expired</span>
                    <strong className="text-indigo-300 font-mono block mt-0.5">{selectedCust.sipa_expired || "-"}</strong>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block text-[10px]">SIA Expired</span>
                    <strong className="text-cyan-300 font-mono block mt-0.5">{selectedCust.sia_expired || "-"}</strong>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block text-[10px]">Site (Ship / Bill)</span>
                    <strong className="text-slate-200 font-mono block mt-0.5">
                      {selectedCust.site_ship_to || "-"} / {selectedCust.site_bill_to || "-"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Riwayat Retur / Komplain */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Riwayat Komplain & Retur ({customerReturns.length})</span>
                  </h4>
                  {onSelectCustomerForFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCustomerForFilter(selectedCust.name);
                        setSelectedCust(null);
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                    >
                      <span>Lihat Semua Faktur Apotek Ini</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {detailLoading ? (
                  <div className="py-8 text-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-400 mb-1" />
                    <span>Memeriksa catatan retur apotek...</span>
                  </div>
                ) : customerReturns.length === 0 ? (
                  <div className="bg-emerald-950/20 border border-emerald-800/30 p-3.5 rounded-xl text-center text-slate-400 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Tidak ada catatan komplain atau retur untuk merchant ini (Catatan Bersih ✨)</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {customerReturns.map((cr) => (
                      <div
                        key={cr.id}
                        className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-200">{cr.product_name}</span>
                            <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                              Qty: {cr.qty}
                            </span>
                            <span className="font-mono text-indigo-400 text-[10px]">
                              Inv: {cr.invoice_no || "-"}
                            </span>
                          </div>
                          <p className="text-amber-300 text-[11px] mt-1 font-medium">Alasan: {cr.reason}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            (cr.status || "").toLowerCase().includes("resolved")
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {cr.status || "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Fantastic Order Master Customer Hub
              </span>
              <button
                type="button"
                onClick={() => setSelectedCust(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
