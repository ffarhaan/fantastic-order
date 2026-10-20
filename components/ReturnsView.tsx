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
    XLSX.writeFile(wb, `Shipment_Returns_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-slate-400">Total Komplain / Retur</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.totalAll.toLocaleString("id-ID")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Database TiDB Serverless</p>
          </div>
          <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-emerald-400">Selesai (Resolved)</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{stats.totalResolved.toLocaleString("id-ID")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.totalAll > 0 ? ((stats.totalResolved / stats.totalAll) * 100).toFixed(1) : 0}% Tingkat Solusi
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-amber-400">Menunggu (Pending / On Progress)</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{stats.totalPending.toLocaleString("id-ID")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Perlu tindak lanjut fisik / CN</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-indigo-400">Aksi Cepat</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
              >
                <Plus className="w-3.5 h-3.5" /> Input Baru
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export
              </button>
            </div>
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No Faktur, SO, Apotek, Produk, atau Alasan..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="px-2 py-2 text-xs text-slate-400 hover:text-white"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="Resolved">Resolved (Selesai)</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Approve">Approve</option>
          </select>

          {/* PBF Filter */}
          <select
            value={pbfFilter}
            onChange={(e) => {
              setPbfFilter(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua PBF</option>
            <option value="MAI">PBF MAI</option>
            <option value="MBI">PBF MBI</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="1P">1P</option>
            <option value="2P">2P</option>
            <option value="3P">3P</option>
          </select>

          <button
            onClick={fetchReturns}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold tracking-wider uppercase">
              <tr>
                <th className="py-3 px-3 w-16">PBF</th>
                <th className="py-3 px-4">Nama Apotek</th>
                <th className="py-3 px-3">No. Faktur</th>
                <th className="py-3 px-3">No. SO</th>
                <th className="py-3 px-4">Nama Produk & Qty</th>
                <th className="py-3 px-4">Alasan (Reason)</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Tindakan (Action)</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-normal">
              {loading && returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    Memuat data komplain & retur...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Tidak ada data retur/komplain yang cocok dengan filter.
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
                      className="hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.pbf === "MAI"
                              ? "bg-purple-900/40 text-purple-300 border border-purple-800/50"
                              : "bg-blue-900/40 text-blue-300 border border-blue-800/50"
                          }`}
                        >
                          {r.pbf || "MBI"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-100 flex items-center gap-1.5">
                        <span className="truncate max-w-[220px]" title={r.customer_name}>
                          {r.customer_name || "-"}
                        </span>
                        {r.category && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              r.category === "1P"
                                ? "bg-amber-900/50 text-amber-300"
                                : r.category === "2P"
                                ? "bg-blue-900/50 text-blue-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {r.category}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-indigo-300">
                        {r.invoice_no ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectInvoice) onSelectInvoice(r.invoice_no);
                            }}
                            className="hover:underline flex items-center gap-1"
                            title="Buka di Faktur Tracker"
                          >
                            {r.invoice_no}
                          </button>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">{r.so_no || "-"}</td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <p className="truncate font-medium text-slate-200" title={r.product_name}>
                          {r.product_name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Qty: <span className="font-bold text-slate-300">{r.qty}</span>
                          {r.batch_no && ` • Batch: ${r.batch_no}`}
                        </p>
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="truncate block text-slate-300" title={r.reason}>
                          {r.reason || "-"}
                        </span>
                        {r.root_cause && (
                          <span className="text-[10px] text-slate-500 truncate block">
                            Penyebab: {r.root_cause}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isResolved
                              ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800/50"
                              : isPending
                              ? "bg-amber-900/40 text-amber-300 border border-amber-800/50"
                              : "bg-blue-900/40 text-blue-300 border border-blue-800/50"
                          }`}
                        >
                          {isResolved ? (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          ) : (
                            <Clock className="w-2.5 h-2.5" />
                          )}
                          {r.status || "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{r.action || "-"}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReturn(r);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] border border-slate-700"
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

        {/* Pagination Footer */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
          <div>
            Menampilkan{" "}
            <span className="font-semibold text-white">
              {total === 0 ? 0 : page * limit + 1} - {Math.min((page + 1) * limit, total)}
            </span>{" "}
            dari <span className="font-semibold text-white">{total.toLocaleString("id-ID")}</span> komplain
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Hal <strong className="text-white">{page + 1}</strong> dari {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedReturn(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Rincian Komplain / Retur</h3>
                <p className="text-xs text-slate-400">ID Tiket #{selectedReturn.id} • PBF {selectedReturn.pbf}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div>
                <p className="text-slate-500 font-medium">Nama Apotek / Merchant</p>
                <p className="text-slate-200 font-semibold text-sm mt-0.5">{selectedReturn.customer_name}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Kategori Apotek</p>
                <p className="text-slate-200 font-semibold mt-0.5">{selectedReturn.category || "3P"}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">No. Faktur</p>
                <p className="text-indigo-400 font-mono font-semibold text-sm mt-0.5">
                  {selectedReturn.invoice_no || "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">No. Sales Order</p>
                <p className="text-slate-300 font-mono mt-0.5">{selectedReturn.so_no || "-"}</p>
              </div>
              <div className="col-span-2 border-t border-slate-800 pt-3">
                <p className="text-slate-500 font-medium">Nama Produk yang Dikomplain</p>
                <p className="text-slate-100 font-medium text-sm mt-0.5">{selectedReturn.product_name}</p>
                <p className="text-slate-400 mt-1">
                  Qty Retur: <strong className="text-white">{selectedReturn.qty}</strong>
                  {selectedReturn.batch_no && ` | Batch: ${selectedReturn.batch_no}`}
                  {selectedReturn.expiry_date && ` | ED: ${selectedReturn.expiry_date}`}
                </p>
              </div>
              <div className="col-span-2 border-t border-slate-800 pt-3">
                <p className="text-slate-500 font-medium">Alasan / Kendala (Reason)</p>
                <p className="text-amber-300 font-medium mt-0.5">{selectedReturn.reason || "-"}</p>
              </div>
              {selectedReturn.root_cause && (
                <div className="col-span-2">
                  <p className="text-slate-500 font-medium">Root Cause (Penyebab)</p>
                  <p className="text-slate-300 mt-0.5">{selectedReturn.root_cause}</p>
                </div>
              )}
              {selectedReturn.person && (
                <div>
                  <p className="text-slate-500 font-medium">Penanggung Jawab / PIC</p>
                  <p className="text-slate-300 mt-0.5">{selectedReturn.person}</p>
                </div>
              )}
              {selectedReturn.nota_retur_no && (
                <div>
                  <p className="text-slate-500 font-medium">No. Nota Retur</p>
                  <p className="text-slate-300 font-mono mt-0.5">{selectedReturn.nota_retur_no}</p>
                </div>
              )}
            </div>

            {/* Quick Status Updater */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Ubah Status:</span>
                <button
                  onClick={() => handleUpdateStatus(selectedReturn.id, "Resolved")}
                  disabled={isUpdating}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Selesai (Resolved)
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedReturn.id, "In Progress")}
                  disabled={isUpdating}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  In Progress
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedReturn.id, "Pending")}
                  disabled={isUpdating}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
                >
                  Pending
                </button>
              </div>

              {onSelectCustomer && (
                <button
                  onClick={() => {
                    const c = selectedReturn.customer_name;
                    setSelectedReturn(null);
                    onSelectCustomer(c);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" /> Lihat Master Apotek
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW RETURN MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Input Komplain / Retur Baru
            </h3>

            <form onSubmit={handleCreateReturn} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">PBF</label>
                  <select
                    value={newForm.pbf}
                    onChange={(e) => setNewForm({ ...newForm, pbf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">No. Sales Order (SO)</label>
                  <input
                    type="text"
                    value={newForm.so_no}
                    onChange={(e) => setNewForm({ ...newForm, so_no: e.target.value })}
                    placeholder="Contoh: 696000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">No. Batch</label>
                  <input
                    type="text"
                    value={newForm.batch_no}
                    onChange={(e) => setNewForm({ ...newForm, batch_no: e.target.value })}
                    placeholder="Opsional"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={newForm.expiry_date}
                    onChange={(e) => setNewForm({ ...newForm, expiry_date: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Alasan Komplain (Reason)</label>
                <select
                  value={newForm.reason}
                  onChange={(e) => setNewForm({ ...newForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Tindakan (Action)</label>
                  <input
                    type="text"
                    value={newForm.action}
                    onChange={(e) => setNewForm({ ...newForm, action: e.target.value })}
                    placeholder="Tukar fisik / CN Retur"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Penyebab (Root Cause)</label>
                  <input
                    type="text"
                    value={newForm.root_cause}
                    onChange={(e) => setNewForm({ ...newForm, root_cause: e.target.value })}
                    placeholder="Human error / Salah packing"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg"
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
