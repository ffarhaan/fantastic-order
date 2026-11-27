"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CustomerRecord } from "@/lib/types";
import { broadcastRealtimeSignal, subscribeToRealtimeSignal, isSuperAdminUser } from "@/lib/firestoreService";
import { AppUser } from "@/components/LoginModal";
import {
  Building2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Store,
  Pencil,
  Save,
  Check,
  Upload,
  FileSpreadsheet,
  Columns,
  Pin,
  ShieldCheck,
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
 */
export function parseToDateInputValue(val: any): string {
  if (!val || val === "-" || val === "null" || val === "undefined") return "";
  const strVal = String(val).trim();
  if (!strVal || strVal === "-") return "";

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

  if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) return strVal;

  const slashMatch = strVal.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${String(slashMatch[2]).padStart(2, "0")}-${String(slashMatch[3]).padStart(2, "0")}`;
  }

  const dmyMatch = strVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, "0")}-${String(dmyMatch[1]).padStart(2, "0")}`;
  }

  return "";
}

export function getDaysUntilExpired(val: any): number | null {
  if (!val || val === "-" || val === "null" || val === "undefined") return null;
  const s = String(val).trim();
  if (!s || s === "-") return null;

  let d: Date | null = null;
  const num = Number(s);
  if (!isNaN(num) && num > 20000 && num < 80000) {
    d = new Date(Math.round((num - 25569) * 86400 * 1000));
  } else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
    d = new Date(s);
  } else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s)) {
    const parts = s.split(/[-/]/);
    d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  } else {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) d = parsed;
  }

  if (!d || isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// 10 Kolom Resmi Master Customer
export const AUTHORIZED_COLUMNS = [
  { id: "id", label: "ID", locked: true },
  { id: "oracle", label: "ID Customer" },
  { id: "name", label: "Nama Apotek" },
  { id: "status", label: "Status Merchant" },
  { id: "address", label: "Default Billing Address" },
  { id: "sia_number", label: "NO SIA" },
  { id: "sipa_number", label: "NO SIPA" },
  { id: "sipa", label: "Masa Berlaku SIPA" },
  { id: "sia", label: "Masa Berlaku SIA" },
  { id: "order_status", label: "Status Riwayat Order" },
];

interface CustomersViewProps {
  onSelectCustomerForFilter?: (name: string) => void;
  currentUser?: AppUser | null;
  initialWarehouse?: "ALL" | "MBI" | "MAI";
}

export default function CustomersView({ onSelectCustomerForFilter, currentUser, initialWarehouse }: CustomersViewProps) {
  const isSuper = isSuperAdminUser(currentUser?.name) || isSuperAdminUser(currentUser?.email);
  const canEditCustomers = isSuper || Boolean(currentUser?.permissions?.can_edit_customers);

  const [selectedWarehouse, setSelectedWarehouse] = useState<"ALL" | "MBI" | "MAI">(initialWarehouse || "ALL");
  const [warehouseCounts, setWarehouseCounts] = useState<{ MBI: number; MAI: number }>({ MBI: 3613, MAI: 4531 });

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [licenseFilter, setLicenseFilter] = useState<"ALL" | "EXPIRING" | "EXPIRED">("ALL");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Customer Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CustomerRecord> | null>(null);
  const [isSavingCust, setIsSavingCust] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Freeze & Column Visibility States
  const [freezeColLevel, setFreezeColLevel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cust_freeze_level_v2") || "1";
    }
    return "1";
  });

  const [isMobileCust, setIsMobileCust] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileCust(typeof window !== "undefined" && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const effectiveFreezeLevel = isMobileCust ? "1" : freezeColLevel;
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cust_hidden_cols_v2");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [showColMenu, setShowColMenu] = useState(false);

  const handleFreezeChange = (level: string) => {
    setFreezeColLevel(level);
    if (typeof window !== "undefined") {
      localStorage.setItem("cust_freeze_level_v2", level);
    }
  };

  const handleToggleCol = (colId: string) => {
    setHiddenCols((prev) => {
      const next = prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId];
      if (typeof window !== "undefined") {
        localStorage.setItem("cust_hidden_cols_v2", JSON.stringify(next));
      }
      return next;
    });
  };

  const isColVisible = (colId: string) => !hiddenCols.includes(colId);

  const handleOpenEdit = (cust: CustomerRecord) => {
    setEditForm({
      id: cust.id,
      name: cust.name,
      customer_id_oracle: cust.customer_id_oracle,
      status_merchant: cust.status_merchant || "ACTIVE",
      address: cust.address,
      sia_number: cust.sia_number,
      sipa_number: cust.sipa_number,
      sipa_expired: parseToDateInputValue(cust.sipa_expired),
      sia_expired: parseToDateInputValue(cust.sia_expired),
      order_status: cust.order_status || "BELUM PERNAH ORDER",
    });
    setShowEditModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCustomers) {
      alert("Akses Ditolak: Akun Anda tidak memiliki hak akses mengubah Master Pelanggan.");
      return;
    }
    if (!editForm || !editForm.id) return;
    if (!editForm.name || !editForm.name.trim()) {
      alert("Nama Apotek / Merchant wajib diisi.");
      return;
    }

    setIsSavingCust(true);
    try {
      const res = await fetch("/api/tidb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_customer",
          id: editForm.id,
          name: editForm.name,
          customer_id_oracle: editForm.customer_id_oracle,
          status_merchant: editForm.status_merchant,
          address: editForm.address,
          sia_number: editForm.sia_number,
          sipa_number: editForm.sipa_number,
          sipa_expired: editForm.sipa_expired,
          sia_expired: editForm.sia_expired,
          order_status: editForm.order_status,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === editForm.id ? ({ ...c, ...editForm } as CustomerRecord) : c))
        );
        setShowEditModal(false);
        setToastMsg(`✓ Data apotek "${editForm.name}" berhasil diperbarui.`);
        setTimeout(() => setToastMsg(null), 3500);
        broadcastRealtimeSignal("customers");
      } else {
        alert(`Gagal menyimpan data: ${data.error || "Terjadi kesalahan"}`);
      }
    } catch (err: any) {
      alert(`Error menyimpan data: ${err.message || String(err)}`);
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
        broadcastRealtimeSignal("customers");
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

  const fetchCustomers = useCallback(async (forceFresh = false, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "customers",
        warehouse: selectedWarehouse,
        limit: String(limit),
        offset: String(page * limit),
      });
      if (forceFresh) {
        params.set("fresh", "true");
        params.set("_t", String(Date.now()));
      }
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(
        `/api/tidb?${params.toString()}`,
        forceFresh
          ? {
              cache: "no-store",
              headers: { "Cache-Control": "no-cache" },
            }
          : undefined
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        let list = data.data;
        if (orderStatusFilter !== "ALL") {
          list = list.filter((c: CustomerRecord) => (c.order_status || "BELUM PERNAH ORDER") === orderStatusFilter);
        }
        setCustomers(list);
        setTotal(data.total || 0);
        if (data.warehouseCounts) {
          setWarehouseCounts(data.warehouseCounts);
        }
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedWarehouse, debouncedSearch, statusFilter, orderStatusFilter, page]);

  const fetchCustomersRef = useRef(fetchCustomers);
  useEffect(() => {
    fetchCustomersRef.current = fetchCustomers;
  }, [fetchCustomers]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    const unsubRealtime = subscribeToRealtimeSignal("customers", () => {
      fetchCustomersRef.current(true, true);
    });

    const onFocus = () => {
      fetchCustomersRef.current(true, true);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      unsubRealtime();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Export Excel: 100% Sesuai Regulasi ISDP & UU PDP (Hanya 8 Data Resmi, Terpisah per PBF)
  const handleExportExcel = async () => {
    try {
      const res = await fetch(`/api/tidb?action=get_all_customers_for_sheet&warehouse=${selectedWarehouse}`);
      const json = await res.json();
      const rawList = json.success && Array.isArray(json.data) ? json.data : customers;

      const exportData = rawList.map((c: any) => ({
        "ID": c.id || "-",
        "Customer ID Oracle": c.customer_id_oracle || "-",
        "Nama Apotek / Merchant": c.name || "-",
        "Status Merchant": c.status_merchant || "-",
        "Nama Apoteker PJ (APJ)": c.apj_name || "-",
        "Masa Berlaku SIPA (Expired)": formatIndonesianDate(c.sipa_expired),
        "Masa Berlaku SIA (Expired)": formatIndonesianDate(c.sia_expired),
        "Status Riwayat Order": c.order_status || "BELUM PERNAH ORDER",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Customer_${selectedWarehouse}`);
      XLSX.writeFile(wb, `Data_Customer_PBF_${selectedWarehouse}_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const displayedCustomers = useMemo(() => {
    if (licenseFilter === "EXPIRING") {
      return customers.filter((c) => {
        const sipaDays = getDaysUntilExpired(c.sipa_expired);
        const siaDays = getDaysUntilExpired(c.sia_expired);
        const sipaExp = sipaDays !== null && sipaDays >= 0 && sipaDays <= 90;
        const siaExp = siaDays !== null && siaDays >= 0 && siaDays <= 90;
        return sipaExp || siaExp;
      });
    }
    if (licenseFilter === "EXPIRED") {
      return customers.filter((c) => {
        const sipaDays = getDaysUntilExpired(c.sipa_expired);
        const siaDays = getDaysUntilExpired(c.sia_expired);
        return (sipaDays !== null && sipaDays < 0) || (siaDays !== null && siaDays < 0);
      });
    }
    return customers;
  }, [customers, licenseFilter]);

  const { expiringCount, expiredCount, safeCount } = useMemo(() => {
    let exp = 0;
    let expired = 0;
    let safe = 0;
    for (const c of customers) {
      const sipaDays = getDaysUntilExpired(c.sipa_expired);
      const siaDays = getDaysUntilExpired(c.sia_expired);
      const isExp = (sipaDays !== null && sipaDays < 0) || (siaDays !== null && siaDays < 0);
      const isWarn = (sipaDays !== null && sipaDays >= 0 && sipaDays <= 90) || (siaDays !== null && siaDays >= 0 && siaDays <= 90);
      if (isExp) expired++;
      else if (isWarn) exp++;
      else safe++;
    }
    return { expiringCount: exp, expiredCount: expired, safeCount: safe };
  }, [customers]);

  return (
    <div className="space-y-4">
      {/* ─── PBF Switcher (Semua Gudang MBI+MAI vs MBI vs MAI) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-[#0c0d14] border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedWarehouse !== "ALL") {
                setSelectedWarehouse("ALL");
                setPage(0);
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedWarehouse === "ALL"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>🏢 Semua Gudang (Gabungan MBI + MAI)</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              selectedWarehouse === "ALL" ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}>
              {((warehouseCounts.MBI || 0) + (warehouseCounts.MAI || 0)).toLocaleString("id-ID")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedWarehouse !== "MBI") {
                setSelectedWarehouse("MBI");
                setPage(0);
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedWarehouse === "MBI"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>🔵 MBI Saja</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              selectedWarehouse === "MBI" ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}>
              {(warehouseCounts.MBI || 0).toLocaleString("id-ID")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedWarehouse !== "MAI") {
                setSelectedWarehouse("MAI");
                setPage(0);
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedWarehouse === "MAI"
                ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>🔴 MAI Saja</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              selectedWarehouse === "MAI" ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}>
              {(warehouseCounts.MAI || 0).toLocaleString("id-ID")}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{selectedWarehouse === "ALL" ? "Gabungan MBI + MAI" : `PBF ${selectedWarehouse}`} • 10 Kolom Resmi Master Customer</span>
        </div>
      </div>

      {/* ─── 3 KPI WARNING CARDS: SIA & SIPA EXPIRED DETECTOR (THRESHOLD: 3 BULAN / 90 HARI) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Mau Habis (≤ 3 Bulan / 90 Hari) */}
        <button
          type="button"
          onClick={() => {
            setLicenseFilter(licenseFilter === "EXPIRING" ? "ALL" : "EXPIRING");
            setPage(0);
          }}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
            licenseFilter === "EXPIRING"
              ? "bg-amber-500/20 border-amber-500 ring-2 ring-amber-400/50"
              : "bg-amber-500/10 border-amber-500/30 hover:border-amber-400/60 dark:bg-amber-950/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <span>⚠️ SIA / SIPA Mau Habis</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
              ≤ 3 Bulan (90 Hari)
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {expiringCount}{" "}
              <span className="text-xs font-semibold text-zinc-500 font-sans">Apotek di Halaman Ini</span>
            </div>
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline">
              {licenseFilter === "EXPIRING" ? "● Aktif Filter" : "Klik untuk Filter ↗"}
            </span>
          </div>
        </button>

        {/* Card 2: Sudah Expired */}
        <button
          type="button"
          onClick={() => {
            setLicenseFilter(licenseFilter === "EXPIRED" ? "ALL" : "EXPIRED");
            setPage(0);
          }}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
            licenseFilter === "EXPIRED"
              ? "bg-rose-500/20 border-rose-500 ring-2 ring-rose-400/50"
              : "bg-rose-500/10 border-rose-500/30 hover:border-rose-400/60 dark:bg-rose-950/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <span>🚫 Izin Sudah Expired</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/30">
              Lewat Tanggal
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {expiredCount}{" "}
              <span className="text-xs font-semibold text-zinc-500 font-sans">Apotek di Halaman Ini</span>
            </div>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:underline">
              {licenseFilter === "EXPIRED" ? "● Aktif Filter" : "Klik untuk Filter ↗"}
            </span>
          </div>
        </button>

        {/* Card 3: Izin Aktif Aman */}
        <button
          type="button"
          onClick={() => {
            setLicenseFilter("ALL");
            setPage(0);
          }}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
            licenseFilter === "ALL"
              ? "bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-400/40"
              : "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400/60 dark:bg-emerald-950/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <span>✓ Izin Aktif Aman</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30">
              Masa Berlaku Aman
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {safeCount}{" "}
              <span className="text-xs font-semibold text-zinc-500 font-sans">Apotek di Halaman Ini</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              {licenseFilter === "ALL" ? "● Menampilkan Semua" : "Reset Filter ↺"}
            </span>
          </div>
        </button>
      </div>
      {/* ─── Header Info & Upload Tools ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: Total Merchant */}
        <div className="relative overflow-hidden rounded-xl p-3 sm:p-3.5 bg-white dark:bg-[#0c0d14] border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Store className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>Direktori Master Customer PBF {selectedWarehouse} (ISDP Compliant)</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1 tracking-tight">
                {total.toLocaleString("id-ID")}
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500 inline-block" />
                <span>8 Atribut Resmi Terverifikasi</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 2: Kelola Data (Upload & Unduh Excel) */}
        <div className="relative overflow-hidden rounded-xl p-3 sm:p-3.5 bg-white dark:bg-[#0c0d14] border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>Kelola Data Mitra</span>
              </div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-white mt-0.5">Upload &amp; Ekspor Data</h4>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer" title="Upload Excel Master Customer">
                <Upload className="w-3.5 h-3.5" />
                <span>{isImporting ? "Mengunggah..." : "Upload Excel"}</span>
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
                className="py-1 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-zinc-200 dark:border-zinc-700 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
                title="Unduh Excel Format ISDP"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor</span>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Data pribadi terlindungi penuh sesuai UU PDP &amp; standar ISDP.
          </p>
        </div>
      </div>

      {/* ─── Search & Filter Command Bar ─── */}
      <div className="rounded-2xl p-2.5 sm:p-3 bg-white dark:bg-[#0c121f]/90 border border-zinc-200 dark:border-zinc-800/80 shadow-xs flex flex-wrap gap-2.5 items-center justify-between">
        {/* Search Input */}
        <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama Apotek, ID Oracle, atau Nama APJ..."
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

          {/* Status Riwayat Order Dropdown */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Order:</span>
            <select
              value={orderStatusFilter}
              onChange={(e) => {
                setOrderStatusFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Semua Riwayat</option>
              <option value="SUDAH PERNAH ORDER">SUDAH PERNAH ORDER</option>
              <option value="BELUM PERNAH ORDER">BELUM PERNAH ORDER</option>
            </select>
          </div>

          {/* Spreadsheet Freeze Selector */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-2.5 py-1">
            <Pin className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Freeze:</span>
            <select
              value={freezeColLevel}
              onChange={(e) => handleFreezeChange(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer pr-1"
              title="Kunci kolom di sisi kiri"
            >
              <option value="none">Bebas</option>
              <option value="1">1. ID</option>
              <option value="2">2. ID + Oracle</option>
              <option value="3">3. ID + Oracle + Nama</option>
            </select>
          </div>

          {/* Column Visibility Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColMenu((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showColMenu || hiddenCols.length > 0
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                  : "bg-zinc-50 dark:bg-[#070b13] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-100"
              }`}
              title="Atur kolom yang ingin ditampilkan"
            >
              <Columns className="w-3.5 h-3.5 text-blue-500" />
              <span>Kolom {hiddenCols.length > 0 ? `(${AUTHORIZED_COLUMNS.length - hiddenCols.length}/${AUTHORIZED_COLUMNS.length})` : ""}</span>
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-white dark:bg-[#0c1222] border border-zinc-200 dark:border-zinc-700 shadow-xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">
                  <span>8 Kolom Resmi (ISDP)</span>
                  {hiddenCols.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setHiddenCols([]);
                        if (typeof window !== "undefined") localStorage.removeItem("cust_hidden_cols_v2");
                      }}
                      className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {AUTHORIZED_COLUMNS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={col.locked || isColVisible(col.id)}
                        disabled={col.locked}
                        onChange={() => !col.locked && handleToggleCol(col.id)}
                        className="accent-blue-600 rounded cursor-pointer w-3.5 h-3.5"
                      />
                      <span className={col.locked ? "font-bold text-blue-600 dark:text-blue-400" : ""}>
                        {col.label} {col.locked ? "(Wajib)" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchCustomers(true)}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/80 transition-colors shadow-xs cursor-pointer"
            title="Refresh Data dari TiDB"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── Enterprise Data Grid (10 Clean Master Customer Columns) ─── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0a0f1c]/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-zinc-100 dark:bg-[#070b14] border-b-2 border-zinc-300 dark:border-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider select-none">
                {/* 1. ID */}
                <th
                  className={`py-3 px-3.5 w-24 min-w-[90px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800 ${
                    effectiveFreezeLevel === "1" || effectiveFreezeLevel === "2" || effectiveFreezeLevel === "3"
                      ? "sticky left-0 z-30 bg-zinc-100 dark:bg-[#070b14] border-r border-zinc-300 shadow-xs"
                      : ""
                  }`}
                >
                  ID *
                </th>

                {/* 2. ID Customer (Oracle) */}
                {isColVisible("oracle") && (
                  <th
                    className={`py-3 px-3 w-32 min-w-[110px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800 ${
                      effectiveFreezeLevel === "2" || effectiveFreezeLevel === "3"
                        ? "sticky left-[90px] z-30 bg-zinc-100 dark:bg-[#070b14] border-r border-zinc-300 shadow-xs"
                        : ""
                    }`}
                  >
                    ID Customer
                  </th>
                )}

                {/* 3. Nama Apotek */}
                {isColVisible("name") && (
                  <th
                    className={`py-3 px-4 min-w-[240px] border-r border-zinc-200 dark:border-zinc-800 ${
                      effectiveFreezeLevel === "3"
                        ? "sticky left-[200px] z-30 bg-zinc-100 dark:bg-[#070b14] border-r-2 border-r-blue-500 shadow-md"
                        : ""
                    }`}
                  >
                    Nama Apotek
                  </th>
                )}

                {/* 4. Status Merchant */}
                {isColVisible("status") && (
                  <th className="py-3 px-3 w-28 min-w-[100px] text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                    Status Merchant
                  </th>
                )}

                {/* 5. Default Billing Address */}
                {isColVisible("address") && (
                  <th className="py-3 px-3.5 min-w-[200px] max-w-[280px] border-r border-zinc-200 dark:border-zinc-800">
                    Default Billing Address
                  </th>
                )}

                {/* 6. NO SIA */}
                {isColVisible("sia_number") && (
                  <th className="py-3 px-3 w-36 min-w-[120px] text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800" title="Nomor Izin Apotek (NO SIA)">
                    NO SIA
                  </th>
                )}

                {/* 7. NO SIPA */}
                {isColVisible("sipa_number") && (
                  <th className="py-3 px-3 w-36 min-w-[120px] text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800" title="Nomor Izin Praktik Apoteker (NO SIPA)">
                    NO SIPA
                  </th>
                )}

                {/* 8. Masa Berlaku SIPA */}
                {isColVisible("sipa") && (
                  <th className="py-3 px-3 w-36 min-w-[130px] whitespace-nowrap text-center border-r border-zinc-200 dark:border-zinc-800" title="Masa Berlaku SIPA">
                    Masa Berlaku SIPA
                  </th>
                )}

                {/* 9. Masa Berlaku SIA */}
                {isColVisible("sia") && (
                  <th className="py-3 px-3 w-36 min-w-[130px] whitespace-nowrap text-center border-r border-zinc-200 dark:border-zinc-800" title="Masa Berlaku SIA">
                    Masa Berlaku SIA
                  </th>
                )}

                {/* 10. Status Riwayat Order */}
                {isColVisible("order_status") && (
                  <th className="py-3 px-3 w-36 min-w-[130px] text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                    Status Riwayat Order
                  </th>
                )}

                {/* Aksi */}
                <th className="py-3 px-3 w-20 min-w-[80px] text-center whitespace-nowrap sticky right-0 z-20 bg-zinc-100 dark:bg-[#070b14] border-l border-zinc-200 dark:border-zinc-800 shadow-[-3px_0_6px_rgba(0,0,0,0.06)]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/50 bg-white dark:bg-[#0a0f1c]">
              {loading && displayedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-400 mb-2" />
                    <span className="font-semibold text-sm">Menghubungkan ke Direktori TiDB...</span>
                  </td>
                </tr>
              ) : displayedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-500">
                    <Building2 className="w-10 h-10 mx-auto text-blue-500 mb-3 opacity-60" />
                    <p className="font-bold text-base text-zinc-800 dark:text-zinc-200">
                      Tidak ada merchant yang cocok
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                      {licenseFilter !== "ALL"
                        ? "Tidak ada apotek pada kriteria peringatan izin terpilih."
                        : "Coba gunakan kata kunci lain atau reset filter pencarian."}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedCustomers.map((c: CustomerRecord) => {
                  const isSelected = showEditModal && editForm?.id === c.id;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenEdit(c)}
                      className={`group transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/90 dark:bg-slate-800/70 border-l-4 border-blue-600 dark:border-indigo-500"
                          : "hover:bg-blue-50/60 dark:hover:bg-slate-800/40 border-l-4 border-transparent"
                      }`}
                    >
                      {/* 1. ID */}
                      <td
                        className={`py-2.5 px-3.5 font-mono text-zinc-700 dark:text-slate-300 text-[11px] font-bold whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-colors border-r border-zinc-200 dark:border-zinc-800 ${
                          effectiveFreezeLevel === "1" || effectiveFreezeLevel === "2" || effectiveFreezeLevel === "3"
                            ? "sticky left-0 z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50 dark:group-hover:bg-slate-800 border-r border-zinc-300 shadow-xs"
                            : ""
                        }`}
                      >
                        {c.id}
                      </td>

                      {/* 2. ID Customer (Oracle) */}
                      {isColVisible("oracle") && (
                        <td
                          className={`py-2.5 px-3 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800 ${
                            effectiveFreezeLevel === "2" || effectiveFreezeLevel === "3"
                              ? "sticky left-[90px] z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50 dark:group-hover:bg-slate-800 border-r border-zinc-300 shadow-xs"
                              : ""
                          }`}
                        >
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-indigo-500/10 text-blue-700 dark:text-indigo-300 border border-blue-200 dark:border-indigo-500/20 whitespace-nowrap inline-block">
                            {c.customer_id_oracle || "-"}
                          </span>
                        </td>
                      )}

                      {/* 3. Nama Apotek */}
                      {isColVisible("name") && (
                        <td
                          className={`py-2.5 px-4 font-bold border-r border-zinc-200 dark:border-zinc-800 ${
                            effectiveFreezeLevel === "3"
                              ? "sticky left-[200px] z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50 dark:group-hover:bg-slate-800 border-r-2 border-r-blue-500 shadow-md"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-zinc-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-indigo-200 transition-colors"
                              title={c.name}
                            >
                              {c.name || "-"}
                            </span>
                            {selectedWarehouse === "ALL" && c.warehouse && (
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                                c.warehouse.toUpperCase() === "MAI"
                                  ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                              }`}>
                                {c.warehouse.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 4. Status Merchant */}
                      {isColVisible("status") && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status_merchant === "ACTIVE"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.status_merchant === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {c.status_merchant || "-"}
                          </span>
                        </td>
                      )}

                      {/* 5. Default Billing Address */}
                      {isColVisible("address") && (
                        <td className="py-2.5 px-3.5 min-w-[200px] max-w-[280px] border-r border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-slate-200 text-xs">
                          <div className="leading-snug break-words whitespace-normal line-clamp-2" title={c.address}>
                            {c.address || "-"}
                          </div>
                        </td>
                      )}

                      {/* 6. NO SIA */}
                      {isColVisible("sia_number") && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-center border-r border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                          {c.sia_number || "-"}
                        </td>
                      )}

                      {/* 7. NO SIPA */}
                      {isColVisible("sipa_number") && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-center border-r border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                          {c.sipa_number || "-"}
                        </td>
                      )}

                      {/* 8. Masa Berlaku SIPA */}
                      {isColVisible("sipa") && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-center font-medium border-r border-zinc-200 dark:border-zinc-800">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-300">
                              {formatIndonesianDate(c.sipa_expired)}
                            </span>
                            {(() => {
                              const d = getDaysUntilExpired(c.sipa_expired);
                              if (d === null) return null;
                              if (d < 0) {
                                return (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                    Expired ({Math.abs(d)} hari)
                                  </span>
                                );
                              }
                              if (d <= 90) {
                                return (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    Mau Habis ({d} hari)
                                  </span>
                                );
                              }
                              return (
                                <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Aman ({d} hari)
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                      )}

                      {/* 9. Masa Berlaku SIA */}
                      {isColVisible("sia") && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-center font-medium border-r border-zinc-200 dark:border-zinc-800">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-mono text-[11px] text-zinc-800 dark:text-blue-300">
                              {formatIndonesianDate(c.sia_expired)}
                            </span>
                            {(() => {
                              const d = getDaysUntilExpired(c.sia_expired);
                              if (d === null) return null;
                              if (d < 0) {
                                return (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                    Expired ({Math.abs(d)} hari)
                                  </span>
                                );
                              }
                              if (d <= 90) {
                                return (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    Mau Habis ({d} hari)
                                  </span>
                                );
                              }
                              return (
                                <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Aman ({d} hari)
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                      )}

                      {/* 10. Status Riwayat Order */}
                      {isColVisible("order_status") && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.order_status === "SUDAH PERNAH ORDER"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                            }`}
                          >
                            {c.order_status || "BELUM PERNAH ORDER"}
                          </span>
                        </td>
                      )}

                      {/* Aksi */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50 dark:group-hover:bg-slate-800 border-l border-zinc-200 dark:border-zinc-800 shadow-[-3px_0_6px_rgba(0,0,0,0.06)]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(c);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-slate-700 text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Edit Data Pelanggan"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
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

      {/* ─── SLIDE-OVER RIGHT DRAWER: EDIT CUSTOMER (8 ATRIBUT RESMI) ─── */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 flex justify-end">
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => setShowEditModal(false)}
            title="Klik area luar untuk menutup"
          />

          <div className="relative w-full max-w-lg bg-white dark:bg-[#0c121f] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full z-10 text-zinc-900 dark:text-zinc-100">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                    Edit Data Mitra (8 Atribut Resmi)
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
                {/* 1. Identitas Pokok Mitra */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                    1. Identitas Mitra
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
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        ID Customer
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={editForm.id || ""}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono cursor-not-allowed"
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
                    <div className="sm:col-span-2">
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
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Default Billing Address
                      </label>
                      <textarea
                        rows={2}
                        value={editForm.address || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                        placeholder="Alamat penagihan / billing..."
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Legalitas Izin Farmasi (SIPA & SIA) */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-cyan-700 dark:text-cyan-400 block">
                    2. Legalitas Izin Farmasi (NO SIA &amp; NO SIPA)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        NO SIA
                      </label>
                      <input
                        type="text"
                        value={editForm.sia_number || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sia_number: e.target.value }))}
                        placeholder="Nomor Izin Apotek (NO SIA)"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
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
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        NO SIPA
                      </label>
                      <input
                        type="text"
                        value={editForm.sipa_number || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, sipa_number: e.target.value }))}
                        placeholder="Nomor Izin Praktik Apoteker (NO SIPA)"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
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
                  </div>
                </div>

                {/* 3. Status Riwayat Order */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    3. Status Riwayat Order
                  </span>
                  <div>
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

              {/* Drawer Footer */}
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

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
