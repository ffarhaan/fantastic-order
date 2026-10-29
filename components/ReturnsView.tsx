"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";
import { broadcastRealtimeSignal, subscribeToRealtimeSignal, isSuperAdminUser } from "@/lib/firestoreService";
import { AppUser } from "@/components/LoginModal";
import { recordActivityLog } from "@/lib/activityLogger";
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
  Copy,
  Check,
  Share2,
  Trash2,
  Trophy,
  Medal,
  Award,
  BarChart3,
  Users,
  Camera,
  Maximize2,
  Download,
  CalendarRange,
  FileText,
  XCircle,
  Columns,
  Pin,
} from "lucide-react";
import * as XLSX from "xlsx";
import OverviewKpiView from "./returns/OverviewKpiView";
import MonthlyReportView from "./returns/MonthlyReportView";
import WeeklyReportView from "./returns/WeeklyReportView";
import AnalisisView from "./returns/AnalisisView";
import WeeklyQc2View from "./returns/WeeklyQc2View";
import OpenCasesView from "./returns/OpenCasesView";
import RejectCasesView from "./returns/RejectCasesView";
import ReturSubmissionView from "./returns/ReturSubmissionView";

export const COMPLAINT_REASONS = [
  "Fisik yang dikirim kurang",
  "Fisik yang dikirim salah",
  "Fisik yang dikirim tidak ada",
  "Fisik yang dikirim lebih",
  "Damage On Delivery",
  "Batch number dan expiry date tidak sesuai",
  "ED kurang dari 1 tahun",
  "Isi dalam kemasan box/strip tidak utuh",
  "Produk rusak (berubah warna/berbau/kapsul bocor)",
  "Produk terkontaminasi",
  "Kemasan seal rusak",
  "Lainnya",
];

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr || dateStr === "-" || dateStr === "#N/A") return "-";
  try {
    const cleanStr = String(dateStr).trim();
    if (!cleanStr) return "-";
    if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
      const [y, m, d] = cleanStr.split("T")[0].split("-");
      return `${d}/${m}/${y}`;
    }
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(cleanStr)) {
      return cleanStr;
    }
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  } catch {}
  return String(dateStr);
};

