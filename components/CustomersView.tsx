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
  Pencil,
  Save,
  Check,
  Upload,
  FileText,
  Trash2,
  FolderOpen,
} from "lucide-react";
import * as XLSX from "xlsx";

/**
 * Format date values (including Excel serial numbers like 48010) into Indonesian format:
 * "DD MMMM YYYY" (tanggal bulan tahun).
 */
export function formatIndonesianDate(val: any): string {
  if (!val || val === "-" || val === "null" || val === "undefined") return "-";
  const strVal = String(val).trim();
  if (!strVal || strVal === "-") return "-";

  // Check if it's an Excel numeric date serial (e.g. 48010 -> 11 Juni 2031)
  const num = Number(strVal);
  if (!isNaN(num) && num > 20000 && num < 80000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, "0");
      const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const month = monthNames[d.getUTCMonth()];
      const year = d.getUTCFullYear();
      return `${day} ${month} ${year}`;
    }
  }

  // Check if standard date string like YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = strVal.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, "0");
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${monthNames[monthIdx]} ${year}`;
    }
  }

  // Check if standard date string like DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = strVal.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, "0");
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    const year = dmyMatch[3];
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${monthNames[monthIdx]} ${year}`;
    }
  }

  return strVal;
}

/**
 * Format date values into HTML5 <input type="date"> format: YYYY-MM-DD.
 * Converts Excel serial numbers (e.g. 47447, 48010) and standard date strings.
 */
