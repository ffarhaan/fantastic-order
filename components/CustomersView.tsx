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
    XLSX.writeFile(wb, `Master_Customer_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-slate-400">Total Direktori Merchant</p>
            <h3 className="text-2xl font-bold text-white mt-1">{total.toLocaleString("id-ID")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Apotek, Klinik, RS & PBF Terdaftar</p>
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-emerald-400">Database Ready</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">3.599+</h3>
            <p className="text-xs text-slate-500 mt-0.5">Sinkronisasi Realtime dengan TiDB</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-slate-400">Export & Backup</p>
            <button
              onClick={handleExportExcel}
              className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Unduh Data Excel
            </button>
          </div>
          <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
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
              placeholder="Cari Nama Apotek, ID Oracle, Alamat, atau Nama APJ..."
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
          {/* Status Merchant */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Status Merchant</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          {/* Category */}
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
            <option value="REG">REG</option>
          </select>

          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold tracking-wider uppercase">
              <tr>
                <th className="py-3 px-3 w-20">ID</th>
                <th className="py-3 px-3">ID Oracle</th>
                <th className="py-3 px-4">Nama Apotek / Merchant</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Alamat Default</th>
                <th className="py-3 px-3">Nama APJ</th>
                <th className="py-3 px-3">SIPA Expired</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-normal">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    Memuat data direktori merchant...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Tidak ada apotek/merchant yang cocok.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isActive = c.status_merchant === "ACTIVE";

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenDetail(c)}
                      className="hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="py-3 px-3 font-mono text-slate-400">{c.id}</td>
                      <td className="py-3 px-3 font-mono text-indigo-300">{c.customer_id_oracle || "-"}</td>
                      <td className="py-3 px-4 font-semibold text-slate-100 max-w-[220px]">
                        <span className="truncate block" title={c.name}>
                          {c.name}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isActive
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                              : "bg-rose-950 text-rose-300 border border-rose-800/50"
                          }`}
                        >
                          {c.status_merchant || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[260px] text-slate-300">
                        <span className="truncate block text-slate-300" title={c.address}>
                          {c.address || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 truncate max-w-[140px]">{c.apj_name || "-"}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{c.sipa_expired || "-"}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.category === "1P"
                              ? "bg-amber-950 text-amber-300 border border-amber-800/50"
                              : c.category === "2P"
                              ? "bg-blue-950 text-blue-300 border border-blue-800/50"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {c.category || "REG"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(c);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] border border-slate-700"
                        >
                          Lihat
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
            dari <span className="font-semibold text-white">{total.toLocaleString("id-ID")}</span> merchant
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

      {/* CUSTOMER DETAIL MODAL / DRAWER */}
      {selectedCust && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedCust.name}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        selectedCust.status_merchant === "ACTIVE"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-rose-950 text-rose-400 border border-rose-800"
                      }`}
                    >
                      {selectedCust.status_merchant}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ID: <span className="font-mono text-slate-300">{selectedCust.id}</span> • ID Oracle:{" "}
                    <span className="font-mono text-indigo-400">{selectedCust.customer_id_oracle || "-"}</span> • Kategori:{" "}
                    <span className="font-bold text-amber-400">{selectedCust.category || "REG"}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCust(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Kontak & Alamat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <p className="text-slate-500 font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Alamat Pengiriman
                  </p>
                  <p className="text-slate-200 mt-1 leading-relaxed">{selectedCust.address || "-"}</p>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> No. Telepon / APJ
                    </p>
                    <p className="text-slate-200 mt-0.5 font-mono">{selectedCust.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-400" /> Email
                    </p>
                    <p className="text-slate-200 mt-0.5">{selectedCust.email || "-"}</p>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-800/80 pt-3">
                  <div>
                    <span className="text-slate-500 block">Nama APJ</span>
                    <strong className="text-slate-200">{selectedCust.apj_name || "-"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SIPA Expired</span>
                    <strong className="text-slate-200 font-mono">{selectedCust.sipa_expired || "-"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SIA Expired</span>
                    <strong className="text-slate-200 font-mono">{selectedCust.sia_expired || "-"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Site (Ship / Bill)</span>
                    <strong className="text-slate-200 font-mono">
                      {selectedCust.site_ship_to || "-"} / {selectedCust.site_bill_to || "-"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Histori Retur & Komplain Apotek Ini */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Riwayat Komplain & Retur ({customerReturns.length})
                  </h4>
                  {customerReturns.length > 0 && (
                    <span className="text-[11px] text-amber-400 font-medium">
                      Pernah tercatat {customerReturns.length} kali shipment error
                    </span>
                  )}
                </div>

                {detailLoading ? (
                  <div className="py-6 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-400 mb-1" />
                    Memuat riwayat komplain...
                  </div>
                ) : customerReturns.length === 0 ? (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-center text-slate-500">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    Tidak ada catatan komplain atau retur untuk apotek ini (Bersih ✨).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customerReturns.map((cr) => (
                      <div
                        key={cr.id}
                        className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{cr.product_name}</span>
                            <span className="text-slate-500 text-[10px]">Qty: {cr.qty}</span>
                            <span className="font-mono text-indigo-400 text-[10px]">
                              Inv: {cr.invoice_no || "-"}
                            </span>
                          </div>
                          <p className="text-amber-300 text-[11px] mt-0.5">Alasan: {cr.reason}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            (cr.status || "").toLowerCase().includes("resolved")
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
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

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCust(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg"
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