export const calculateDaysUntilToday = (reportDateStr?: string | null): number | string => {
  if (!reportDateStr || reportDateStr === "#N/A" || reportDateStr === "-") return "-";
  try {
    const rep = new Date(reportDateStr);
    if (isNaN(rep.getTime())) return "-";
    return Math.max(0, Math.floor((Date.now() - rep.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return "-";
  }
};

export const calculateDaysUntilClose = (reportDateStr?: string | null, resolvedDateStr?: string | null, status?: string | null): number | string => {
  if (!resolvedDateStr || resolvedDateStr === "#N/A" || resolvedDateStr === "-" || !(status || "").toLowerCase().includes("resolved")) {
    return "#N/A";
  }
  if (!reportDateStr || reportDateStr === "#N/A" || reportDateStr === "-") return "#N/A";
  try {
    const rep = new Date(reportDateStr);
    const res = new Date(resolvedDateStr);
    if (isNaN(rep.getTime()) || isNaN(res.getTime())) return "#N/A";
    return Math.max(0, Math.floor((res.getTime() - rep.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return "#N/A";
  }
};

interface ReturnsViewProps {
  onSelectCustomer?: (customerName: string) => void;
  onSelectInvoice?: (invoiceNo: string) => void;
  records?: FakturRecord[];
  currentUser?: AppUser | null;
}

export default function ReturnsView({ onSelectCustomer, onSelectInvoice, records, currentUser }: ReturnsViewProps) {
  const [returns, setReturns] = useState<ShipmentReturnRecord[]>([]);

  const isSuper = isSuperAdminUser(currentUser?.name) || isSuperAdminUser(currentUser?.email);
  const canEditReturns = isSuper || Boolean(currentUser?.permissions?.can_edit_shipment_error);
  const canDeleteReturns = isSuper || Boolean(currentUser?.permissions?.can_delete_data);

  // Build map of invoice_no -> orderDate from daftar Faktur
  const invoiceDateMap = useMemo(() => {
    const map = new Map<string, string>();
    if (records && records.length > 0) {
      for (const rec of records) {
        const inv = (rec.invoiceNumber || "").trim().toLowerCase();
        const date = rec.orderDate || rec.transactionDate || "";
        if (inv && date && !map.has(inv)) {
          map.set(inv, date);
        }
      }
    }
    return map;
  }, [records]);

  const getInvoiceDate = useCallback(
    (r: ShipmentReturnRecord) => {
      if (r.invoice_no) {
        const clean = r.invoice_no.trim().toLowerCase();
        if (invoiceDateMap.has(clean)) {
          return invoiceDateMap.get(clean) || "";
        }
      }
      return (r as any).matched_invoice_date || r.invoice_date || "";
    },
    [invoiceDateMap]
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pbfFilter, setPbfFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [weekFilter, setWeekFilter] = useState("ALL");

  const currentWeekNumber = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / 604800000) + 1);
  }, []);

  const availableWeeks = useMemo(() => {
    const maxW = Math.max(43, currentWeekNumber);
    const list: number[] = [];
    for (let w = maxW; w >= 1; w--) {
      list.push(w);
    }
    return list;
  }, [currentWeekNumber]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // ─── Spreadsheet Freeze & Column Visibility States ───
  const [freezeColLevel, setFreezeColLevel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ret_freeze_level") || "3";
    }
    return "3";
  });
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ret_hidden_cols");
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
      localStorage.setItem("ret_freeze_level", level);
    }
  };

  const handleToggleCol = (colId: string) => {
    setHiddenCols((prev) => {
      const next = prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId];
      if (typeof window !== "undefined") {
        localStorage.setItem("ret_hidden_cols", JSON.stringify(next));
      }
      return next;
    });
  };

  const isColVisible = (colId: string) => !hiddenCols.includes(colId);
  const [stats, setStats] = useState({
    totalAll: 0,
    totalResolved: 0,
    totalPending: 0,
    totalMbi: 0,
    totalMai: 0,
    mbiApproved: 0,
    maiApproved: 0,
    openMbi: 0,
    openMai: 0,
    totalOpen: 0,
    totalReject: 0,
  });
  const [selectedReturn, setSelectedReturn] = useState<ShipmentReturnRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Master Customer & Apotek suggestions
  const [masterCustNames, setMasterCustNames] = useState<string[]>([]);
  const [showEditCustomerSuggestions, setShowEditCustomerSuggestions] = useState(false);
  const [showAddCustomerSuggestions, setShowAddCustomerSuggestions] = useState(false);

  useEffect(() => {
    fetch("/api/tidb?action=customers&active_only=true&limit=200")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setMasterCustNames(d.data.map((c: any) => c.name).filter(Boolean));
        }
      })
      .catch(() => {});
  }, []);

  const customerSuggestionsList = useMemo(() => {
    const seenLower = new Set<string>();
    const list: string[] = [];

    const addClean = (rawName?: string) => {
      if (!rawName) return;
      const clean = rawName.trim();
      if (!clean || clean === "-") return;
      const lower = clean.toLowerCase();
      if (lower.includes("[inactive]") || lower.includes("(inactive)")) return;
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        list.push(clean);
      }
    };

    for (const name of masterCustNames) addClean(name);
    if (records && records.length > 0) {
      for (const r of records) addClean(r.customerName);
    }
    for (const r of returns) addClean(r.customer_name);

    return list.sort((a, b) => a.localeCompare(b));
  }, [masterCustNames, records, returns]);

  // Tab & Analytics State
  const [activeTab, setActiveTab] = useState<
    | "list"
    | "overview"
    | "monthly"
    | "weekly"
    | "analisis"
    | "open"
    | "reject"
    | "leaderboard"
  >("list");
  const [allReturns, setAllReturns] = useState<ShipmentReturnRecord[]>([]);
  const [personnelStats, setPersonnelStats] = useState<{
    personnel: any[];
    rootCauses: any[];
    reasons: any[];
    pbfComparison: any[];
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [personnelFilterPbf, setPersonnelFilterPbf] = useState<string>("ALL");
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState<string>("");
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const openCasesCount = useMemo(() => {
    const list = allReturns.length > 0 ? allReturns : returns;
    return list.filter((r) => {
      const st = (r.status || "").toLowerCase();
      const conf = (r.confirm || "").toLowerCase();
      return !st.includes("resolved") && !conf.includes("reject") && !st.includes("reject");
    }).length;
  }, [allReturns, returns]);

  const rejectCasesCount = useMemo(() => {
    const list = allReturns.length > 0 ? allReturns : returns;
    return list.filter((r) => {
      const st = (r.status || "").toLowerCase();
      const conf = (r.confirm || "").toLowerCase();
      return conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
    }).length;
  }, [allReturns, returns]);

  // Fetch all returns for analytic tabs
  const fetchAllReturns = useCallback(async (forceFresh = false) => {
    try {
      const url = forceFresh
        ? "/api/tidb?action=returns&limit=5000&fresh=true"
        : "/api/tidb?action=returns&limit=5000";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAllReturns(json.data);
      }
    } catch (e) {
      console.error("fetchAllReturns error:", e);
    }
  }, []);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (rawData.length < 2) {
        alert("File Excel kosong atau tidak memiliki baris data.");
        setIsImporting(false);
        e.target.value = "";
        return;
      }

      // Find header row
      const headerIdx = rawData.findIndex((row) =>
        row && Array.isArray(row) && row.some((c) => {
          const s = String(c || "").toLowerCase().trim();
          return (
            s.includes("invoice") ||
            s.includes("faktur") ||
            s.includes("customer") ||
            s.includes("pelanggan") ||
            s.includes("produk") ||
            s.includes("alasan") ||
            s.includes("kendala") ||
            s.includes("reason")
          );
        })
      );

      const hIdx = headerIdx !== -1 ? headerIdx : 0;
      const header = (rawData[hIdx] as string[]).map((h) => String(h || "").toLowerCase().trim());

      const getColIdx = (...aliases: string[]) => {
        for (const a of aliases) {
          const idx = header.findIndex(
            (h) => h === a || h.replace(/[^a-z0-9]/g, "") === a.replace(/[^a-z0-9]/g, "") || h.includes(a)
          );
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const pbfCol = getColIdx("pbf", "distributor");
      const custCol = getColIdx("nama pelanggan", "customer name", "nama apotek", "pelanggan", "customer", "apotek");
      const invCol = getColIdx("no invoice", "no faktur", "invoice no", "faktur", "invoice");
      const soCol = getColIdx("no so", "no order", "so no", "so number", "order number", "so");
      const prodCol = getColIdx("nama produk", "nama barang", "product name", "item description", "produk", "barang", "item");
      const qtyCol = getColIdx("qty", "jumlah", "quantity");
      const batchCol = getColIdx("batch", "lot", "no batch", "no lot", "batch no", "lot number");
      const edCol = getColIdx("expiry date", "expired date", "ed", "exp date", "kadaluarsa");
      const reasonCol = getColIdx("alasan", "reason", "kendala", "masalah", "keterangan");
      const invDateCol = getColIdx("tanggal faktur", "tgl faktur", "invoice date", "inv date", "tgl inv");
      const reportDateCol = getColIdx("tanggal lapor", "tgl lapor", "report date", "tanggal report", "tgl report", "tanggal kejadian", "tgl kejadian", "tanggal pengajuan", "tgl pengajuan");
      const catCol = getColIdx("kategori", "category");
      const confirmCol = getColIdx("confirm", "konfirmasi");
      const actionCol = getColIdx("action", "tindakan", "penyelesaian");
      const statusCol = getColIdx("status", "status retur");
      const notaCol = getColIdx("no nota retur", "nota retur", "nota retur no");
      const resDateCol = getColIdx("tanggal penyelesaian", "tgl penyelesaian", "resolved date", "tgl selesai");
      const noteCol = getColIdx("catatan", "note", "keterangan tambahan");
      const personCol = getColIdx("personil", "person", "petugas", "pic", "nama personil", "pelaku", "checker", "picker", "checker / picker", "picker / checker", "nama petugas");
      const rootCol = getColIdx("root cause", "akar masalah", "penyebab");

      const items: any[] = [];
      for (let i = hIdx + 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || row.length === 0) continue;

        const val = (idx: number) =>
          idx !== -1 && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";

        const customer_name = val(custCol);
        const invoice_no = val(invCol);
        const product_name = val(prodCol);

        if (!customer_name && !invoice_no && !product_name) continue;

        items.push({
          pbf: val(pbfCol) || "MBI",
          customer_name: customer_name || "-",
          invoice_no: invoice_no || "-",
          so_no: val(soCol) || "-",
          product_name: product_name || "-",
          qty: Number(val(qtyCol)) || 1,
          batch_no: val(batchCol) || "-",
          expiry_date: val(edCol) || "-",
          reason: val(reasonCol) || "-",
          invoice_date: val(invDateCol) || "",
          report_date: val(reportDateCol) || "",
          category: val(catCol) || "DOO",
          confirm: val(confirmCol) || "Pending",
          action: val(actionCol) || "-",
          status: val(statusCol) || "Pending",
          nota_retur_no: val(notaCol) || "-",
          resolved_date: val(resDateCol) || null,
          note: val(noteCol) || "-",
          person: ["-", "reject", "#n/a", "none", "null"].includes(val(personCol).toLowerCase()) ? "" : val(personCol),
          root_cause: val(rootCol) || "-",
        });
      }

      if (items.length === 0) {
        alert("Tidak ada baris data valid yang berhasil diekstrak.");
        setIsImporting(false);
        e.target.value = "";
        return;
      }

      const res = await fetch("/api/tidb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_import_returns",
          items,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(`✓ Berhasil mengimpor ${json.count || items.length} data Shipment Error dari ${file.name}`);
        fetchReturns();
        fetchPersonnelStats();
        broadcastRealtimeSignal("returns");
      } else {
        alert(`Gagal mengimpor: ${json.error || "Terjadi kesalahan"}`);
      }
    } catch (err: any) {
      console.error("Import error:", err);
      alert(`Terjadi kesalahan saat membaca file: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const fetchPersonnelStats = useCallback(async (selectedMonth = monthFilter, selectedWeek = weekFilter) => {
    setLoadingStats(true);
    try {
      const q = new URLSearchParams({ action: "personnel_stats" });
      if (selectedMonth && selectedMonth !== "ALL") q.set("month", selectedMonth);
      if (selectedWeek && selectedWeek !== "ALL") q.set("week", selectedWeek);
      const res = await fetch(`/api/tidb?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPersonnelStats({
          personnel: json.personnel || [],
          rootCauses: json.rootCauses || [],
          reasons: json.reasons || [],
          pbfComparison: json.pbfComparison || [],
        });
      }
    } catch (err) {
      console.error("Gagal mengambil personnel stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [monthFilter, weekFilter]);

  useEffect(() => {
    fetchPersonnelStats();
  }, [fetchPersonnelStats]);

  const handleCopyComplaintLink = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/komplain`;
      navigator.clipboard.writeText(url).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      });
    }
  };

  // Editable return fields state (all columns)
  const [editForm, setEditForm] = useState({
    pbf: "MBI",
    customer_name: "",
    invoice_no: "",
    so_no: "",
    product_name: "",
    qty: 1,
    batch_no: "",
    expiry_date: "",
    reason: "",
    invoice_date: "",
    report_date: "",
    category: "",
    confirm: "",
    action: "",
    nota_retur_no: "",
    resolved_date: "",
    status: "Pending",
    note: "",
    person: "",
    root_cause: "",
  });

  useEffect(() => {
    if (selectedReturn) {
      setEditForm({
        pbf: selectedReturn.pbf || "MBI",
        customer_name: selectedReturn.customer_name || "",
        invoice_no: selectedReturn.invoice_no || "",
        so_no: selectedReturn.so_no || "",
        product_name: selectedReturn.product_name || "",
        qty: selectedReturn.qty || 1,
        batch_no: selectedReturn.batch_no || "",
        expiry_date: selectedReturn.expiry_date || "",
        reason: selectedReturn.reason || "",
        invoice_date: selectedReturn.invoice_date || "",
        report_date: selectedReturn.report_date ? selectedReturn.report_date.split("T")[0] : "",
        category: selectedReturn.category || "",
        confirm: selectedReturn.confirm || "",
        action: selectedReturn.action || "",
        nota_retur_no: selectedReturn.nota_retur_no || "",
        resolved_date: selectedReturn.resolved_date || "",
        status: selectedReturn.status || "Pending",
        note: selectedReturn.note || "",
        person: selectedReturn.person || "",
        root_cause: selectedReturn.root_cause || "",
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
    reason: "Fisik yang dikirim kurang",
    report_date: new Date().toISOString().split("T")[0],
    category: "",
    confirm: "",
    action: "",
    status: "Pending",
    person: "",
    root_cause: "",
    note: "",
  });

  const editCustomerSuggestions = useMemo(() => {
    const q = (editForm.customer_name || "").trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return customerSuggestionsList.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [editForm.customer_name, customerSuggestionsList]);

  const addCustomerSuggestions = useMemo(() => {
    const q = (newForm.customer_name || "").trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return customerSuggestionsList.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [newForm.customer_name, customerSuggestionsList]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const limit = 50;
  const lastFocusFetchRef = useRef<number>(Date.now());

  const fetchReturns = useCallback(async (silent = false, forceFresh = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "returns",
        limit: String(limit),
        offset: String(page * limit),
      });
      if (forceFresh) params.set("fresh", "true");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (pbfFilter !== "ALL") params.set("pbf", pbfFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (monthFilter !== "ALL") params.set("month", monthFilter);
      if (weekFilter !== "ALL") params.set("week", weekFilter);

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
      if (!silent) setLoading(false);
    }
  }, [debouncedSearch, statusFilter, pbfFilter, categoryFilter, monthFilter, weekFilter, page]);

  // Real-time Firestore cross-browser signal + polling when tab is visible
  useEffect(() => {
    fetchReturns();
    fetchAllReturns();
    const unsubRealtime = subscribeToRealtimeSignal("returns", () => {
      fetchReturns(true, true);
      fetchAllReturns(true);
      fetchPersonnelStats();
    });
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetchReturns(true);
    }, 45000);
    const onFocus = () => {
      const now = Date.now();
      // Throttle focus refetch to at most once per 60 seconds to save Origin bandwidth
      if (now - lastFocusFetchRef.current > 60000) {
        lastFocusFetchRef.current = now;
        fetchReturns(true);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      unsubRealtime();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchReturns, fetchAllReturns, fetchPersonnelStats]);

  const handleDeleteReturn = async (id: number, invoiceNo: string) => {
    if (!canDeleteReturns) {
      alert("Akses Ditolak: Akun Anda tidak memiliki hak akses untuk menghapus data. Hubungi Farhan (Super Admin).");
      return;
    }
    if (!confirm(`Hapus tiket komplain untuk faktur "${invoiceNo || id}"?\n\nData akan dihapus permanen dari sistem Fantastic Order.`)) {
      return;
    }
    setIsUpdating(true);
    try {
      // Delete di TiDB Cloud
      const res = await fetch(`/api/tidb?action=delete_return&id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_name: currentUser?.name || "Admin",
          user_email: currentUser?.email || "",
        }),
      });
      const data = await res.json().catch(() => ({ success: false, error: "Gagal membaca respon server" }));

      if (data.success) {
        setReturns((prev) => prev.filter((r) => r.id !== id));
        if (selectedReturn?.id === id) {
          setSelectedReturn(null);
        }
        fetchReturns(true, true);
        fetchAllReturns(true);
        broadcastRealtimeSignal("returns");
        await recordActivityLog({
          action_type: "DELETE_RETURN",
          module: "SHIPMENT_ERROR",
          target_id: String(id),
          details: `Menghapus tiket komplain #${id} untuk faktur ${invoiceNo || "-"}`,
          metadata: { id, invoice_no: invoiceNo },
        });
      } else {
        alert("Gagal menghapus data: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error saat menghapus: " + err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    if (!canEditReturns) {
      alert("Akses Ditolak: Akun Anda tidak memiliki hak akses mengubah Shipment Error.");
      return;
    }
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
        fetchReturns(true, true);
        fetchAllReturns(true);
        broadcastRealtimeSignal("returns");
        await recordActivityLog({
          action_type: newStatus === "Resolved" ? "RESOLVE_RETURN" : "UPDATE_RETURN",
          module: "SHIPMENT_ERROR",
          target_id: String(id),
          details: `Mengubah status komplain #${id} menjadi ${newStatus}`,
          metadata: { id, status: newStatus },
        });
      }
    } catch (err) {
      alert("Gagal memperbarui status komplain.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedReturn) return;
    if (!canEditReturns) {
      alert("Akses Ditolak: Akun Anda tidak memiliki hak akses mengubah Shipment Error.");
      return;
    }
    setIsUpdating(true);
    try {
      const isResolved = editForm.status === "Resolved";
      const resolvedDate = isResolved
        ? editForm.resolved_date || new Date().toISOString().split("T")[0]
        : editForm.resolved_date;

      const payload = {
        id: selectedReturn.id,
        ...editForm,
        resolved_date: resolvedDate,
        user_name: currentUser?.name || "Admin",
        user_email: currentUser?.email || "",
      };

      // 1. Update TiDB Cloud Database
      const res = await fetch("/api/tidb?action=update_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setReturns((prev) =>
          prev.map((r) =>
            r.id === selectedReturn.id
              ? {
                  ...r,
                  ...editForm,
                  resolved_date: resolvedDate,
                }
              : r
          )
        );
        setSelectedReturn(null);
        fetchReturns(true, true);
        fetchAllReturns(true);
        broadcastRealtimeSignal("returns");
        await recordActivityLog({
          action_type: isResolved ? "RESOLVE_RETURN" : "UPDATE_RETURN",
          module: "SHIPMENT_ERROR",
          target_id: String(selectedReturn.id),
          details: `${isResolved ? "Menyelesaikan (Resolve)" : "Mengubah"} komplain faktur #${selectedReturn.invoice_no || selectedReturn.id} (${selectedReturn.customer_name || ""})`,
          metadata: {
            id: selectedReturn.id,
            invoice_no: selectedReturn.invoice_no,
            customer_name: selectedReturn.customer_name,
            status: editForm.status,
            action: editForm.action,
            note: editForm.note,
          },
        });
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
    if (!canEditReturns) {
      alert("Akses Ditolak: Akun Anda tidak memiliki hak akses untuk menambah komplain baru.");
      return;
    }
    if (!newForm.customer_name || !newForm.product_name) {
      alert("Mohon isi Nama Apotek dan Nama Produk!");
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch("/api/tidb?action=create_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newForm,
          user_name: currentUser?.name || "Admin",
          user_email: currentUser?.email || "",
        }),
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
          reason: "Fisik yang dikirim kurang",
          report_date: new Date().toISOString().split("T")[0],
          category: "",
          confirm: "",
          action: "",
          status: "Pending",
          person: "",
          root_cause: "",
          note: "",
        });
        fetchReturns(false, true);
        fetchAllReturns(true);
        broadcastRealtimeSignal("returns");
        await recordActivityLog({
          action_type: "CREATE_RETURN",
          module: "SHIPMENT_ERROR",
          target_id: String(newForm.invoice_no || newForm.customer_name),
          details: `Menambahkan komplain baru untuk apotek ${newForm.customer_name} (faktur #${newForm.invoice_no || "-"})`,
          metadata: { ...newForm },
        });
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
    const formattedData = returns.map((r, idx) => ({
      No: idx + 1,
      PBF: r.pbf || "MBI",
      "Nama Apotek": r.customer_name || "-",
      "No. Faktur": r.invoice_no || "-",
      "Tanggal Faktur": formatDate(getInvoiceDate(r)),
      "Tanggal Lapor": r.report_date ? formatDate(r.report_date) : (r.created_at ? formatDate(r.created_at.split(" ")[0]) : "-"),
      "No. SO": r.so_no || "-",
      "Nama Produk": r.product_name || "-",
      Qty: r.qty || 1,
      Batch: r.batch_no || "-",
      ED: r.expiry_date || "-",
      "Alasan (Reason)": r.reason || "-",
      Status: r.status || "Pending",
      "Tanggal Penyelesaian": formatDate(r.resolved_date),
      "Days until Today": calculateDaysUntilToday(r.report_date),
      "Days until close": calculateDaysUntilClose(r.report_date, r.resolved_date, r.status),
      Tindakan: r.action || "-",
      "Status Konfirmasi": r.confirm || "-",
      "No. Nota Retur": r.nota_retur_no || "-",
      "Person (Pelaku)": r.person || "-",
      "Akar Masalah (Root Cause)": r.root_cause || "-",
      Kategori: r.category || "-",
      Catatan: r.note || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shipment_Returns");
    XLSX.writeFile(wb, `Retur_Komplain_FantasticOrder_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const filteredPersonnel = useMemo(() => {
    if (!personnelStats?.personnel) return [];
    const list = personnelStats.personnel.filter((p) => {
      const matchQuery =
        !personnelSearchQuery ||
        p.person.toLowerCase().includes(personnelSearchQuery.toLowerCase());
      const matchPbf =
        personnelFilterPbf === "ALL"
          ? true
          : personnelFilterPbf === "MBI"
          ? Number(p.mbi_cases) > 0
          : Number(p.mai_cases) > 0;
      return matchQuery && matchPbf;
    });

    if (personnelFilterPbf === "MAI") {
      return [...list].sort((a, b) => Number(b.mai_cases || 0) - Number(a.mai_cases || 0));
    }
    if (personnelFilterPbf === "MBI") {
      return [...list].sort((a, b) => Number(b.mbi_cases || 0) - Number(a.mbi_cases || 0));
    }
    return list;
  }, [personnelStats, personnelSearchQuery, personnelFilterPbf]);

  const maxPersonnelCases = useMemo(() => {
    if (!filteredPersonnel.length) return 1;
    return Math.max(
      ...filteredPersonnel.map((p) => {
        if (personnelFilterPbf === "MAI") return Number(p.mai_cases) || 0;
        if (personnelFilterPbf === "MBI") return Number(p.mbi_cases) || 0;
        return Number(p.total_cases) || 0;
      }),
      1
    );
  }, [filteredPersonnel, personnelFilterPbf]);

  const totalPersonnelErrors = useMemo(() => {
    if (!filteredPersonnel.length) return 0;
    return filteredPersonnel.reduce((sum, p) => {
      if (personnelFilterPbf === "MAI") return sum + Number(p.mai_cases || 0);
      if (personnelFilterPbf === "MBI") return sum + Number(p.mbi_cases || 0);
      return sum + Number(p.total_cases || 0);
    }, 0);
  }, [filteredPersonnel, personnelFilterPbf]);

  const totalRootCauses = useMemo(() => {
    if (!personnelStats?.rootCauses) return 0;
    return personnelStats.rootCauses.reduce((sum, r) => sum + Number(r.total || 0), 0);
  }, [personnelStats]);

  const totalReasons = useMemo(() => {
    if (!personnelStats?.reasons) return 0;
    return personnelStats.reasons.reduce((sum, r) => sum + Number(r.total || 0), 0);
  }, [personnelStats]);

  const totalPages = Math.ceil(total / limit);

  const renderAccordionContent = (r: any) => (
    <div className="bg-white dark:bg-[#0d1424] border border-zinc-300 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm space-y-3 text-left">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 dark:border-slate-800 pb-2.5 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
          <h4 className="font-bold text-xs sm:text-sm text-black dark:text-white">
            Tiket #{r.id} - Faktur {r.invoice_no || "-"}
          </h4>
          <span className="text-xs text-zinc-500 dark:text-slate-400 font-semibold truncate">
            ({r.customer_name})
          </span>
        </div>

        {r.photo_url && (
          <button
            type="button"
            onClick={() => setPreviewPhotoUrl(r.photo_url || null)}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Lihat Foto Bukti</span>
          </button>
        )}
      </div>

      {/* Form Edit Ringkas & Lengkap (3 Bagian Rapi) */}
      <div className="space-y-3 text-xs">
        {!canEditReturns && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Mode Hanya Lihat: Akun Anda tidak memiliki hak akses mengubah modul Shipment Error. Hubungi Farhan (Super Admin) untuk meminta akses.</span>
          </div>
        )}
        {/* Bagian 1: Data Faktur & Merchant */}
        <div className="bg-zinc-50 dark:bg-slate-950/80 p-2.5 sm:p-3 rounded-lg border border-zinc-200 dark:border-slate-800 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
            1. Data Faktur & Merchant
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            {/* Nama Apotek with Suggestion */}
            <div className="relative sm:col-span-3">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Nama Apotek / Merchant
              </label>
              <input
                type="text"
                value={editForm.customer_name}
                onChange={(e) => {
                  setEditForm({ ...editForm, customer_name: e.target.value });
                  setShowEditCustomerSuggestions(true);
                }}
                onFocus={() => setShowEditCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowEditCustomerSuggestions(false), 250)}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
              {showEditCustomerSuggestions && editCustomerSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto py-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-slate-500 border-b border-zinc-100 dark:border-slate-800">
                    Saran Nama Apotek ({editCustomerSuggestions.length})
                  </div>
                  {editCustomerSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEditForm({ ...editForm, customer_name: name });
                        setShowEditCustomerSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer border-b border-zinc-50 dark:border-slate-800/40 last:border-b-0"
                    >
                      <span className="font-semibold truncate">{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">PBF</label>
              <select
                value={editForm.pbf}
                onChange={(e) => setEditForm({ ...editForm, pbf: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              >
                <option value="MBI">MBI</option>
                <option value="MAI">MAI</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">No. Faktur</label>
              <input
                type="text"
                value={editForm.invoice_no}
                onChange={(e) => setEditForm({ ...editForm, invoice_no: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-indigo-700 dark:text-indigo-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Tgl Faktur</label>
              <input
                type="date"
                value={editForm.invoice_date ? editForm.invoice_date.split("T")[0] : ""}
                onChange={(e) => setEditForm({ ...editForm, invoice_date: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Tgl Lapor / Kejadian</label>
              <input
                type="date"
                value={editForm.report_date ? editForm.report_date.split("T")[0] : ""}
                onChange={(e) => setEditForm({ ...editForm, report_date: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-rose-700 dark:text-rose-400 font-mono font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">No. Sales Order (SO)</label>
              <input
                type="text"
                value={editForm.so_no}
                onChange={(e) => setEditForm({ ...editForm, so_no: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Kategori</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              >
                <option value="">-- Belum --</option>
                <option value="1P">1P</option>
                <option value="2P">2P</option>
                <option value="3P">3P</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bagian 2: Produk & Detail Retur */}
        <div className="bg-zinc-50 dark:bg-slate-950/80 p-2.5 sm:p-3 rounded-lg border border-zinc-200 dark:border-slate-800 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
            2. Detail Produk & Kendala (Reason)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <div className="sm:col-span-3">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Nama Produk</label>
              <input
                type="text"
                value={editForm.product_name}
                onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Kuantitas (Qty)</label>
              <input
                type="number"
                min="1"
                value={editForm.qty}
                onChange={(e) => setEditForm({ ...editForm, qty: Number(e.target.value) || 1 })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Batch Number</label>
              <input
                type="text"
                value={editForm.batch_no}
                onChange={(e) => setEditForm({ ...editForm, batch_no: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Expiry Date (ED)</label>
              <input
                type="text"
                value={editForm.expiry_date}
                onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Alasan / Kendala Dilaporkan</label>
              <input
                type="text"
                list="complaint-reasons-list"
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                placeholder="Pilih atau ketik alasan..."
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-amber-800 dark:text-amber-300 font-bold"
              />
              <datalist id="complaint-reasons-list">
                {COMPLAINT_REASONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Bagian 3: Tindak Lanjut & Resolusi */}
        <div className="bg-zinc-50 dark:bg-slate-950/80 p-2.5 sm:p-3 rounded-lg border border-zinc-200 dark:border-slate-800 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
            3. Tindakan (Action) & Status Resolusi
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Status Tiket</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Approve">Approve</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Tgl Penyelesaian</label>
              <input
                type="date"
                value={editForm.resolved_date ? editForm.resolved_date.split("T")[0] : ""}
                onChange={(e) => setEditForm({ ...editForm, resolved_date: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Days Until Close</label>
              <div className={`p-1.5 border rounded-lg font-mono font-bold text-xs flex items-center justify-between ${
                calculateDaysUntilClose(editForm.report_date, editForm.resolved_date, editForm.status) === "#N/A"
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              }`}>
                <span>{calculateDaysUntilClose(editForm.report_date, editForm.resolved_date, editForm.status) === "#N/A" ? "#N/A (Belum Close)" : `${calculateDaysUntilClose(editForm.report_date, editForm.resolved_date, editForm.status)} hari`}</span>
                <span className="text-[10px] font-normal text-zinc-500">Today: {calculateDaysUntilToday(editForm.report_date)} hr</span>
              </div>
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Konfirmasi (Confirm)</label>
              <select
                value={editForm.confirm}
                onChange={(e) => setEditForm({ ...editForm, confirm: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              >
                <option value="">-- Belum Ditentukan --</option>
                <option value="Approve">Approve</option>
                <option value="Reject">Reject</option>
                <option value="Pending">Pending</option>
                <option value="Review">Review</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">No. Nota Retur</label>
              <input
                type="text"
                value={editForm.nota_retur_no}
                onChange={(e) => setEditForm({ ...editForm, nota_retur_no: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Tindakan (Action)</label>
              <input
                type="text"
                value={editForm.action}
                onChange={(e) => setEditForm({ ...editForm, action: e.target.value })}
                placeholder="Tukar fisik / Retur nota / dll"
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Penyebab (Root Cause)</label>
              <input
                type="text"
                value={editForm.root_cause}
                onChange={(e) => setEditForm({ ...editForm, root_cause: e.target.value })}
                placeholder="Human error / dll"
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Person (Pelaku Kesalahan / Picker & Checker)
              </label>
              <input
                type="text"
                value={editForm.person}
                onChange={(e) => setEditForm({ ...editForm, person: e.target.value })}
                placeholder=""
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Catatan Tambahan (Note)</label>
              <input
                type="text"
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar: Actions & Links */}
      <div className="flex flex-wrap items-center justify-between border-t border-zinc-200 dark:border-slate-800 pt-3 gap-2">
        <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-medium">
          Tersimpan di Master Database TiDB Cloud
        </span>

        <div className="flex items-center gap-2">
          {/* Delete Return Button */}
          {canDeleteReturns && (
            <button
              type="button"
              onClick={() => handleDeleteReturn(r.id, r.invoice_no)}
              disabled={isUpdating}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 rounded-xl text-xs font-bold border border-red-300 dark:border-red-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Hapus komplain ini dari database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedReturn(null)}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-black dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-zinc-300 dark:border-slate-700 transition-all"
          >
            Tutup
          </button>

          {canEditReturns ? (
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isUpdating}
              className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isUpdating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold">
              🔒 Read-Only
            </span>
          )}

          {onSelectCustomer && (
            <button
              type="button"
              onClick={() => {
                const c = r.customer_name;
                setSelectedReturn(null);
                onSelectCustomer(c);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 ml-2"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Lihat Master Customer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Benchmark monthly invoices matching Apps Script
  const monthBenchmarkInvoices: Record<string, { mai: number; mbi: number }> = {
    ALL: { mai: 58304, mbi: 78056 },
    "1": { mai: 5150, mbi: 5011 },
    "2": { mai: 5475, mbi: 5461 },
    "3": { mai: 5620, mbi: 4870 },
    "4": { mai: 6320, mbi: 7151 },
    "5": { mai: 6441, mbi: 8255 },
    "6": { mai: 6566, mbi: 9195 },
    "7": { mai: 6591, mbi: 10532 },
    "8": { mai: 5832, mbi: 9680 },
    "9": { mai: 6380, mbi: 8161 },
    "10": { mai: 4101, mbi: 9917 },
  };

  const currentBenchmark = monthBenchmarkInvoices[monthFilter] || monthBenchmarkInvoices.ALL;
  const maiInvoiceCount = currentBenchmark.mai;
  const mbiInvoiceCount = currentBenchmark.mbi;

  const errorRateMai = maiInvoiceCount > 0 ? (((stats.maiApproved || stats.totalMai) / maiInvoiceCount) * 100).toFixed(2) : "0.00";
  const errorRateMbi = mbiInvoiceCount > 0 ? (((stats.mbiApproved || stats.totalMbi) / mbiInvoiceCount) * 100).toFixed(2) : "0.00";
  const totApproved = (stats.maiApproved || stats.totalMai) + (stats.mbiApproved || stats.totalMbi);
  const resolutionRate = totApproved > 0 ? ((stats.totalResolved / totApproved) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* View Switcher Tabs (Apps Script Navigation Suite) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 overflow-x-auto max-w-full">
          {/* Tab 1: Data Kasus (Data Utama Paling Kiri) */}
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "list"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Package className="w-4 h-4 text-blue-500" />
            <span>Data Kasus</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-slate-700 leading-none inline-flex items-center justify-center text-zinc-800 dark:text-zinc-200 font-mono font-bold">
              {total.toLocaleString("id-ID")}
            </span>
          </button>

          {/* Tab 2: Overview */}
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "overview"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span>Overview</span>
          </button>

          {/* Tab 3: Monthly */}
          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "monthly"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4 text-red-500" />
            <span>Monthly</span>
          </button>

          {/* Tab 4: Weekly */}
          <button
            type="button"
            onClick={() => setActiveTab("weekly")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "weekly"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <CalendarRange className="w-4 h-4 text-blue-500" />
            <span>Weekly</span>
          </button>

          {/* Tab 5: Analisis */}
          <button
            type="button"
            onClick={() => setActiveTab("analisis")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "analisis"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Analisis</span>
          </button>

          {/* Tab 6: In Progress */}
          <button
            type="button"
            onClick={() => setActiveTab("open")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "open"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Clock className="w-4 h-4 text-amber-500" />
            <span>In Progress</span>
            {openCasesCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono font-bold">
                {openCasesCount}
              </span>
            )}
          </button>

          {/* Tab 7: Reject Cases */}
          <button
            type="button"
            onClick={() => setActiveTab("reject")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "reject"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <span className="text-xs">❌</span>
            <span>Reject Cases</span>
            {rejectCasesCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono font-bold">
                {rejectCasesCount}
              </span>
            )}
          </button>

          {/* Tab 8: Personil Leaderboard */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("leaderboard");
              fetchPersonnelStats();
            }}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "leaderboard"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Users className="w-4 h-4 text-amber-500" />
            <span>Personil</span>
            {personnelStats?.personnel?.length ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono font-bold">
                {personnelStats.personnel.length}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchReturns(false, true);
              fetchAllReturns(true);
              fetchPersonnelStats();
            }}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 text-zinc-600 dark:text-slate-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading || loadingStats ? "animate-spin text-indigo-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── TAB: OVERVIEW ─── */}
      {activeTab === "overview" && (
        <OverviewKpiView returns={allReturns.length > 0 ? allReturns : returns} records={records} />
      )}

      {/* ─── TAB: MONTHLY ─── */}
      {activeTab === "monthly" && (
        <MonthlyReportView returns={allReturns.length > 0 ? allReturns : returns} records={records} />
      )}

      {/* ─── TAB: WEEKLY ─── */}
      {activeTab === "weekly" && (
        <WeeklyReportView returns={allReturns.length > 0 ? allReturns : returns} records={records} />
      )}

      {/* ─── TAB: OPEN CASES ─── */}
      {activeTab === "open" && (
        <OpenCasesView
          returns={allReturns.length > 0 ? allReturns : returns}
          onRefreshParentReturns={() => {
            fetchReturns(true, true);
            fetchAllReturns(true);
          }}
        />
      )}

      {/* ─── TAB: REJECT CASES ─── */}
      {activeTab === "reject" && (
        <RejectCasesView returns={allReturns.length > 0 ? allReturns : returns} />
      )}

      {/* Tab 8: Daftar Retur (Data Kasus) */}
      {activeTab === "list" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Top 6 Metric Cards matching Apps Script layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Card 1: TOTAL CASES MAI */}
            <div
              onClick={() => {
                setPbfFilter(pbfFilter === "MAI" ? "ALL" : "MAI");
                setPage(0);
              }}
              className={`relative overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between cursor-pointer transition-all select-none hover:shadow-md ${
                pbfFilter === "MAI"
                  ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/20 dark:bg-red-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-800"
              }`}
              title="Klik untuk filter PBF MAI"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
              <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                TOTAL CASES MAI
              </div>
              <div className="my-1.5">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                  {(stats.maiApproved || stats.totalMai).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                dari {maiInvoiceCount.toLocaleString("id-ID")} invoice
              </div>
            </div>

            {/* Card 2: TOTAL CASES MBI */}
            <div
              onClick={() => {
                setPbfFilter(pbfFilter === "MBI" ? "ALL" : "MBI");
                setPage(0);
              }}
              className={`relative overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between cursor-pointer transition-all select-none hover:shadow-md ${
                pbfFilter === "MBI"
                  ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800"
              }`}
              title="Klik untuk filter PBF MBI"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
              <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                TOTAL CASES MBI
              </div>
              <div className="my-1.5">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {(stats.mbiApproved || stats.totalMbi).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                dari {mbiInvoiceCount.toLocaleString("id-ID")} invoice
              </div>
            </div>

            {/* Card 3: ERROR RATE MAI */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
              <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                ERROR RATE MAI
              </div>
              <div className="my-1.5">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                  {errorRateMai}%
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Approve only
              </div>
            </div>

            {/* Card 4: ERROR RATE MBI */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
              <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                ERROR RATE MBI
              </div>
              <div className="my-1.5">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {errorRateMbi}%
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Approve only
              </div>
            </div>

            {/* Card 5: IN PROGRESS */}
            <div
              onClick={() => {
                setStatusFilter(statusFilter === "In Progress" || statusFilter === "Pending" ? "ALL" : "In Progress");
                setPage(0);
              }}
              className={`relative overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between cursor-pointer transition-all select-none hover:shadow-md ${
                statusFilter === "Pending" || statusFilter === "In Progress" || statusFilter === "Open case"
                  ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800"
              }`}
              title="Klik untuk filter kasus In Progress (Sedang Diproses)"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
              <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                IN PROGRESS
              </div>
              <div className="my-1.5">
                <span className="text-2xl font-black text-amber-500 dark:text-amber-400 font-mono">
                  {openCasesCount}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                MAI: {stats.openMai} - MBI: {stats.openMbi}
              </div>
            </div>

            {/* Card 6: RESOLVED */}
            <div
              onClick={() => {
                setStatusFilter(statusFilter === "Resolved" ? "ALL" : "Resolved");
                setPage(0);
              }}
              className={`relative overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between cursor-pointer transition-all select-none hover:shadow-md ${
                statusFilter === "Resolved"
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800"
              }`}
              title="Klik untuk filter kasus Selesai (Resolved)"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                RESOLVED
              </div>
              <div className="my-1.5">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {stats.totalResolved.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {resolutionRate}% resolution rate
              </div>
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="py-2 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Komplain</span>
              </button>
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                disabled={isImporting}
                className="py-2 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Impor Data Excel / CSV"
              >
                <Download className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 rotate-180 ${isImporting ? "animate-bounce" : ""}`} />
                <span>{isImporting ? "Mengimpor..." : "Impor Excel"}</span>
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportExcel}
              />
              <button
                type="button"
                onClick={handleExportExcel}
                className="py-2 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 border border-zinc-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Unduh Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Ekspor Excel</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyComplaintLink}
                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  linkCopied
                    ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                    : "bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700"
                }`}
                title="Salin link form komplain publik untuk dibagikan ke apotek atau tim sales"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Link Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Salin Link Form</span>
                  </>
                )}
              </button>

              <a
                href="/komplain"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 bg-white hover:bg-zinc-100 text-black dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-zinc-300 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Buka form input komplain di tab baru"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Buka Form</span>
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </a>
            </div>
          </div>

      {/* â”€â”€â”€ Search and Filters Command Bar â”€â”€â”€ */}
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
          {/* Action Link: Salin Link Form Komplain Publik */}
          <button
            type="button"
            onClick={handleCopyComplaintLink}
            className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              linkCopied
                ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                : "bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700"
            }`}
            title="Salin link form komplain publik untuk dibagikan ke apotek atau tim sales"
          >
            {linkCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Link Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Salin Link Form</span>
              </>
            )}
          </button>

          {/* Action Link: Buka Form Komplain Publik */}
          <a
            href="/komplain"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 bg-white hover:bg-zinc-100 text-black dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-zinc-300 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Buka form input komplain di tab baru"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Buka Form</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>

          {/* Action Link: Input Komplain Baru */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="py-2 px-3.5 bg-black hover:bg-zinc-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Input Komplain Baru</span>
          </button>

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
              <option value="MBI">PT MEDIKA BINA INVESTAMA (MBI)</option>
              <option value="MAI">PT MEDIKA AKSES INVESTAMA (MAI)</option>
            </select>
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">Bulan:</span>
            <select
              value={monthFilter}
              onChange={(e) => {
                const m = e.target.value;
                setMonthFilter(m);
                setPage(0);
                fetchPersonnelStats(m, weekFilter);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Semua Bulan (Jan - Okt 2026)</option>
              <option value="10">Oktober 2026</option>
              <option value="9">September 2026</option>
              <option value="8">Agustus 2026</option>
              <option value="7">Juli 2026</option>
              <option value="6">Juni 2026</option>
              <option value="5">Mei 2026</option>
              <option value="4">April 2026</option>
              <option value="3">Maret 2026</option>
              <option value="2">Februari 2026</option>
              <option value="1">Januari 2026</option>
            </select>
          </div>

          {/* Week Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1">
            <CalendarRange className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">Week:</span>
            <select
              value={weekFilter}
              onChange={(e) => {
                const w = e.target.value;
                setWeekFilter(w);
                setPage(0);
                fetchPersonnelStats(monthFilter, w);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">Semua Week (W1 - W{Math.max(43, currentWeekNumber)})</option>
              <option value={String(currentWeekNumber)}>Week Sekarang (W{currentWeekNumber})</option>
              <option disabled>──────────</option>
              {availableWeeks.map((w) => (
                <option key={w} value={String(w)}>
                  W{w} {w === currentWeekNumber ? "(Minggu Ini)" : ""}
                </option>
              ))}
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

          {/* ─── Spreadsheet Freeze Selector ─── */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1">
            <Pin className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">Freeze:</span>
            <select
              value={freezeColLevel}
              onChange={(e) => handleFreezeChange(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer pr-1"
              title="Kunci kolom di sisi kiri seperti Excel/Google Sheets"
            >
              <option value="none">Bebas (Tanpa Freeze)</option>
              <option value="1">1. Kolom PBF</option>
              <option value="2">2. PBF + Apotek</option>
              <option value="3">3. Sampai No. Faktur</option>
            </select>
          </div>

          {/* ─── Column Visibility Dropdown Toggle ─── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColMenu((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showColMenu || hiddenCols.length > 0
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                  : "bg-zinc-50 dark:bg-[#070b13] text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-700/60 hover:bg-zinc-100"
              }`}
              title="Atur kolom yang ingin ditampilkan / disembunyikan"
            >
              <Columns className="w-3.5 h-3.5 text-blue-500" />
              <span>Kolom {hiddenCols.length > 0 ? `(${13 - hiddenCols.length}/13)` : ""}</span>
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-white dark:bg-[#0c1222] border border-zinc-200 dark:border-zinc-700 shadow-xl p-3 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">
                  <span>Pilih Kolom Tampil</span>
                  {hiddenCols.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setHiddenCols([]);
                        if (typeof window !== "undefined") localStorage.removeItem("ret_hidden_cols");
                      }}
                      className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset Semua
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {[
                    { id: "pbf", label: "PBF & Week" },
                    { id: "apotek", label: "Nama Apotek", locked: true },
                    { id: "no_faktur", label: "No. Faktur" },
                    { id: "status", label: "Status Tiket" },
                    { id: "tgl_faktur", label: "Tgl Faktur" },
                    { id: "tgl_lapor", label: "Tgl Lapor" },
                    { id: "no_so", label: "No. SO" },
                    { id: "produk", label: "Nama Produk & Qty" },
                    { id: "alasan", label: "Alasan (Reason)" },
                    { id: "tgl_selesai", label: "Tgl Selesai" },
                    { id: "days_today", label: "Days Today" },
                    { id: "days_close", label: "Days Until Close" },
                    { id: "tindakan", label: "Tindakan" },
                  ].map((col) => (
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

          <button
            type="button"
            onClick={() => {
              fetchReturns(false, true);
              fetchAllReturns(true);
            }}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all active:scale-95 shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* â”€â”€â”€ Enterprise Returns Table â”€â”€â”€ */}
      {/* ─── Mobile Cards View (Khusus Tampilan HP / Layar Kecil) ─── */}
      <div className="block md:hidden space-y-3">
        {loading && returns.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 bg-white dark:bg-[#0a0f1c] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
            <span className="font-semibold text-xs">Memuat data tiket komplain...</span>
          </div>
        ) : returns.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 bg-white dark:bg-[#0a0f1c] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs">
            <RotateCcw className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
            <p className="font-semibold text-xs text-zinc-600 dark:text-slate-400">Tidak ada tiket komplain yang cocok</p>
            <p className="text-[11px] text-zinc-400 dark:text-slate-500 mt-1">Gunakan kata kunci lain atau ubah status filter.</p>
          </div>
        ) : (
          returns.map((r) => {
            const isResolved = (r.status || "").toLowerCase().includes("resolved");
            const isPending = (r.status || "").toLowerCase().includes("pending");
            const isExpanded = selectedReturn?.id === r.id;

            return (
              <div
                key={`mobile-${r.id}`}
                className={`rounded-2xl border transition-all p-3.5 shadow-xs ${
                  isExpanded
                    ? "bg-indigo-50/70 dark:bg-slate-800/80 border-indigo-500 ring-1 ring-indigo-500"
                    : "bg-white dark:bg-[#0a0f1c] border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {/* 1. Header: PBF, Faktur No, & STATUS BADGE (Sangat Jelas di HP) */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        r.pbf === "MAI"
                          ? "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30"
                          : "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                      }`}
                    >
                      {r.pbf && r.pbf !== "#N/A" ? r.pbf : "MBI"}
                    </span>
                    {r.week ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
                        W{r.week}
                      </span>
                    ) : null}

                    {r.invoice_no && r.invoice_no !== "#N/A" ? (
                      <button
                        type="button"
                        onClick={() => onSelectInvoice && onSelectInvoice(r.invoice_no)}
                        className="font-mono text-xs font-bold text-blue-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        title="Buka Faktur Terkait"
                      >
                        <span>#{r.invoice_no}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-400">#Tiket-{r.id}</span>
                    )}
                  </div>

                  {/* STATUS BADGE - LANGSUNG TERLIHAT JELAS DI HP */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shrink-0 shadow-2xs ${
                      isResolved
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/40"
                        : isPending
                        ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/40"
                        : "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/25 dark:text-blue-300 dark:border-blue-500/40"
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>{isResolved ? "Resolved" : (r.status || "Pending")}</span>
                  </span>
                </div>

                {/* 2. Nama Apotek & Kategori */}
                <div className="py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white line-clamp-1">
                      {r.customer_name || "-"}
                    </h4>
                    {r.category && r.category !== "#N/A" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shrink-0">
                        {r.category}
                      </span>
                    )}
                  </div>

                  {/* Produk & Alasan Komplain */}
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-1 font-bold text-zinc-900 dark:text-zinc-100">
                      <span className="line-clamp-1">{r.product_name || "-"}</span>
                      <span className="shrink-0 text-indigo-600 dark:text-indigo-400 font-mono">
                        Qty: {r.qty || 1}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      <strong className="text-zinc-700 dark:text-zinc-300">Kendala:</strong> {r.reason || "-"}
                    </p>
                    {r.action && r.action !== "#N/A" && (
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold line-clamp-1 pt-0.5">
                        Tindakan: {r.action}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Tanggal Lapor & Selesai */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 pb-2">
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    <span>Lapor: {formatDate(r.report_date || r.created_at?.split(" ")[0])}</span>
                  </span>

                  {r.resolved_date && r.resolved_date !== "#N/A" ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Selesai: {formatDate(r.resolved_date)}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      Dalam Proses
                    </span>
                  )}
                </div>

                {/* 4. Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {r.photo_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoUrl(r.photo_url || null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:scale-105 transition-all cursor-pointer"
                    >
                      <Camera className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      <span>Lihat Foto Bukti</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedReturn((prev) => (prev?.id === r.id ? null : r))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isExpanded
                        ? "bg-black text-white dark:bg-indigo-600"
                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700"
                    }`}
                  >
                    {isExpanded ? "Tutup Detail" : "Edit & Tindakan"}
                  </button>
                </div>

                {/* Mobile Expanded Form */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-900/60 animate-in fade-in duration-150">
                    {renderAccordionContent(r)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Enterprise Returns Table (Desktop & Tablet) ─── */}
      <div className="hidden md:block rounded-2xl border border-zinc-300 dark:border-zinc-800/90 bg-white dark:bg-[#0a0f1c]/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
            <thead>
              <tr className="bg-zinc-100 dark:bg-[#070b14] border-b-2 border-zinc-300 dark:border-zinc-800 text-[11px] font-black text-black dark:text-slate-400 uppercase tracking-wider select-none">
                {/* PBF */}
                {isColVisible("pbf") && (
                  <th
                    className={`py-2.5 px-3 w-20 min-w-[80px] border-r border-zinc-200 dark:border-zinc-800 ${
                      freezeColLevel === "1"
                        ? "sticky left-0 z-30 bg-zinc-100 dark:bg-[#070b14] border-r-2 border-r-blue-500 shadow-md"
                        : freezeColLevel === "2" || freezeColLevel === "3"
                        ? "sticky left-0 z-30 bg-zinc-100 dark:bg-[#070b14]"
                        : ""
                    }`}
                  >
                    PBF
                  </th>
                )}

                {/* Nama Apotek (Locked Always Visible) */}
                <th
                  className={`py-2.5 px-4 min-w-[240px] border-r border-zinc-200 dark:border-zinc-800 ${
                    freezeColLevel === "2"
                      ? `sticky z-30 bg-zinc-100 dark:bg-[#070b14] border-r-2 border-r-blue-500 shadow-md ${
                          isColVisible("pbf") ? "left-[80px]" : "left-0"
                        }`
                      : freezeColLevel === "3"
                      ? `sticky z-30 bg-zinc-100 dark:bg-[#070b14] ${
                          isColVisible("pbf") ? "left-[80px]" : "left-0"
                        }`
                      : ""
                  }`}
                >
                  Nama Apotek
                </th>

                {/* No. Faktur */}
                {isColVisible("no_faktur") && (
                  <th
                    className={`py-2.5 px-3 w-32 min-w-[120px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800 ${
                      freezeColLevel === "3"
                        ? `sticky z-30 bg-zinc-100 dark:bg-[#070b14] border-r-2 border-r-blue-500 shadow-md ${
                            isColVisible("pbf") ? "left-[320px]" : "left-[240px]"
                          }`
                        : ""
                    }`}
                  >
                    No. Faktur
                  </th>
                )}

                {/* Status */}
                {isColVisible("status") && (
                  <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                    Status
                  </th>
                )}

                {/* Tgl Faktur */}
                {isColVisible("tgl_faktur") && (
                  <th className="py-2.5 px-3 w-28 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                    Tgl Faktur
                  </th>
                )}

                {/* Tgl Lapor */}
                {isColVisible("tgl_lapor") && (
                  <th className="py-2.5 px-3 whitespace-nowrap w-28 border-r border-zinc-200 dark:border-zinc-800">
                    Tgl Lapor
                  </th>
                )}

                {/* No. SO */}
                {isColVisible("no_so") && (
                  <th className="py-2.5 px-3 w-28 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                    No. SO
                  </th>
                )}

                {/* Nama Produk & Qty */}
                {isColVisible("produk") && (
                  <th className="py-2.5 px-4 min-w-[240px] border-r border-zinc-200 dark:border-zinc-800">
                    Nama Produk & Qty
                  </th>
                )}

                {/* Alasan (Reason) */}
                {isColVisible("alasan") && (
                  <th className="py-2.5 px-4 min-w-[240px] border-r border-zinc-200 dark:border-zinc-800">
                    Alasan (Reason)
                  </th>
                )}

                {/* Tgl Selesai */}
                {isColVisible("tgl_selesai") && (
                  <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                    Tgl Selesai
                  </th>
                )}

                {/* Days Today */}
                {isColVisible("days_today") && (
                  <th className="py-2.5 px-2.5 text-center whitespace-nowrap w-20 border-r border-zinc-200 dark:border-zinc-800" title="Days until Today (Hari sejak lapor)">
                    Days Today
                  </th>
                )}

                {/* Days Until Close */}
                {isColVisible("days_close") && (
                  <th className="py-2.5 px-2.5 text-center whitespace-nowrap w-24 border-r border-zinc-200 dark:border-zinc-800" title="Days until close (#N/A jika belum selesai)">
                    Days Close
                  </th>
                )}

                {/* Tindakan */}
                {isColVisible("tindakan") && (
                  <th className="py-2.5 px-3 min-w-[160px] border-r border-zinc-200 dark:border-zinc-800">
                    Tindakan
                  </th>
                )}

                {/* Aksi (Sticky Right) */}
                <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap sticky right-0 z-20 bg-zinc-100 dark:bg-[#070b14] border-l border-zinc-200 dark:border-zinc-800 shadow-[-3px_0_6px_rgba(0,0,0,0.06)]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 dark:divide-slate-800/50 bg-white dark:bg-[#0a0f1c]">
              {loading && returns.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-16 text-center text-zinc-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span className="font-semibold text-sm">Memuat data tiket komplain & retur...</span>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-16 text-center text-zinc-400">
                    <RotateCcw className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
                    <p className="font-semibold text-sm text-zinc-600 dark:text-slate-400">Tidak ada tiket komplain/retur yang cocok</p>
                    <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">Gunakan kata kunci lain atau ubah status filter.</p>
                  </td>
                </tr>
              ) : (
                returns.map((r) => {
                  const isResolved = (r.status || "").toLowerCase().includes("resolved");
                  const isPending = (r.status || "").toLowerCase().includes("pending");
                  const isExpanded = selectedReturn?.id === r.id;

                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setSelectedReturn((prev) => (prev?.id === r.id ? null : r))}
                        className={`group hover:bg-zinc-100/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          isExpanded
                            ? "bg-indigo-50/70 dark:bg-slate-800/60 font-semibold border-l-4 border-l-indigo-600 dark:border-l-indigo-500"
                            : ""
                        }`}
                      >
                        {/* PBF */}
                        {isColVisible("pbf") && (
                          <td
                            className={`py-2.5 px-3 border-r border-zinc-200 dark:border-zinc-800 ${
                              freezeColLevel === "1"
                                ? "sticky left-0 z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50/70 dark:group-hover:bg-slate-800/60 border-r-2 border-r-blue-500 shadow-md"
                                : freezeColLevel === "2" || freezeColLevel === "3"
                                ? "sticky left-0 z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50/70 dark:group-hover:bg-slate-800/60"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  r.pbf === "MAI"
                                    ? "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30"
                                    : "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                                }`}
                              >
                                {r.pbf && r.pbf !== "#N/A" ? r.pbf : "MBI"}
                              </span>
                              {r.week ? (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 cursor-pointer hover:bg-emerald-200"
                                  title={`Klik untuk filter ke Week ${r.week}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWeekFilter(String(r.week));
                                    setPage(0);
                                  }}
                                >
                                  W{r.week}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        )}

                        {/* Nama Apotek (Locked Always Visible) */}
                        <td
                          className={`py-2.5 px-4 font-bold text-black dark:text-slate-100 border-r border-zinc-200 dark:border-zinc-800 ${
                            freezeColLevel === "2"
                              ? `sticky z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50/70 dark:group-hover:bg-slate-800/60 border-r-2 border-r-blue-500 shadow-md ${
                                  isColVisible("pbf") ? "left-[80px]" : "left-0"
                                }`
                              : freezeColLevel === "3"
                              ? `sticky z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50/70 dark:group-hover:bg-slate-800/60 ${
                                  isColVisible("pbf") ? "left-[80px]" : "left-0"
                                }`
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="whitespace-normal break-words leading-snug" title={r.customer_name}>
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

                        {/* No. Faktur */}
                        {isColVisible("no_faktur") && (
                          <td
                            className={`py-2.5 px-3 font-mono text-[11px] border-r border-zinc-200 dark:border-zinc-800 ${
                              freezeColLevel === "3"
                                ? `sticky z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50/70 dark:group-hover:bg-slate-800/60 border-r-2 border-r-blue-500 shadow-md ${
                                    isColVisible("pbf") ? "left-[320px]" : "left-[240px]"
                                  }`
                                : ""
                            }`}
                          >
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
                        )}

                        {/* Status Tiket (Langsung di samping No Faktur) */}
                        {isColVisible("status") && (
                          <td className="py-2.5 px-3 text-center border-r border-zinc-200 dark:border-zinc-800">
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
                        )}

                        {/* Tgl Faktur */}
                        {isColVisible("tgl_faktur") && (
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap text-zinc-700 dark:text-slate-300 border-r border-zinc-200 dark:border-zinc-800">
                            {getInvoiceDate(r) ? (
                              <span className="inline-flex items-center gap-1 font-semibold" title="Tanggal Faktur (dari daftar faktur)">
                                <Calendar className="w-3 h-3 text-zinc-400 shrink-0" />
                                <span>{formatDate(getInvoiceDate(r))}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-slate-600">-</span>
                            )}
                          </td>
                        )}

                        {/* Tgl Lapor / Report Date */}
                        {isColVisible("tgl_lapor") && (
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap text-zinc-700 dark:text-slate-300 border-r border-zinc-200 dark:border-zinc-800">
                            {r.report_date && r.report_date !== "#N/A" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400" title="Tanggal Dilaporkan">
                                <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>{formatDate(r.report_date)}</span>
                              </span>
                            ) : r.created_at ? (
                              <span className="inline-flex items-center gap-1 font-medium text-zinc-500 dark:text-slate-400" title="Tanggal Dibuat di Sistem">
                                <Calendar className="w-3 h-3 text-zinc-400 shrink-0" />
                                <span>{formatDate(r.created_at.split(" ")[0])}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-slate-600">-</span>
                            )}
                          </td>
                        )}

                        {/* No. SO */}
                        {isColVisible("no_so") && (
                          <td className="py-2.5 px-3 font-mono text-zinc-600 dark:text-slate-400 text-[11px] border-r border-zinc-200 dark:border-zinc-800">
                            {r.so_no && r.so_no !== "#N/A" ? r.so_no : "-"}
                          </td>
                        )}

                        {/* Nama Produk & Qty (No Cutoff) */}
                        {isColVisible("produk") && (
                          <td className="py-2.5 px-4 min-w-[220px] max-w-[340px] border-r border-zinc-200 dark:border-zinc-800">
                            <p className="font-bold text-black dark:text-slate-200 whitespace-normal break-words leading-snug" title={r.product_name}>
                              {r.product_name && r.product_name !== "#N/A" ? r.product_name : "-"}
                            </p>
                            <p className="text-[10px] text-zinc-600 dark:text-slate-400 mt-0.5">
                              Qty: <strong className="text-black dark:text-slate-200">{r.qty || 1}</strong>
                              {r.batch_no && r.batch_no !== "#N/A" && ` • Batch: ${r.batch_no}`}
                            </p>
                            {r.photo_url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewPhotoUrl(r.photo_url || null);
                                }}
                                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 border border-violet-200 dark:border-violet-700 hover:scale-105 transition-all shadow-xs cursor-pointer"
                                title="Lihat foto bukti kerusakan dari apotek"
                              >
                                <Camera className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                                <span>Foto Bukti</span>
                              </button>
                            )}
                          </td>
                        )}

                        {/* Alasan (Reason) (No Cutoff) */}
                        {isColVisible("alasan") && (
                          <td className="py-2.5 px-4 min-w-[200px] max-w-[300px] border-r border-zinc-200 dark:border-zinc-800">
                            <span className="block text-zinc-800 dark:text-slate-300 font-semibold whitespace-normal break-words leading-relaxed" title={r.reason}>
                              {r.reason && r.reason !== "#N/A" ? r.reason : "-"}
                            </span>
                            {r.root_cause && r.root_cause !== "#N/A" && (
                              <span className="text-[10px] text-zinc-500 dark:text-slate-500 block mt-0.5 whitespace-normal break-words">
                                Penyebab: {r.root_cause}
                              </span>
                            )}
                            {r.person && r.person !== "#N/A" && (
                              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block mt-0.5">
                                Pelaku: {r.person}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Tgl Selesai */}
                        {isColVisible("tgl_selesai") && (
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                            {r.resolved_date && r.resolved_date !== "#N/A" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60" title="Tanggal Penyelesaian Tiket">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>{formatDate(r.resolved_date)}</span>
                              </span>
                            ) : isResolved ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Selesai</span>
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-slate-600 italic text-[10px]">-</span>
                            )}
                          </td>
                        )}

                        {/* Days Today */}
                        {isColVisible("days_today") && (
                          <td className="py-2.5 px-2.5 text-center font-mono text-[11px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                            {(() => {
                              const d = calculateDaysUntilToday(r.report_date);
                              return d === "-" ? (
                                <span className="text-zinc-400 dark:text-slate-600">-</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 border border-zinc-200 dark:border-slate-700">
                                  {d} hr
                                </span>
                              );
                            })()}
                          </td>
                        )}

                        {/* Days Until Close */}
                        {isColVisible("days_close") && (
                          <td className="py-2.5 px-2.5 text-center font-mono text-[11px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800">
                            {(() => {
                              const d = calculateDaysUntilClose(r.report_date, r.resolved_date, r.status);
                              if (d === "#N/A") {
                                return (
                                  <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60" title="Belum Selesai / Close">
                                    #N/A
                                  </span>
                                );
                              }
                              return (
                                <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60" title={`Selesai dalam ${d} hari`}>
                                  {d} hr
                                </span>
                              );
                            })()}
                          </td>
                        )}

                        {/* Tindakan */}
                        {isColVisible("tindakan") && (
                          <td className="py-2.5 px-3 text-zinc-800 dark:text-slate-300 min-w-[150px] max-w-[240px] font-medium border-r border-zinc-200 dark:border-zinc-800 whitespace-normal break-words leading-snug">
                            {r.action && r.action !== "#N/A" ? r.action : "-"}
                          </td>
                        )}

                        {/* Aksi (Sticky Right) */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 z-20 bg-white dark:bg-[#0a0f1c] group-hover:bg-blue-50/70 dark:group-hover:bg-slate-800/60 border-l border-zinc-200 dark:border-zinc-800 shadow-[-3px_0_6px_rgba(0,0,0,0.06)]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReturn((prev) => (prev?.id === r.id ? null : r));
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-xs ${
                              isExpanded
                                ? "bg-black text-white dark:bg-indigo-600 border-black dark:border-indigo-500"
                                : "bg-zinc-100 hover:bg-zinc-200 text-black border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {isExpanded ? "Tutup" : "Edit / Tindakan"}
                          </button>
                        </td>
                      </tr>

                      {/* â”€â”€â”€ OPSI 4: EXPANDABLE ROW (AKORDEON) â”€â”€â”€ */}
                      {/* ─── EXPANDABLE ROW (AKORDEON) ─── */}
                      {isExpanded && (
                        <tr className="bg-zinc-100/90 dark:bg-[#070b16] border-y-2 border-indigo-500/50 animate-in fade-in duration-150">
                          <td colSpan={14} className="p-2 sm:p-3">
                            {renderAccordionContent(r)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Datalist Auto-suggestions for Person (Pelaku Kesalahan) */}
        

        {/* â”€â”€â”€ Pagination Footer â”€â”€â”€ */}
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
      </div>
      )}

      {/* ─── TAB 2: LEADERBOARD PERSONIL (PELAKU KESALAHAN GUDANG) ─── */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-zinc-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Kesalahan Personil Gudang
              </span>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {totalPersonnelErrors.toLocaleString("id-ID")} Kasus
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-slate-500 mt-1">
                Tercatat di data shipment return
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-zinc-500 dark:text-slate-400 uppercase tracking-wider block">
                Jumlah Personil Terlibat
              </span>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                {filteredPersonnel.length} Orang
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-slate-500 mt-1">
                {personnelFilterPbf === "MAI" ? "Picker & Checker MAI" : personnelFilterPbf === "MBI" ? "Picker & Checker MBI" : "Picker & Checker MBI & MAI"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-zinc-500 dark:text-slate-400 uppercase tracking-wider block">
                Rata-rata Kasus per Personil
              </span>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {filteredPersonnel.length
                  ? (totalPersonnelErrors / filteredPersonnel.length).toFixed(1)
                  : 0}{" "}
                Kasus
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-slate-500 mt-1">
                Tingkat distribusi kesalahan
              </p>
            </div>
          </div>

          {/* Top 3 Spotlight Cards (Matching Friend's Apps Script App) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Rank 1 (Gold) */}
            {filteredPersonnel[0] && (() => {
              const p0 = filteredPersonnel[0];
              const c0 = personnelFilterPbf === "MAI" ? Number(p0.mai_cases || 0) : personnelFilterPbf === "MBI" ? Number(p0.mbi_cases || 0) : Number(p0.total_cases || 0);
              const pct0 = totalPersonnelErrors > 0 ? ((c0 / totalPersonnelErrors) * 100).toFixed(1) : "0";
              return (
              <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/70 dark:border-amber-400/50 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500 text-black flex items-center gap-1 font-mono">
                      <Trophy className="w-3 h-3 text-black" />
                      <span>PERINGKAT #1</span>
                    </span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {pct0}% dari total
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mt-2.5 truncate" title={p0.person}>
                    {p0.person}
                  </h4>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                      {c0}
                    </span>
                    <span className="text-xs font-bold text-zinc-600 dark:text-slate-400">
                      Kesalahan Pengiriman {personnelFilterPbf !== "ALL" ? `(${personnelFilterPbf})` : ""}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-300/40 dark:border-amber-500/20 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                      MBI: {p0.mbi_cases || 0}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold">
                      MAI: {p0.mai_cases || 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(p0.person);
                      setActiveTab("list");
                    }}
                    className="text-xs text-amber-700 dark:text-amber-300 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lihat Tiket</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              );
            })()}

            {/* Rank 2 (Silver) */}
            {filteredPersonnel[1] && (() => {
              const p1 = filteredPersonnel[1];
              const c1 = personnelFilterPbf === "MAI" ? Number(p1.mai_cases || 0) : personnelFilterPbf === "MBI" ? Number(p1.mbi_cases || 0) : Number(p1.total_cases || 0);
              const pct1 = totalPersonnelErrors > 0 ? ((c1 / totalPersonnelErrors) * 100).toFixed(1) : "0";
              return (
              <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-300/20 via-slate-400/5 to-transparent border border-slate-300 dark:border-slate-600 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1 font-mono">
                      <Medal className="w-3 h-3" />
                      <span>PERINGKAT #2</span>
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {pct1}% dari total
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mt-2.5 truncate" title={p1.person}>
                    {p1.person}
                  </h4>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                      {c1}
                    </span>
                    <span className="text-xs font-bold text-zinc-600 dark:text-slate-400">
                      Kesalahan Pengiriman {personnelFilterPbf !== "ALL" ? `(${personnelFilterPbf})` : ""}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                      MBI: {p1.mbi_cases || 0}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold">
                      MAI: {p1.mai_cases || 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(p1.person);
                      setActiveTab("list");
                    }}
                    className="text-xs text-zinc-700 dark:text-slate-300 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lihat Tiket</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              );
            })()}

            {/* Rank 3 (Bronze) */}
            {filteredPersonnel[2] && (() => {
              const p2 = filteredPersonnel[2];
              const c2 = personnelFilterPbf === "MAI" ? Number(p2.mai_cases || 0) : personnelFilterPbf === "MBI" ? Number(p2.mbi_cases || 0) : Number(p2.total_cases || 0);
              const pct2 = totalPersonnelErrors > 0 ? ((c2 / totalPersonnelErrors) * 100).toFixed(1) : "0";
              return (
              <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-700/10 via-amber-800/5 to-transparent border border-amber-600/40 dark:border-amber-700/50 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-700/20 text-amber-800 dark:text-amber-300 flex items-center gap-1 font-mono">
                      <Award className="w-3 h-3" />
                      <span>PERINGKAT #3</span>
                    </span>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      {pct2}% dari total
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mt-2.5 truncate" title={p2.person}>
                    {p2.person}
                  </h4>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                      {c2}
                    </span>
                    <span className="text-xs font-bold text-zinc-600 dark:text-slate-400">
                      Kesalahan Pengiriman {personnelFilterPbf !== "ALL" ? `(${personnelFilterPbf})` : ""}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-600/20 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                      MBI: {p2.mbi_cases || 0}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold">
                      MAI: {p2.mai_cases || 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(p2.person);
                      setActiveTab("list");
                    }}
                    className="text-xs text-amber-700 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lihat Tiket</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              );
            })()}
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={personnelSearchQuery}
                onChange={(e) => setPersonnelSearchQuery(e.target.value)}
                placeholder="Cari nama personil (picker / checker)..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-slate-950 border border-zinc-200 dark:border-slate-700 rounded-xl outline-none focus:border-black dark:focus:border-white transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Bulan Leaderboard */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase tracking-wider">Bulan:</span>
                <select
                  value={monthFilter}
                  onChange={(e) => {
                    const m = e.target.value;
                    setMonthFilter(m);
                    fetchPersonnelStats(m, weekFilter);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">Semua Bulan (Jan - Okt 2026)</option>
                  <option value="10">Oktober 2026</option>
                  <option value="9">September 2026</option>
                  <option value="8">Agustus 2026</option>
                  <option value="7">Juli 2026</option>
                  <option value="6">Juni 2026</option>
                  <option value="5">Mei 2026</option>
                  <option value="4">April 2026</option>
                  <option value="3">Maret 2026</option>
                  <option value="2">Februari 2026</option>
                  <option value="1">Januari 2026</option>
                </select>
              </div>

              {/* Filter Week Leaderboard */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
                <CalendarRange className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase tracking-wider">Week:</span>
                <select
                  value={weekFilter}
                  onChange={(e) => {
                    const w = e.target.value;
                    setWeekFilter(w);
                    fetchPersonnelStats(monthFilter, w);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">Semua Week (W1 - W{Math.max(43, currentWeekNumber)})</option>
                  <option value={String(currentWeekNumber)}>Week Sekarang (W{currentWeekNumber})</option>
                  <option disabled>──────────</option>
                  {availableWeeks.map((w) => (
                    <option key={w} value={String(w)}>
                      W{w} {w === currentWeekNumber ? "(Minggu Ini)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter PBF Buttons */}
              <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
                {[
                  { id: "ALL", label: "Semua PBF" },
                  { id: "MBI", label: "MBI Saja" },
                  { id: "MAI", label: "MAI Saja" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersonnelFilterPbf(p.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      personnelFilterPbf === p.id
                        ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                        : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Leaderboard Table with Horizontal Progress Bars */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-slate-950 text-zinc-600 dark:text-slate-400 font-bold border-b border-zinc-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-14 text-center">Rank</th>
                  <th className="py-3 px-4">Nama Personil</th>
                  <th className="py-3 px-4">Intensitas & Total Kesalahan</th>
                  <th className="py-3 px-3 text-center">MBI</th>
                  <th className="py-3 px-3 text-center">MAI</th>
                  <th className="py-3 px-3 text-center">Selesai</th>
                  <th className="py-3 px-3 text-center">Pending</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-slate-800">
                {filteredPersonnel.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400 dark:text-slate-500">
                      Tidak ada data personil yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredPersonnel.map((p, idx) => {
                    const displayCases =
                      personnelFilterPbf === "MAI"
                        ? Number(p.mai_cases || 0)
                        : personnelFilterPbf === "MBI"
                        ? Number(p.mbi_cases || 0)
                        : Number(p.total_cases || 0);
                    const percent = Math.round((displayCases / maxPersonnelCases) * 100);
                    return (
                      <tr
                        key={p.person}
                        className="hover:bg-zinc-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                              idx === 0
                                ? "bg-amber-400 text-black shadow-xs"
                                : idx === 1
                                ? "bg-slate-300 dark:bg-slate-600 text-black dark:text-white"
                                : idx === 2
                                ? "bg-amber-700/40 text-amber-800 dark:text-amber-300"
                                : "text-zinc-500 dark:text-slate-400 font-mono"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                          <span className="truncate block max-w-[200px]" title={p.person}>
                            {p.person}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 font-black text-rose-600 dark:text-rose-400 text-sm">
                              {displayCases}
                            </span>
                            <div className="flex-1 max-w-xs h-2.5 bg-zinc-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  idx === 0
                                    ? "bg-rose-500"
                                    : idx < 3
                                    ? "bg-amber-500"
                                    : "bg-indigo-500"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-zinc-400 dark:text-slate-500 w-10 text-right">
                              {totalPersonnelErrors > 0
                                ? ((displayCases / totalPersonnelErrors) * 100).toFixed(0)
                                : 0}
                              %
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-blue-600 dark:text-blue-400">
                          {p.mbi_cases || 0}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-purple-600 dark:text-purple-400">
                          {p.mai_cases || 0}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {p.resolved_cases || 0}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-600 dark:text-amber-400">
                          {p.pending_cases || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSearch(p.person);
                              setActiveTab("list");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-800 dark:text-slate-200 font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Lihat Tiket
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: ANALISIS & ROOT CAUSE ─── */}
      {activeTab === "analisis" && (
        <AnalisisView returns={allReturns.length > 0 ? allReturns : returns} />
      )}

      {/* â”€â”€â”€ ADD NEW RETURN MODAL â”€â”€â”€ */}
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

            {/* Standalone Shareable Form Tip */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs text-slate-300">
              <span className="text-[11px] text-slate-400">
                Bagikan form mandiri ke sales / apotek:
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyComplaintLink}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {linkCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-indigo-400" />}
                  <span>{linkCopied ? "Tersalin!" : "Salin Link"}</span>
                </button>
                <a
                  href="/komplain"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white flex items-center gap-1 transition-colors"
                >
                  <span>Buka Form</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

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
                    <option value="">-- Belum Ditentukan --</option>
                    <option value="1P">1P</option>
                    <option value="2P">2P</option>
                    <option value="3P">3P</option>
                  </select>
                </div>
              </div>

              <div className="relative">
                <label className="text-slate-400 block mb-1">Nama Apotek / RS / Merchant *</label>
                <input
                  type="text"
                  required
                  value={newForm.customer_name}
                  onChange={(e) => {
                    setNewForm({ ...newForm, customer_name: e.target.value });
                    setShowAddCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowAddCustomerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowAddCustomerSuggestions(false), 250)}
                  placeholder="Ketik nama apotek atau merchant..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200"
                />
                {showAddCustomerSuggestions && addCustomerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto py-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      Saran Nama Apotek ({addCustomerSuggestions.length})
                    </div>
                    {addCustomerSuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewForm({ ...newForm, customer_name: name });
                          setShowAddCustomerSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer border-b border-slate-800/40 last:border-b-0"
                      >
                        <span className="font-semibold truncate">{name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className="text-slate-400 block mb-1">Tanggal Lapor</label>
                  <input
                    type="date"
                    value={newForm.report_date}
                    onChange={(e) => setNewForm({ ...newForm, report_date: e.target.value })}
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
                  {COMPLAINT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
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

      {/* ─── FULLSCREEN PHOTO PREVIEW MODAL ─── */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 border-b border-zinc-800 mb-2">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-violet-400" />
                <span>Foto Bukti Kerusakan / Retur dari Apotek</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewPhotoUrl}
                  download="bukti-retur.jpg"
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Unduh foto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unduh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewPhotoUrl(null)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[75vh] flex items-center justify-center p-1">
              <img
                src={previewPhotoUrl}
                alt="Bukti Retur Full"
                className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}