export function parseToDateInputValue(val: any): string {
  if (!val || val === "-" || val === "null" || val === "undefined") return "";
  const strVal = String(val).trim();
  if (!strVal || strVal === "-") return "";

  // Check if it's an Excel numeric date serial (e.g. 47447 or 48010)
  const num = Number(strVal);
  if (!isNaN(num) && num > 20000 && num < 80000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) return strVal;

  // If YYYY/MM/DD
  const slashMatch = strVal.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${String(slashMatch[2]).padStart(2, "0")}-${String(slashMatch[3]).padStart(2, "0")}`;
  }

  // If DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = strVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, "0")}-${String(dmyMatch[1]).padStart(2, "0")}`;
  }

  return "";
}

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

  // Customer Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CustomerRecord> | null>(null);
  const [isSavingCust, setIsSavingCust] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "npwp_file_url" | "document_url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Ukuran berkas maksimal 15MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setEditForm((prev) => ({
        ...prev,
        [field]: dataUrl,
        ...(field === "document_url" ? { document_name: file.name } : {}),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEdit = (cust: CustomerRecord) => {
    setEditForm({
      ...cust,
      sia_expired: parseToDateInputValue(cust.sia_expired),
      sipa_expired: parseToDateInputValue(cust.sipa_expired),
    });
    setShowEditModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !editForm.id) return;
    if (!editForm.name || !editForm.name.trim()) {
      alert("Nama Customer / Apotek wajib diisi.");
      return;
    }

    setIsSavingCust(true);
    try {
      const res = await fetch("/api/tidb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_customer",
          ...editForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === editForm.id ? ({ ...c, ...editForm } as CustomerRecord) : c))
        );
        if (selectedCust?.id === editForm.id) {
          setSelectedCust((prev) => (prev ? ({ ...prev, ...editForm } as CustomerRecord) : null));
        }
        setShowEditModal(false);
        setToastMsg(`✓ Data customer "${editForm.name}" berhasil diperbarui.`);
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        alert(`Gagal menyimpan perubahan: ${data.error || "Terjadi kesalahan pada database"}`);
      }
    } catch (err: any) {
      console.error("Save customer error:", err);
      alert(`Gagal menyimpan customer: ${err.message || String(err)}`);
    } finally {
      setIsSavingCust(false);
    }
  };

  const handleImportCustomerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      if (!jsonData || jsonData.length === 0) {
        alert("File kosong atau format sheet tidak terbaca.");
        return;
      }
      const res = await fetch("/api/tidb?action=bulk_import_customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: jsonData }),
      });
      const result = await res.json();
      if (result.success) {
        setToastMsg(`✓ Berhasil mengunggah ${result.count} data customer!`);
        setTimeout(() => setToastMsg(null), 4000);
        fetchCustomers();
      } else {
        alert(`Gagal import customer: ${result.error || "Terjadi kesalahan"}`);
      }
    } catch (err: any) {
      alert(`Error membaca file: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = "";
    }
  };

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
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-indigo-500/20 shadow-sm hover:border-indigo-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                <Store className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Direktori Mitra</span>
              </div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1.5 tracking-tight">
                {total.toLocaleString("id-ID")}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Apotek, Klinik, RS & PBF Terdaftar
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: TiDB Cloud Sync */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-emerald-500/20 shadow-sm hover:border-emerald-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                <Database className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>TiDB Serverless</span>
              </div>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5 tracking-tight flex items-center gap-2">
                Live Cloud
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Terhubung Realtime
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Sinkronisasi Realtime Terhubung
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Distribusi Kategori */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-cyan-500/20 shadow-sm hover:border-cyan-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
                <Layers className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                <span>Kategori Merchant</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => { setCategoryFilter(categoryFilter === "1P" ? "ALL" : "1P"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "1P"
                      ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/40"
                  }`}
                >
                  1P
                </button>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter(categoryFilter === "2P" ? "ALL" : "2P"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "2P"
                      ? "bg-cyan-600 text-white border-cyan-500 shadow-xs"
                      : "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/40"
                  }`}
                >
                  2P
                </button>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter(categoryFilter === "3P" ? "ALL" : "3P"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "3P"
                      ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-xs"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/40"
                  }`}
                >
                  3P
                </button>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter("ALL"); setPage(0); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                    categoryFilter === "ALL"
                      ? "bg-zinc-800 text-white border-zinc-700 dark:bg-zinc-700 dark:border-zinc-600"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700"
                  }`}
                >
                  Semua
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5">Klik filter cepat jenis apotek</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-cyan-50 dark:bg-cyan-600/20 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Import & Ekspor Tools */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-blue-500/20 shadow-sm hover:border-blue-500/40 transition-all flex flex-col justify-between group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>Kelola Data Mitra</span>
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">Upload &amp; Ekspor</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
          </div>
          
          <div className="mt-3 flex items-center gap-2">
            <label className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{isImporting ? "Mengunggah..." : "Upload File"}</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportCustomerFile}
                disabled={isImporting}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={customers.length === 0}
              className="py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-700 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
              title="Unduh Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Unduh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Modern Search & Filter Command Bar ─── */}
      <div className="rounded-2xl p-2.5 sm:p-3 bg-white dark:bg-[#0c121f]/90 border border-zinc-200 dark:border-zinc-800/80 shadow-xs flex flex-wrap gap-2.5 items-center justify-between">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama Apotek, ID Oracle, Alamat, atau Nama APJ..."
              className="w-full bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-zinc-700/60 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1"
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
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          {/* Kategori Dropdown */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Kategori:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="1P">1P (Prioritas 1)</option>
              <option value="2P">2P (Prioritas 2)</option>
              <option value="3P">3P (Reguler)</option>
              <option value="REG">REG</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchCustomers}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/80 transition-all active:scale-95 shadow-xs cursor-pointer"
            title="Refresh Data dari TiDB"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          {/* Direct Link to Google Drive Master Folder */}
          <a
            href="https://drive.google.com/drive/folders/1vcadO7xGZXEdUxRLap7H76wTcQUxii1w"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Buka Folder Google Drive Foto Dokumen & NPWP Apotek"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Folder Drive Dokumen</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </a>
        </div>
      </div>

      {/* ─── Enterprise Data Grid ─── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0a0f1c]/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#070b14] border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-3.5 w-24 min-w-[85px] whitespace-nowrap">ID</th>
                <th className="py-3 px-3 w-32 min-w-[115px] whitespace-nowrap">ID Oracle</th>
                <th className="py-3 px-4 min-w-[240px]">Nama Apotek / Merchant</th>
                <th className="py-3 px-3 w-28 min-w-[100px] text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-4 min-w-[260px]">Alamat Default</th>
                <th className="py-3 px-3 min-w-[150px]">Nama APJ</th>
                <th className="py-3 px-3 w-32 min-w-[120px] whitespace-nowrap" title="Masa Berlaku SIA (Surat Izin Apotek)">SIA Expired</th>
                <th className="py-3 px-3 w-32 min-w-[120px] whitespace-nowrap" title="Masa Berlaku SIPA (Surat Izin Praktik Apoteker)">SIPA Expired</th>
                <th className="py-3 px-3 w-24 min-w-[85px] text-center whitespace-nowrap">Kategori</th>
                <th className="py-3 px-3 w-28 min-w-[105px] text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/50">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-400 mb-2" />
                    <span className="font-semibold text-sm">Menghubungkan ke Direktori TiDB...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-500">
                    <Building2 className="w-10 h-10 mx-auto text-blue-500 mb-3 opacity-60" />
                    <p className="font-bold text-base text-zinc-800 dark:text-zinc-200">
                      {total === 0 && !search ? "Data Customer Belum Ada / Masih Kosong" : "Tidak ada merchant yang cocok"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                      {total === 0 && !search
                        ? "Tabel customer telah dikosongkan. Silakan upload file Excel Data Customer baru untuk mengisi direktori."
                        : "Coba gunakan kata kunci lain atau reset filter pencarian."}
                    </p>
                    {total === 0 && !search && (
                      <label className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition">
                        <Upload className="w-4 h-4" />
                        <span>{isImporting ? "Mengunggah Data..." : "Upload File Data Customer (.xlsx)"}</span>
                        <input
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          onChange={handleImportCustomerFile}
                          disabled={isImporting}
                          className="hidden"
                        />
                      </label>
                    )}
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedCust?.id === c.id || (showEditModal && editForm?.id === c.id);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenDetail(c)}
                      className={`group transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/90 dark:bg-slate-800/70 border-l-4 border-blue-600 dark:border-indigo-500"
                          : "hover:bg-blue-50/50 dark:hover:bg-slate-800/30 border-l-4 border-transparent"
                      }`}
                    >
                      {/* ID */}
                      <td className="py-2.5 px-3.5 font-mono text-zinc-600 dark:text-slate-400 text-[11px] font-semibold whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-colors">
                        {c.id}
                      </td>

                      {/* ID Oracle */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-indigo-500/10 text-blue-700 dark:text-indigo-300 border border-blue-200 dark:border-indigo-500/20 whitespace-nowrap inline-block">
                          {c.customer_id_oracle || "-"}
                        </span>
                      </td>

                      {/* Nama Apotek */}
                      <td className="py-2.5 px-4 font-bold max-w-[280px]">
                        <span
                          className="truncate block text-zinc-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-indigo-200 transition-colors"
                          title={c.name}
                        >
                          {c.name || "-"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status_merchant === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.status_merchant === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                            }`}
                          />
                          {c.status_merchant || "-"}
                        </span>
                      </td>

                      {/* Alamat */}
                      <td className="py-2.5 px-4 max-w-[260px] text-zinc-600 dark:text-slate-300">
                        <span className="truncate block text-zinc-600 dark:text-slate-400 group-hover:text-zinc-900 dark:group-hover:text-slate-200 transition-colors" title={c.address}>
                          {c.address || "-"}
                        </span>
                      </td>

                      {/* Nama APJ */}
                      <td className="py-2.5 px-3 text-zinc-800 dark:text-slate-300 truncate max-w-[140px] font-medium" title={c.apj_name}>
                        {c.apj_name || "-"}
                      </td>

                      {/* SIA Expired */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-800 dark:text-cyan-300 whitespace-nowrap font-medium">
                        {formatIndonesianDate(c.sia_expired)}
                      </td>

                      {/* SIPA Expired */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-800 dark:text-indigo-300 whitespace-nowrap font-medium">
                        {formatIndonesianDate(c.sipa_expired)}
                      </td>

                      {/* Kategori */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            c.category === "1P"
                              ? "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40"
                              : c.category === "2P"
                              ? "bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40"
                              : c.category === "3P"
                              ? "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40"
                              : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                          }`}
                        >
                          {c.category || "REG"}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(c);
                            }}
                            className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-indigo-600 text-zinc-700 hover:text-black dark:text-slate-200 dark:hover:text-white text-[11px] font-semibold border border-zinc-200 dark:border-slate-700 transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                            title="Lihat Detail Customer"
                          >
                            <span>Lihat</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(c);
                            }}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer"
                            title="Edit Data Customer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination Footer (High Contrast Light Mode) ─── */}
        <div className="bg-zinc-50 dark:bg-[#070b14] border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan{" "}
              <strong className="text-zinc-900 dark:text-white font-bold">
                {total === 0 ? 0 : page * limit + 1} - {Math.min((page + 1) * limit, total)}
              </strong>{" "}
              dari <strong className="text-blue-700 dark:text-indigo-300 font-bold">{total.toLocaleString("id-ID")}</strong> merchant
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 disabled:opacity-30 border border-zinc-200 dark:border-slate-700 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="px-3 py-1 font-bold text-zinc-800 dark:text-slate-200">
              Hal {page + 1} / {totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 disabled:opacity-30 border border-zinc-200 dark:border-slate-700 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── CUSTOMER DETAIL MODAL / DRAWER (100% COMPLETE DATA) ─── */}
      {selectedCust && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden text-zinc-900 dark:text-zinc-100">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600/20 to-cyan-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
                    <span className="truncate">{selectedCust.name}</span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        selectedCust.status_merchant === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {selectedCust.status_merchant || "N/A"}
                    </span>
                  </h3>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2 flex-wrap font-medium">
                    <span>ID: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{selectedCust.id}</strong></span>
                    <span>•</span>
                    <span>Oracle: <strong className="font-mono text-indigo-600 dark:text-indigo-300">{selectedCust.customer_id_oracle || "-"}</strong></span>
                    <span>•</span>
                    <span>Kategori: <strong className="text-amber-600 dark:text-amber-400 font-bold">{selectedCust.category || "REG"}</strong></span>
                    {selectedCust.is_active_2p && (
                      <>
                        <span>•</span>
                        <span className="text-[10px] px-2 py-0.2 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 font-bold">
                          {selectedCust.is_active_2p}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEdit(selectedCust);
                    setSelectedCust(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Edit Data Customer (Buka Laci Kanan)"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCust(null)}
                  className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body (Complete Data Canvas) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">

              {/* SECTION 1: LEGALITAS APOTEK & APJ (SIA & SIPA) */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="font-black text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Legalitas Izin Apotek &amp; APJ (SIA / SIPA)</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Format: Tanggal Bulan Tahun</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Apoteker PJ (APJ)</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 block mt-1 text-xs">{selectedCust.apj_name || "-"}</strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Nomor SIPA</span>
                    <strong className="text-zinc-900 dark:text-indigo-300 font-mono block mt-1 text-xs truncate" title={selectedCust.sipa_number || "-"}>
                      {selectedCust.sipa_number || "-"}
                    </strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 shadow-2xs">
                    <span className="text-indigo-600 dark:text-indigo-400 block text-[10px] uppercase font-bold">Masa Berlaku SIPA (Expired)</span>
                    <strong className="text-indigo-700 dark:text-indigo-300 font-mono block mt-1 text-xs font-black">
                      {formatIndonesianDate(selectedCust.sipa_expired)}
                    </strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Kode SIPNAP</span>
                    <strong className="text-zinc-900 dark:text-zinc-200 font-mono block mt-1 text-xs">{selectedCust.sipnap_code || "-"}</strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Nomor SIA (Izin Apotek)</span>
                    <strong className="text-zinc-900 dark:text-cyan-300 font-mono block mt-1 text-xs truncate" title={selectedCust.sia_number || "-"}>
                      {selectedCust.sia_number || "-"}
                    </strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-cyan-200 dark:border-cyan-500/30 shadow-2xs">
                    <span className="text-cyan-600 dark:text-cyan-400 block text-[10px] uppercase font-bold">Masa Berlaku SIA (Expired)</span>
                    <strong className="text-cyan-700 dark:text-cyan-300 font-mono block mt-1 text-xs font-black">
                      {formatIndonesianDate(selectedCust.sia_expired)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* SECTION 2: LOKASI PENGIRIMAN & KONTAK LOGISTIK */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="font-black text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>Lokasi Pengiriman &amp; Distribusi Logistik</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{selectedCust.branch || "-"} ({selectedCust.zone || "-"})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold mb-1">
                      Alamat Pengiriman (Default Delivery)
                    </span>
                    <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      {selectedCust.address || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-500" />
                        No. Telepon / HP
                      </span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs">{selectedCust.phone || "-"}</strong>
                    </div>

                    <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                        <Mail className="w-3 h-3 text-cyan-500" />
                        Email Resmi
                      </span>
                      <strong className="text-zinc-900 dark:text-zinc-100 block mt-1 text-xs truncate" title={selectedCust.email || "-"}>
                        {selectedCust.email || "-"}
                      </strong>
                    </div>

                    <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Site Ship To</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs">{selectedCust.site_ship_to || "-"}</strong>
                    </div>

                    <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Site Bill To</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs">{selectedCust.site_bill_to || "-"}</strong>
                    </div>
                  </div>
                </div>

                {selectedCust.halodoc_pharma && (
                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 font-bold text-[10px] uppercase">Halodoc Pharma Alias</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedCust.halodoc_pharma}</span>
                  </div>
                )}
              </div>

              {/* SECTION 3: DATA PEMILIK (PSA), KEUANGAN & AKUNTANSI */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="font-black text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>Data Pemilik (PSA), Keuangan &amp; Akuntansi COA</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Tax, Finance &amp; Identity</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Nama Pemilik / PSA</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 block mt-1 text-xs truncate" title={selectedCust.owner_name || "-"}>
                      {selectedCust.owner_name || "-"}
                    </strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">NPWP (VAT ID)</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs">{selectedCust.vat_id || "-"}</strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">NIK Pemilik</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs">{selectedCust.nik || "-"}</strong>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Status Riwayat Order</span>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedCust.order_status?.includes("SUDAH")
                          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {selectedCust.order_status || "BELUM PERNAH ORDER"}
                    </span>
                  </div>

                  {/* COA REC & COA REV */}
                  <div className="col-span-1 sm:col-span-2 bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-blue-200/80 dark:border-blue-900/50">
                    <span className="text-blue-600 dark:text-blue-400 block text-[10px] uppercase font-bold">COA Piutang (COA - REC)</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs select-all">
                      {selectedCust.coa_rec || "-"}
                    </strong>
                  </div>

                  <div className="col-span-1 sm:col-span-2 bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-900/50">
                    <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-bold">COA Pendapatan (COA - REV)</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs select-all">
                      {selectedCust.coa_rev || "-"}
                    </strong>
                  </div>

                  <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Waktu Terdaftar</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono block mt-1 text-xs">
                      {selectedCust.created_at ? formatIndonesianDate(selectedCust.created_at) : "-"}
                    </strong>
                  </div>

                  {selectedCust.owner_address && (
                    <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold mb-0.5">Alamat Pemilik (PSA)</span>
                      <p className="text-zinc-800 dark:text-zinc-200 text-xs font-medium">{selectedCust.owner_address}</p>
                    </div>
                  )}

                  {/* DOKUMEN & BERKAS NPWP / LEGALITAS */}
                  <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-white dark:bg-zinc-900/80 p-3 rounded-lg border border-amber-200/80 dark:border-amber-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-amber-700 dark:text-amber-400 block text-[10px] uppercase font-bold">
                        Dokumen NPWP &amp; Berkas Legalitas
                      </span>
                      <a
                        href="https://drive.google.com/drive/folders/1vcadO7xGZXEdUxRLap7H76wTcQUxii1w"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline"
                        title="Buka Folder Master Dokumen Apotek MBI"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Folder Master Dokumen</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedCust.npwp_drive_url && (
                        <a
                          href={selectedCust.npwp_drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition shadow-2xs"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span>Buka Drive NPWP / Dokumen</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      )}

                      <a
                        href={`https://drive.google.com/drive/search?q=${encodeURIComponent(selectedCust.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold transition shadow-2xs"
                        title="Cari Dokumen Apotek Ini di Google Drive"
                      >
                        <Search className="w-3.5 h-3.5 text-amber-600" />
                        <span>Cari di GDrive: {selectedCust.name}</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>

                      {selectedCust.document_url && (
                        <a
                          href={selectedCust.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-600" />
                          <span>{selectedCust.document_name || "Dokumen Legalitas Khusus"}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      )}

                      {selectedCust.npwp_file_url && (
                        <a
                          href={selectedCust.npwp_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Lihat Berkas NPWP</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: RIWAYAT RETUR / KOMPLAIN */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-900 dark:text-white">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Riwayat Komplain &amp; Retur ({customerReturns.length})</span>
                  </h4>
                  {onSelectCustomerForFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCustomerForFilter(selectedCust.name);
                        setSelectedCust(null);
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Semua Faktur Apotek Ini</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {detailLoading ? (
                  <div className="py-8 text-center text-zinc-500 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-1" />
                    <span>Memeriksa catatan retur apotek...</span>
                  </div>
                ) : customerReturns.length === 0 ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 p-3.5 rounded-xl text-center text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Tidak ada catatan komplain atau retur untuk merchant ini (Catatan Bersih ✨)</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {customerReturns.map((cr) => (
                      <div
                        key={cr.id}
                        className="bg-white dark:bg-zinc-950/80 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{cr.product_name}</span>
                            <span className="text-zinc-600 dark:text-zinc-400 text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                              Qty: {cr.qty}
                            </span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 text-[10px]">
                              Inv: {cr.invoice_no || "-"}
                            </span>
                          </div>
                          <p className="text-amber-600 dark:text-amber-300 text-[11px] mt-1 font-medium">Alasan: {cr.reason}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            (cr.status || "").toLowerCase().includes("resolved")
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
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
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-medium">
                Fantastic Order Master Customer Hub • Data Terverifikasi
              </span>
              <button
                type="button"
                onClick={() => setSelectedCust(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ─── SLIDE-OVER RIGHT DRAWER: EDIT CUSTOMER ─── */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          {/* Backdrop click to close */}
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => setShowEditModal(false)}
            title="Klik area luar untuk menutup"
          />

          {/* Drawer Container (Slides from Right) */}
          <div className="relative w-full max-w-lg md:max-w-xl bg-white dark:bg-[#0c121f] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300 text-zinc-900 dark:text-zinc-100">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                    Edit Data Mitra &amp; Legalitas
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                    ID: {editForm.id} • Oracle: {editForm.customer_id_oracle || "-"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer shrink-0"
                title="Tutup Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Form Body */}
            <form onSubmit={handleSaveCustomer} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {/* Section 1: Informasi Pokok */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                    1. Informasi Pokok Mitra
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Nama Apotek / Merchant <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Customer ID Oracle
                      </label>
                      <input
                        type="text"
                        value={editForm.customer_id_oracle || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, customer_id_oracle: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Status Merchant
                      </label>
                      <select
                        value={editForm.status_merchant || "ACTIVE"}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, status_merchant: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold focus:outline-none"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Kategori Prioritas
                      </label>
                      <select
                        value={editForm.category || "REG"}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold focus:outline-none"
                      >
                        <option value="1P">1P (Prioritas 1)</option>
                        <option value="2P">2P (Prioritas 2)</option>
                        <option value="3P">3P (Reguler)</option>
                        <option value="REG">REG</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Cabang / Zone
                      </label>
                      <input
                        type="text"
                        value={editForm.branch || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, branch: e.target.value }))}
                        placeholder="Contoh: JAKARTA"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Legalitas & Izin */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-cyan-700 dark:text-cyan-400 block">
                      2. Legalitas Izin (SIA &amp; SIPA)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Nama Apoteker PJ (APJ)
                      </label>
                      <input
                        type="text"
                        value={editForm.apj_name || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, apj_name: e.target.value }))}
                        placeholder="Nama Apoteker Penanggung Jawab"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Nomor SIPA
                      </label>
                      <input
                        type="text"
                        value={editForm.sipa_number || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sipa_number: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Masa Berlaku SIPA (Expired)
                      </label>
                      <input
                        type="date"
                        value={editForm.sipa_expired || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sipa_expired: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Nomor SIA
                      </label>
                      <input
                        type="text"
                        value={editForm.sia_number || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sia_number: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Masa Berlaku SIA (Expired)
                      </label>
                      <input
                        type="date"
                        value={editForm.sia_expired || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sia_expired: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Kode SIPNAP
                      </label>
                      <input
                        type="text"
                        value={editForm.sipnap_code || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sipnap_code: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Kontak & Alamat Pengiriman */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    3. Kontak, Pemilik &amp; Alamat Pengiriman
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        No. Telepon / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="08xxxxxxxxxx"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Email Resmi
                      </label>
                      <input
                        type="email"
                        value={editForm.email || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="apotek@example.com"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Nama Pemilik (PSA)
                      </label>
                      <input
                        type="text"
                        value={editForm.owner_name || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, owner_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        NPWP (VAT ID)
                      </label>
                      <input
                        type="text"
                        value={editForm.vat_id || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, vat_id: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Alamat Lengkap Pengiriman
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.address || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Akuntansi & Keuangan COA */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                    4. Akuntansi &amp; Keuangan (COA Oracle)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        COA - REC (Piutang)
                      </label>
                      <input
                        type="text"
                        value={editForm.coa_rec || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, coa_rec: e.target.value }))}
                        placeholder="05.1121102.xxx..."
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        COA - REV (Pendapatan)
                      </label>
                      <input
                        type="text"
                        value={editForm.coa_rev || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, coa_rev: e.target.value }))}
                        placeholder="05.4111102.xxx..."
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Status Riwayat Order
                      </label>
                      <select
                        value={editForm.order_status || "BELUM PERNAH ORDER"}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, order_status: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs font-semibold focus:outline-none"
                      >
                        <option value="SUDAH PERNAH ORDER">SUDAH PERNAH ORDER</option>
                        <option value="BELUM PERNAH ORDER">BELUM PERNAH ORDER</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 5: Data NPWP & Dokumen Legalitas */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                    5. Berkas NPWP, Google Drive &amp; Dokumen Legalitas
                  </span>
                  <div className="space-y-3">
                    {/* Link Google Drive NPWP */}
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Link Folder / File Google Drive Data NPWP
                      </label>
                      <input
                        type="url"
                        value={editForm.npwp_drive_url || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, npwp_drive_url: e.target.value }))}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">Tautan Google Drive tempat berkas NPWP apotek ini disimpan.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Upload File NPWP Apotek */}
                      <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                          Upload File NPWP (PDF / Foto)
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileUpload(e, "npwp_file_url")}
                          className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                        />
                        {editForm.npwp_file_url && (
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px]">
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Berkas NPWP terlampir
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditForm((prev) => ({ ...prev, npwp_file_url: "" }))}
                              className="text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Upload Dokumen Legalitas */}
                      <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                          Upload Dokumen Legalitas / SIA / SIPA
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileUpload(e, "document_url")}
                          className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-800 hover:file:bg-purple-200 cursor-pointer"
                        />
                        {editForm.document_url && (
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px]">
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Dokumen legalitas terlampir
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditForm((prev) => ({ ...prev, document_url: "", document_name: "" }))}
                              className="text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Drawer Footer Actions */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSavingCust}
                  className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCust}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingCust ? "Menyimpan Data..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
