"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";
import { broadcastRealtimeSignal, subscribeToRealtimeSignal, isSuperAdminUser, broadcastNewComplaint } from "@/lib/firestoreService";
import { AppUser } from "@/components/LoginModal";
import { recordActivityLog } from "@/lib/activityLogger";
import {
  AlertCircle,
  AlertTriangle,
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
  BookOpen,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table,
  Video,
} from "lucide-react";
import * as XLSX from "xlsx";
import OverviewKpiView from "./returns/OverviewKpiView";
import HowToUseModal from "@/components/HowToUseModal";
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

export const calculateDaysUntilClose = (
  reportDateStr?: string | null,
  resolvedDateStr?: string | null,
  status?: string | null,
  invoiceDateStr?: string | null
): number | string => {
  const isResolved =
    (status || "").toLowerCase().includes("resolved") ||
    (status || "").toLowerCase().includes("selesai");
  if (!isResolved) return "#N/A";

  const effectiveResolved =
    resolvedDateStr && resolvedDateStr !== "#N/A" && resolvedDateStr !== "-"
      ? resolvedDateStr
      : (reportDateStr && reportDateStr !== "#N/A" && reportDateStr !== "-" ? reportDateStr : (invoiceDateStr || ""));

  const effectiveReport =
    reportDateStr && reportDateStr !== "#N/A" && reportDateStr !== "-"
      ? reportDateStr
      : (invoiceDateStr || effectiveResolved || "");

  if (!effectiveResolved || !effectiveReport) return 0;

  try {
    const rep = new Date(effectiveReport);
    const res = new Date(effectiveResolved);
    if (isNaN(rep.getTime()) || isNaN(res.getTime())) return 0;
    return Math.max(0, Math.floor((res.getTime() - rep.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
};

interface ReturnsViewProps {
  onSelectCustomer?: (customerName: string) => void;
  onSelectInvoice?: (invoiceNo: string) => void;
  records?: FakturRecord[];
  currentUser?: AppUser | null;
}

// Module-level in-memory cache to prevent re-loading when switching tabs
let cachedReturnsData: ShipmentReturnRecord[] | null = null;
let cachedTotalCount: number = 0;
let cachedReturnsStats: any = null;
let cachedAllReturnsData: ShipmentReturnRecord[] | null = null;

export default function ReturnsView({ onSelectCustomer, onSelectInvoice, records, currentUser }: ReturnsViewProps) {
  const [returns, setReturns] = useState<ShipmentReturnRecord[]>(() => cachedReturnsData || []);

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
  const [loading, setLoading] = useState(() => !cachedReturnsData);
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
    const maxW = Math.max(45, currentWeekNumber);
    const list: number[] = [];
    for (let w = maxW; w >= 1; w--) {
      list.push(w);
    }
    return list;
  }, [currentWeekNumber]);

  const threeWeekBlocks = useMemo(() => {
    const maxW = availableWeeks[0] || 45;
    const blocks: { id: string; min: number; max: number; label: string }[] = [];
    for (let end = maxW; end >= 1; end -= 3) {
      const start = Math.max(1, end - 2);
      blocks.push({
        id: `3W:${start}-${end}`,
        min: start,
        max: end,
        label: `W${start} – W${end} (3 Minggu)`,
      });
    }
    return blocks;
  }, [availableWeeks]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(() => cachedTotalCount);

  // ─── Spreadsheet Freeze & Column Visibility States ───
  const [showKpiSummary, setShowKpiSummary] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("returns_show_kpi_summary");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });

  const toggleKpiSummary = () => {
    setShowKpiSummary((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("returns_show_kpi_summary", String(next));
        }
      } catch {}
      return next;
    });
  };

  const [tableViewMode, setTableViewMode] = useState<"smart" | "spreadsheet">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ret_table_view_mode") as "smart" | "spreadsheet") || "smart";
    }
    return "smart";
  });

  const handleTableViewModeChange = (mode: "smart" | "spreadsheet") => {
    setTableViewMode(mode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ret_table_view_mode", mode);
      } catch {}
    }
  };

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
  const [stats, setStats] = useState(() => cachedReturnsStats || {
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
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmResolveItem, setConfirmResolveItem] = useState<ShipmentReturnRecord | null>(null);
  const [showDeliveryPrepModal, setShowDeliveryPrepModal] = useState(false);
  const [showConfirmApproveModal, setShowConfirmApproveModal] = useState(false);
  const [showConfirmRejectModal, setShowConfirmRejectModal] = useState(false);
  const [validationModal, setValidationModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    message: string;
    missingFields?: string[];
    note?: string;
    type?: "warning" | "error" | "info";
    onConfirmText?: string;
    onConfirm?: () => void;
  } | null>(null);

  // One-time onboarding workflow popup
  const [showSopAnnouncement, setShowSopAnnouncement] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const seen = localStorage.getItem("has_seen_shipment_sop_announcement_v3");
        if (!seen) {
          setShowSopAnnouncement(true);
        }
      } catch {}
    }
  }, []);

  const handleDismissSopAnnouncement = () => {
    setShowSopAnnouncement(false);
    try {
      localStorage.setItem("has_seen_shipment_sop_announcement_v3", "true");
      localStorage.setItem("has_seen_shipment_workflow_v2", "true");
    } catch {}
  };

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
  const [allReturns, setAllReturns] = useState<ShipmentReturnRecord[]>(() => cachedAllReturnsData || []);
  const [personnelStats, setPersonnelStats] = useState<{
    personnel: any[];
    rootCauses: any[];
    reasons: any[];
    pbfComparison: any[];
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [personnelFilterPbf, setPersonnelFilterPbf] = useState<string>("ALL");
  const [personnelReasonFilter, setPersonnelReasonFilter] = useState<string>("ALL");
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState<string>("");
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [loadingPhotoId, setLoadingPhotoId] = useState<number | null>(null);

  const handlePreviewPhoto = useCallback(async (r: ShipmentReturnRecord | any) => {
    if (r.photo_url) {
      setPreviewPhotoUrl(r.photo_url);
      return;
    }
    if ((r as any).has_photo || r.photo_url) {
      try {
        setLoadingPhotoId(r.id);
        const res = await fetch(`/api/tidb?action=return_photo&id=${r.id}`);
        const data = await res.json();
        if (data.photo_url) {
          r.photo_url = data.photo_url;
          setPreviewPhotoUrl(data.photo_url);
        }
      } catch (err) {
        console.error("Failed to fetch photo proof:", err);
      } finally {
        setLoadingPhotoId(null);
      }
    }
  }, []);

  // Single-pass O(N) memoized statistics for extreme performance (<1ms)
  const statusMetrics = useMemo(() => {
    const list = allReturns.length > 0 ? allReturns : returns;
    let pending = 0;
    let inProgress = 0;
    let inProgressOperasional = 0;
    let inProgressKlaim = 0;
    let resolved = 0;
    let rejected = 0;

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const st = (r.status || "").trim().toLowerCase();

      if (st === "rejected" || st.includes("reject") || st.includes("tolak")) {
        rejected++;
      } else if (st === "resolved" || st.includes("selesai")) {
        resolved++;
      } else if (st === "in progress" || st.startsWith("in progress")) {
        inProgress++;
        const isOp = r.inprogress_type === "Operasional" || (
          !r.inprogress_type && [
            "fisik yang dikirim kurang",
            "fisik yang dikirim lebih",
            "fisik yang dikirim salah",
            "fisik yang dikirim tidak ada",
          ].some((k) =>
            (r.description || "").toLowerCase().includes(k) ||
            (r.reason || "").toLowerCase().includes(k)
          )
        );
        if (isOp) {
          inProgressOperasional++;
        } else {
          inProgressKlaim++;
        }
      } else {
        pending++;
      }
    }

    return {
      pending,
      inProgress,
      inProgressOperasional,
      inProgressKlaim,
      resolved,
      rejected,
      total: list.length,
    };
  }, [allReturns, returns]);

  const openCasesCount = statusMetrics.inProgress;
  const rejectCasesCount = statusMetrics.rejected;
  const pendingCasesCount = stats.totalPending !== undefined ? Number(stats.totalPending) : statusMetrics.pending;
  const inProgressCasesCount = (stats as any).totalInProgress !== undefined ? Number((stats as any).totalInProgress) : statusMetrics.inProgress;
  const inProgressOperasionalCount = (stats as any).totalInProgressOperasional !== undefined ? Number((stats as any).totalInProgressOperasional) : statusMetrics.inProgressOperasional;
  const inProgressKlaimCount = (stats as any).totalInProgressKlaim !== undefined ? Number((stats as any).totalInProgressKlaim) : statusMetrics.inProgressKlaim;
  const resolvedCasesCount = stats.totalResolved !== undefined ? Number(stats.totalResolved) : statusMetrics.resolved;
  const rejectedCasesCount = stats.totalReject !== undefined ? Number(stats.totalReject) : statusMetrics.rejected;

  // Fetch all returns for analytic tabs (prioritizes memory cache, backed by Edge CDN)
  const fetchAllReturns = useCallback(async (forceFresh = false) => {
    // If not forcing fresh and we already have cached data in memory, prioritize instant memory read (<1ms)
    if (!forceFresh && cachedAllReturnsData && cachedAllReturnsData.length > 0) {
      setAllReturns(cachedAllReturnsData);
      return;
    }
    try {
      const url = `/api/tidb?action=returns&limit=5000`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAllReturns(json.data);
        cachedAllReturnsData = json.data;
      }
    } catch (e) {
      console.error("fetchAllReturns error:", e);
    }
  }, []);

  // Lazy-load allReturns ONLY when analytic tabs are open (Zero Lag on main list view)
  useEffect(() => {
    if (activeTab !== "list") {
      fetchAllReturns();
    }
  }, [activeTab, fetchAllReturns]);

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

  const fetchPersonnelStats = useCallback(async (selectedMonth = monthFilter, selectedWeek = weekFilter, selectedReason = personnelReasonFilter) => {
    setLoadingStats(true);
    try {
      const q = new URLSearchParams({ 
        action: "personnel_stats",
      });
      if (selectedMonth && selectedMonth !== "ALL") q.set("month", selectedMonth);
      if (selectedWeek && selectedWeek !== "ALL") q.set("week", selectedWeek);
      if (selectedReason && selectedReason !== "ALL") q.set("reason", selectedReason);
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
  }, [monthFilter, weekFilter, personnelReasonFilter]);

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
    video_url: "",
    reject_reason: "",
    reject_media_url: "",
    inprogress_type: "",
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
        video_url: selectedReturn.video_url || "",
        reject_reason: selectedReturn.reject_reason || "",
        reject_media_url: selectedReturn.reject_media_url || "",
        inprogress_type: selectedReturn.inprogress_type || "",
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
    video_url: "",
    reject_reason: "",
    reject_media_url: "",
    inprogress_type: "",
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

  const fetchReturns = useCallback(async (silent = false, _forceFresh = false) => {
    if (!silent) setLoading(true);
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
      if (monthFilter !== "ALL") params.set("month", monthFilter);
      if (weekFilter !== "ALL") params.set("week", weekFilter);

      const res = await fetch(`/api/tidb?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReturns(data.data || []);
        setTotal(data.total || 0);
        if (data.stats) setStats(data.stats);
        cachedReturnsData = data.data || [];
        cachedTotalCount = data.total || 0;
        if (data.stats) cachedReturnsStats = data.stats;
      }
    } catch (err) {
      console.error("Failed to fetch returns:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [debouncedSearch, statusFilter, pbfFilter, categoryFilter, monthFilter, weekFilter, page]);

  // Stable Ref Guards to eliminate listener churn & prevent 5000-row storm
  const fetchReturnsRef = useRef(fetchReturns);
  fetchReturnsRef.current = fetchReturns;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const fetchAllReturnsRef = useRef(fetchAllReturns);
  fetchAllReturnsRef.current = fetchAllReturns;

  // Single query for active page when filters change (Limit 50 - <50ms)
  useEffect(() => {
    const hasCache = Boolean(cachedReturnsData && cachedReturnsData.length > 0);
    fetchReturns(hasCache);
  }, [fetchReturns]);

  // Real-time Firestore cross-browser signal (Mounted ONCE with Zero Listener Churn)
  useEffect(() => {
    let debounceTimer: any = null;
    const unsubRealtime = subscribeToRealtimeSignal("returns", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchReturnsRef.current(true, true);
        if (activeTabRef.current !== "list") {
          fetchAllReturnsRef.current(true);
        }
        fetchPersonnelStats();
      }, 500);
    });

    const onFocus = () => {
      const now = Date.now();
      // Throttle focus refetch to at most once per 5 minutes to prevent origin leakage
      if (now - lastFocusFetchRef.current > 300000) {
        lastFocusFetchRef.current = now;
        fetchReturnsRef.current(true);
      }
    };
    window.addEventListener("focus", onFocus);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubRealtime();
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchPersonnelStats]);

  // INSTANT OPTIMISTIC DELETE (<1ms) - Identik dengan kecepatan Meja Kerja Faktur
  const handleDeleteReturn = async (id: number, invoiceNo: string) => {
    if (!canDeleteReturns) {
      alert("Akses Ditolak: Akun Anda tidak memiliki hak akses untuk menghapus data. Hubungi Farhan (Super Admin).");
      return;
    }
    if (!confirm(`Hapus tiket komplain untuk faktur "${invoiceNo || id}"?\n\nData akan dihapus permanen dari sistem Fantastic Order.`)) {
      return;
    }

    // 1. INSTANT OPTIMISTIC PURGE (<1ms) - Seketika hilang dari layar
    const deletedItem = returns.find((r) => r.id === id);
    setReturns((prev) => prev.filter((r) => r.id !== id));
    setAllReturns((prev) => prev.filter((r) => r.id !== id));
    if (cachedReturnsData) {
      cachedReturnsData = cachedReturnsData.filter((r) => r.id !== id);
    }
    if (cachedAllReturnsData) {
      cachedAllReturnsData = cachedAllReturnsData.filter((r) => r.id !== id);
    }
    setTotal((prev) => Math.max(0, prev - 1));
    if (selectedReturn?.id === id) {
      setSelectedReturn(null);
    }

    // Optimistic Local Stats Decrement
    if (deletedItem) {
      const st = (deletedItem.status || "").toLowerCase();
      setStats((prev: any) => {
        const next = { ...prev };
        if (st.includes("in progress")) {
          next.totalInProgress = Math.max(0, (next.totalInProgress || 1) - 1);
          if (deletedItem.inprogress_type === "Operasional") {
            next.totalInProgressOperasional = Math.max(0, (next.totalInProgressOperasional || 1) - 1);
          } else {
            next.totalInProgressKlaim = Math.max(0, (next.totalInProgressKlaim || 1) - 1);
          }
        } else if (st.includes("pending")) {
          next.totalPending = Math.max(0, (next.totalPending || 1) - 1);
        } else if (st.includes("resolved")) {
          next.totalResolved = Math.max(0, (next.totalResolved || 1) - 1);
        } else if (st.includes("reject")) {
          next.totalReject = Math.max(0, (next.totalReject || 1) - 1);
        }
        return next;
      });
    }

    // 2. Background Asynchronous Persistence (Non-Blocking 0ms UI delay)
    try {
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
        broadcastRealtimeSignal("returns");
        recordActivityLog({
          action_type: "DELETE_RETURN",
          module: "SHIPMENT_ERROR",
          target_id: String(id),
          details: `Menghapus tiket komplain #${id} untuk faktur ${invoiceNo || "-"}`,
          metadata: { id, invoice_no: invoiceNo },
        });
      } else {
        alert("Gagal menghapus data di cloud: " + (data.error || "Unknown error"));
        fetchReturns(true, true);
      }
    } catch (err) {
      console.error("Error background delete:", err);
      fetchReturns(true, true);
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

  const handleSaveEdit = async (param?: boolean | React.MouseEvent) => {
    const skipDeliveryConfirm = param === true;
    if (!selectedReturn) return;
    if (!canEditReturns) {
      setValidationModal({
        isOpen: true,
        title: "Mode Hanya Lihat",
        message: "Akun Anda tidak memiliki hak akses mengubah modul Shipment Error. Hubungi Administrator untuk meminta akses.",
        type: "warning",
      });
      return;
    }

    // Form Guard Tahap 4: REJECTED wajib sertakan alasan penolakan + Konfirmasi
    const isRejecting = editForm.status === "Rejected" || editForm.confirm === "Reject";
    if (isRejecting) {
      if (!editForm.note || !editForm.note.trim()) {
        setValidationModal({
          isOpen: true,
          title: "Catatan Alasan Reject Wajib Diisi",
          subtitle: `Faktur #${editForm.invoice_no || selectedReturn.invoice_no} • ${editForm.customer_name || selectedReturn.customer_name}`,
          message: "Tiket yang ditolak (Reject) wajib menyertakan alasan penolakan pada kolom Catatan Balasan Logistik.",
          missingFields: ["Catatan Balasan Logistik / Alasan Penolakan"],
          note: "Catatan ini akan langsung terbaca oleh apotek pengaju komplain sebagai kejelasan penolakan.",
          type: "error",
          onConfirmText: "Isi Catatan Penolakan",
        });
        return;
      }
      if (!skipDeliveryConfirm && selectedReturn.status !== "Rejected") {
        setShowConfirmRejectModal(true);
        return;
      }
    }

    // Form Guard Tahap 2: ACC / IN PROGRESS konfirmasi kesalahan PBF
    const isApproveAcc = editForm.status === "In Progress" || editForm.confirm === "Approve";
    if (isApproveAcc && !skipDeliveryConfirm && selectedReturn.status !== "In Progress") {
      setShowConfirmApproveModal(true);
      return;
    }

    // Deteksi apakah jenis komplain adalah Klaim & Retur (personil tidak wajib)
    const isKlaimRetur = editForm.inprogress_type === "Klaim & Retur" || selectedReturn.inprogress_type === "Klaim & Retur" || (
      !editForm.inprogress_type && ![
        "fisik yang dikirim kurang",
        "fisik yang dikirim lebih",
        "fisik yang dikirim salah",
        "fisik yang dikirim tidak ada",
      ].some((k) =>
        (selectedReturn.description || "").toLowerCase().includes(k) ||
        (editForm.reason || "").toLowerCase().includes(k)
      )
    );

    // Form Guard Tahap 2 (Proses 1): Tiket yang SEDANG In Progress wajib lengkapi investigasi gudang
    const isCurrentlyInProgress = selectedReturn.status === "In Progress" && editForm.status === "In Progress";
    if (isCurrentlyInProgress) {
      const hasAction = editForm.action && editForm.action.trim() && editForm.action !== "-" && editForm.action !== "#N/A";
      const hasRootCause = editForm.root_cause && editForm.root_cause.trim() && editForm.root_cause !== "-" && editForm.root_cause !== "#N/A";
      const hasPerson = editForm.person && editForm.person.trim() && editForm.person !== "-" && editForm.person !== "#N/A";
      const isPersonRequired = !isKlaimRetur;

      if (!hasAction || !hasRootCause || (isPersonRequired && !hasPerson)) {
        const missing: string[] = [];
        if (!hasAction) missing.push("Tindakan Solusi Gudang (Action)");
        if (!hasRootCause) missing.push("Penyebab Kesalahan (Root Cause)");
        if (isPersonRequired && !hasPerson) missing.push("Personil Terkait (Picker / Checker)");

        setValidationModal({
          isOpen: true,
          title: "Data Investigasi Belum Lengkap",
          subtitle: `Faktur #${editForm.invoice_no || selectedReturn.invoice_no} • ${editForm.customer_name || selectedReturn.customer_name}`,
          message: "Untuk menyimpan tiket pada tahap In Progress, Anda wajib melengkapi data investigasi berikut:",
          missingFields: missing,
          note: isKlaimRetur ? "Catatan: Untuk jenis Klaim & Retur, nama personil opsional." : "Setelah data lengkap, fisik barang pengganti dapat disiapkan dan dikirim ke apotek.",
          type: "warning",
          onConfirmText: "Mengerti & Lengkapi Data",
        });
        return;
      }
    }

    // Form Guard Tahap 3 (Proses 2): RESOLVED konfirmasi penerimaan barang di apotek & kelengkapan investigasi
    const isResolving = editForm.status === "Resolved";
    if (isResolving) {
      const hasAction = editForm.action && editForm.action.trim() && editForm.action !== "-" && editForm.action !== "#N/A";
      const hasRootCause = editForm.root_cause && editForm.root_cause.trim() && editForm.root_cause !== "-" && editForm.root_cause !== "#N/A";
      const hasPerson = editForm.person && editForm.person.trim() && editForm.person !== "-" && editForm.person !== "#N/A";
      const isPersonRequired = !isKlaimRetur;

      if (!hasAction || !hasRootCause || (isPersonRequired && !hasPerson)) {
        const missing: string[] = [];
        if (!hasAction) missing.push("Tindakan Solusi Gudang (Action)");
        if (!hasRootCause) missing.push("Penyebab Kesalahan (Root Cause)");
        if (isPersonRequired && !hasPerson) missing.push("Personil Terkait (Picker / Checker)");

        setValidationModal({
          isOpen: true,
          title: "Tiket Belum Dapat Diselesaikan",
          subtitle: `Faktur #${editForm.invoice_no || selectedReturn.invoice_no} • ${editForm.customer_name || selectedReturn.customer_name}`,
          message: "Tiket belum bisa ditandai selesai karena data solusi/penyebab belum lengkap:",
          missingFields: missing,
          note: isKlaimRetur ? "Untuk jenis Klaim & Retur, nama personil boleh dikosongkan." : "Silakan lengkapi tindakan solusi, penyebab kesalahan, dan personil terkait sebelum tiket diselesaikan.",
          type: "warning",
          onConfirmText: "Lengkapi Data",
        });
        return;
      }

      if (!skipDeliveryConfirm && selectedReturn.status !== "Resolved") {
        setConfirmResolveItem({ ...selectedReturn, ...editForm });
        return;
      }
    }

    // 1. INSTANT OPTIMISTIC TRANSITION (<1ms) - Seketika berubah di layar
    setShowConfirmApproveModal(false);
    setShowConfirmRejectModal(false);
    setShowDeliveryPrepModal(false);
    setSelectedReturn(null);

    const isResolved = editForm.status === "Resolved";
    const resolvedDate = isResolved
      ? editForm.resolved_date || new Date().toISOString().split("T")[0]
      : editForm.resolved_date;

    const updatedItem = {
      ...selectedReturn,
      ...editForm,
      resolved_date: resolvedDate,
    };

    setReturns((prev) =>
      prev.map((r) => (r.id === selectedReturn.id ? updatedItem : r))
    );
    setAllReturns((prev) =>
      prev.map((r) => (r.id === selectedReturn.id ? updatedItem : r))
    );
    if (cachedReturnsData) {
      cachedReturnsData = cachedReturnsData.map((r) => (r.id === selectedReturn.id ? updatedItem : r));
    }
    if (cachedAllReturnsData) {
      cachedAllReturnsData = cachedAllReturnsData.map((r) => (r.id === selectedReturn.id ? updatedItem : r));
    }

    // Optimistic Local Stats Sync
    const oldSt = (selectedReturn.status || "").toLowerCase();
    const newSt = (editForm.status || "").toLowerCase();
    if (oldSt !== newSt || selectedReturn.inprogress_type !== editForm.inprogress_type) {
      setStats((prev: any) => {
        const next = { ...prev };
        if (oldSt.includes("pending")) next.totalPending = Math.max(0, (next.totalPending || 1) - 1);
        if (oldSt.includes("in progress")) {
          next.totalInProgress = Math.max(0, (next.totalInProgress || 1) - 1);
          if (selectedReturn.inprogress_type === "Operasional") {
            next.totalInProgressOperasional = Math.max(0, (next.totalInProgressOperasional || 1) - 1);
          } else {
            next.totalInProgressKlaim = Math.max(0, (next.totalInProgressKlaim || 1) - 1);
          }
        }
        if (newSt.includes("in progress")) {
          next.totalInProgress = (next.totalInProgress || 0) + 1;
          if (editForm.inprogress_type === "Operasional") {
            next.totalInProgressOperasional = (next.totalInProgressOperasional || 0) + 1;
          } else {
            next.totalInProgressKlaim = (next.totalInProgressKlaim || 0) + 1;
          }
        }
        if (newSt.includes("resolved")) next.totalResolved = (next.totalResolved || 0) + 1;
        if (newSt.includes("reject")) next.totalReject = (next.totalReject || 0) + 1;
        return next;
      });
    }

    // 2. Background Asynchronous Persistence (0ms UI freeze)
    const payload = {
      id: selectedReturn.id,
      ...editForm,
      resolved_date: resolvedDate,
      user_name: currentUser?.name || "Admin",
      user_email: currentUser?.email || "",
    };

    fetch("/api/tidb?action=update_return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({ success: false }));
      if (data.success) {
        broadcastRealtimeSignal("returns");
        recordActivityLog({
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
        alert("Gagal update data di cloud: " + (data.error || "Unknown error"));
        fetchReturns(true, true);
      }
    }).catch((err) => {
      console.error("Background update error:", err);
      fetchReturns(true, true);
    });
  };

  const handleDirectApprove = (r: ShipmentReturnRecord) => {
    if (!canEditReturns) {
      setValidationModal({
        isOpen: true,
        title: "Mode Hanya Lihat",
        message: "Akun Anda tidak memiliki hak akses mengubah modul Shipment Error. Hubungi Administrator untuk meminta akses.",
        type: "warning",
      });
      return;
    }
    const defaultType = r.inprogress_type || (
      [
        "fisik yang dikirim kurang",
        "fisik yang dikirim lebih",
        "fisik yang dikirim salah",
        "fisik yang dikirim tidak ada",
      ].some((k) =>
        (r.description || "").toLowerCase().includes(k) ||
        (r.reason || "").toLowerCase().includes(k)
      )
        ? "Operasional"
        : "Klaim & Retur"
    );
    setSelectedReturn(r);
    setEditForm({
      pbf: r.pbf || "MBI",
      customer_name: r.customer_name || "",
      invoice_no: r.invoice_no || "",
      so_no: r.so_no || "",
      product_name: r.product_name || "",
      qty: r.qty || 1,
      batch_no: r.batch_no || "",
      expiry_date: r.expiry_date || "",
      reason: r.reason || "",
      invoice_date: r.invoice_date || "",
      report_date: r.report_date ? r.report_date.split("T")[0] : "",
      category: r.category || "",
      confirm: "Approve",
      action: r.action || "",
      nota_retur_no: r.nota_retur_no || "",
      resolved_date: r.resolved_date || "",
      status: "In Progress",
      note: r.note || "",
      person: r.person || "",
      root_cause: r.root_cause || "",
      video_url: r.video_url || "",
      reject_reason: r.reject_reason || "",
      reject_media_url: r.reject_media_url || "",
      inprogress_type: defaultType,
    });
    setShowConfirmApproveModal(true);
  };

  // Handler sebelum konfirmasi selesai: WAJIB periksa kelengkapan Tindakan, Penyebab, & Personil
  const handleRequestResolveReturn = (item: ShipmentReturnRecord) => {
    if (!canEditReturns) {
      setValidationModal({
        isOpen: true,
        title: "Mode Hanya Lihat",
        message: "Akun Anda tidak memiliki hak akses mengubah modul Shipment Error.",
        type: "warning",
      });
      return;
    }
    const isKlaimRetur = item.inprogress_type === "Klaim & Retur" || (
      !item.inprogress_type && ![
        "fisik yang dikirim kurang",
        "fisik yang dikirim lebih",
        "fisik yang dikirim salah",
        "fisik yang dikirim tidak ada",
      ].some((k) =>
        (item.description || "").toLowerCase().includes(k) ||
        (item.reason || "").toLowerCase().includes(k)
      )
    );
    const hasAction = item.action && item.action.trim() && item.action !== "-" && item.action !== "#N/A";
    const hasRootCause = item.root_cause && item.root_cause.trim() && item.root_cause !== "-" && item.root_cause !== "#N/A";
    const hasPerson = item.person && item.person.trim() && item.person !== "-" && item.person !== "#N/A";
    const isPersonRequired = !isKlaimRetur;

    if (!hasAction || !hasRootCause || (isPersonRequired && !hasPerson)) {
      const missing: string[] = [];
      if (!hasAction) missing.push("Tindakan Solusi Gudang (Action)");
      if (!hasRootCause) missing.push("Penyebab Kesalahan (Root Cause)");
      if (isPersonRequired && !hasPerson) missing.push("Personil Terkait (Picker / Checker)");

      setValidationModal({
        isOpen: true,
        title: "Tiket Belum Dapat Diselesaikan",
        subtitle: `Faktur #${item.invoice_no || item.id} • ${item.customer_name || ""}`,
        message: "Tiket belum bisa ditandai selesai karena data solusi/penyebab belum lengkap:",
        missingFields: missing,
        note: isKlaimRetur
          ? "Untuk jenis Klaim & Retur, nama personil boleh dikosongkan. Cukup lengkapi Tindakan Solusi & Penyebab."
          : "Silakan lengkapi data investigasi gudang pada detail tiket sebelum menyelesaikannya.",
        type: "warning",
        onConfirmText: "Buka Detail & Lengkapi Data",
        onConfirm: () => {
          setSelectedReturn(item);
        },
      });
      return;
    }

    setConfirmResolveItem(item);
  };

  // Direct Resolve Handler with Optimistic Local Update (<1ms)
  const handleDirectResolve = async (item: ShipmentReturnRecord) => {
    setConfirmResolveItem(null);
    if (selectedReturn?.id === item.id) setSelectedReturn(null);
    const today = new Date().toISOString().split("T")[0];

    const resolvedItem = {
      ...item,
      status: "Resolved",
      resolved_date: today,
    };

    // 1. INSTANT OPTIMISTIC RESOLVE (<1ms)
    setReturns((prev) =>
      prev.map((r) => (r.id === item.id ? resolvedItem : r))
    );
    setAllReturns((prev) =>
      prev.map((r) => (r.id === item.id ? resolvedItem : r))
    );
    if (cachedReturnsData) {
      cachedReturnsData = cachedReturnsData.map((r) => (r.id === item.id ? resolvedItem : r));
    }
    if (cachedAllReturnsData) {
      cachedAllReturnsData = cachedAllReturnsData.map((r) => (r.id === item.id ? resolvedItem : r));
    }

    // Optimistic Local Stats Sync
    setStats((prev: any) => {
      const next = { ...prev };
      next.totalInProgress = Math.max(0, (next.totalInProgress || 1) - 1);
      if (item.inprogress_type === "Operasional") {
        next.totalInProgressOperasional = Math.max(0, (next.totalInProgressOperasional || 1) - 1);
      } else {
        next.totalInProgressKlaim = Math.max(0, (next.totalInProgressKlaim || 1) - 1);
      }
      next.totalResolved = (next.totalResolved || 0) + 1;
      return next;
    });

    // 2. Background Asynchronous Persistence (0ms UI wait)
    const payload: any = {
      id: item.id,
      status: "Resolved",
      resolved_date: today,
      user_name: currentUser?.name || "Admin",
      user_email: currentUser?.email || "",
    };
    if (item.action) payload.action = item.action;
    if (item.root_cause) payload.root_cause = item.root_cause;
    if (item.person) payload.person = item.person;
    if (item.nota_retur_no) payload.nota_retur_no = item.nota_retur_no;
    if (item.confirm) payload.confirm = item.confirm;
    if (item.note) payload.note = item.note;

    fetch("/api/tidb?action=update_return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({ success: false }));
      if (data.success) {
        broadcastRealtimeSignal("returns");
        recordActivityLog({
          action_type: "RESOLVE_RETURN",
          module: "SHIPMENT_ERROR",
          target_id: String(item.id),
          details: `Menyelesaikan (Resolve) komplain faktur #${item.invoice_no || item.id} (${item.customer_name || ""})`,
          metadata: {
            id: item.id,
            invoice_no: item.invoice_no,
            status: "Resolved",
            resolved_date: today,
          },
        });
      } else {
        alert("Gagal menyelesaikan tiket di cloud: " + (data.error || "Unknown error"));
        fetchReturns(true, true);
      }
    }).catch((err) => {
      console.error("Background resolve error:", err);
      fetchReturns(true, true);
    });
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
          video_url: "",
          reject_reason: "",
          reject_media_url: "",
          inprogress_type: "",
        });
        fetchReturns(false, true);
        broadcastRealtimeSignal("returns");
        broadcastNewComplaint({
          id: String(data.id || newForm.invoice_no),
          customer_name: newForm.customer_name,
          invoice_no: newForm.invoice_no,
          reason: newForm.reason,
          pbf: newForm.pbf,
          timestamp: Date.now(),
        }).catch(() => {});
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
          <h4 className="font-bold text-xs sm:text-sm text-black dark:text-white">
            Tiket #{r.id} - Faktur {r.invoice_no || "-"}
          </h4>
          <span className="text-xs text-zinc-500 dark:text-slate-400 font-semibold truncate">
            ({editForm.customer_name || r.customer_name})
          </span>

          {/* Status Tiket (Hanya Teks/Badge Otomatis di Sebelah Nama Apotek) */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all shadow-2xs ${
              editForm.status === "In Progress"
                ? "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800"
                : editForm.status === "Resolved"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800"
                : editForm.status === "Rejected"
                ? "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800"
                : "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800"
            }`}
          >
            {editForm.status === "In Progress" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span>In Progress</span>
              </>
            ) : editForm.status === "Resolved" ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Resolved</span>
              </>
            ) : editForm.status === "Rejected" ? (
              <>
                <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Rejected</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Pending</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(r.photo_url || (r as any).has_photo) && (
            <button
              type="button"
              onClick={() => handlePreviewPhoto(r)}
              disabled={loadingPhotoId === r.id}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
            >
              <Maximize2 className="w-3 h-3" />
              <span>{loadingPhotoId === r.id ? "Memuat..." : "Lihat Foto Bukti"}</span>
            </button>
          )}

          {r.video_url && (
            <button
              type="button"
              onClick={() => setPreviewVideoUrl(r.video_url || null)}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800"
            >
              <Video className="w-3 h-3" />
              <span>Putar Video Unboxing</span>
            </button>
          )}
        </div>
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

            <div className="sm:col-span-3">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Alasan / Kendala Dilaporkan (Dari Pelapor)</label>
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

            <div className="sm:col-span-3">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Catatan Tambahan dari Pengaju Komplain (Note Pelapor)</label>
              <input
                type="text"
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                placeholder="Keterangan fisik barang, kondisi segel, dll dari pihak apotek/pelapor"
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-medium"
              />
            </div>
          </div>
        </div>

        {/* Bagian 3: Balasan & Tindak Lanjut dari Pihak Kita / Gudang */}
        <div className="bg-blue-50/40 dark:bg-slate-950/90 p-2.5 sm:p-3 rounded-lg border border-blue-200 dark:border-blue-900/40 space-y-3">
          <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-900/40 pb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <span>🏢 3. Balasan & Tindak Lanjut Pihak Gudang / Logistik (Investigasi, Solusi & Keputusan)</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">
              *Mengisi Tindakan / Penyebab otomatis mengaktifkan status <strong className="text-blue-600 dark:text-blue-400">In Progress</strong>
            </span>
          </div>

          {/* Baris 3.1: Investigasi & Solusi Gudang */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Tindakan Solusi Gudang (Action)
              </label>
              <input
                type="text"
                value={editForm.action}
                onChange={(e) => {
                  const val = e.target.value;
                  const updates: any = { action: val };
                  // Auto In-Progress jika tindakan diisi saat masih Pending
                  if (val.trim() && (editForm.status === "Pending" || !editForm.status)) {
                    updates.status = "In Progress";
                    if (editForm.confirm !== "Approve") updates.confirm = "Approve";
                  }
                  setEditForm({ ...editForm, ...updates });
                }}
                placeholder="Tukar fisik / Kirim susulan / dll"
                className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-lg p-1.5 text-blue-900 dark:text-blue-200 font-bold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Penyebab Kesalahan (Root Cause)
              </label>
              <input
                type="text"
                value={editForm.root_cause}
                onChange={(e) => {
                  const val = e.target.value;
                  const updates: any = { root_cause: val };
                  // Auto In-Progress jika penyebab diisi saat masih Pending
                  if (val.trim() && (editForm.status === "Pending" || !editForm.status)) {
                    updates.status = "In Progress";
                    if (editForm.confirm !== "Approve") updates.confirm = "Approve";
                  }
                  setEditForm({ ...editForm, ...updates });
                }}
                placeholder="Human error / Salah ambil picker / dll"
                className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-lg p-1.5 text-blue-900 dark:text-blue-200 font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Personil Terkait {editForm.inprogress_type === "Klaim & Retur" ? "(Opsional untuk Klaim & Retur)" : "(Picker / Checker)"}
              </label>
              <input
                type="text"
                value={editForm.person}
                onChange={(e) => {
                  const val = e.target.value;
                  const updates: any = { person: val };
                  if (val.trim() && (editForm.status === "Pending" || !editForm.status)) {
                    updates.status = "In Progress";
                    if (editForm.confirm !== "Approve") updates.confirm = "Approve";
                  }
                  setEditForm({ ...editForm, ...updates });
                }}
                placeholder={editForm.inprogress_type === "Klaim & Retur" ? "Opsional (Boleh dikosongkan)" : "Nama picker / checker bersangkutan"}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">No. Nota Retur</label>
              <input
                type="text"
                value={editForm.nota_retur_no}
                onChange={(e) => setEditForm({ ...editForm, nota_retur_no: e.target.value })}
                placeholder="Nomor nota retur (jika ada)"
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Baris 3.2: Konfirmasi & Status Keputusan Tiket */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-blue-100 dark:border-slate-800/80">
            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                1. Validitas Komplain
              </label>
              <select
                value={editForm.confirm}
                onChange={(e) => {
                  const val = e.target.value;
                  const updates: any = { confirm: val };
                  if (val === "Approve") {
                    updates.status = "In Progress";
                    if (!editForm.inprogress_type) {
                      const isOp = [
                        "fisik yang dikirim kurang",
                        "fisik yang dikirim lebih",
                        "fisik yang dikirim salah",
                        "fisik yang dikirim tidak ada",
                      ].some((k) =>
                        (selectedReturn?.description || "").toLowerCase().includes(k) ||
                        (editForm.reason || "").toLowerCase().includes(k)
                      );
                      updates.inprogress_type = isOp ? "Operasional" : "Klaim & Retur";
                    }
                  } else if (val === "Reject") {
                    updates.status = "Rejected";
                    updates.resolved_date = "";
                  } else {
                    updates.status = "Pending";
                  }
                  setEditForm({ ...editForm, ...updates });
                }}
                className={`w-full border rounded-lg p-1.5 font-bold transition-colors ${
                  editForm.confirm === "Approve"
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-800 dark:text-blue-300"
                    : editForm.confirm === "Reject"
                    ? "bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-300"
                    : "bg-white dark:bg-slate-900 border-zinc-300 dark:border-slate-700 text-black dark:text-white"
                }`}
              >
                <option value="">-- Belum Ditentukan --</option>
                <option value="Approve">🔵 Valid (Kesalahan PBF)</option>
                <option value="Reject">🔴 Reject (Bukan Kesalahan PBF)</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Tgl Penyelesaian (Resolved Date)</label>
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
                calculateDaysUntilClose(editForm.report_date, editForm.resolved_date, editForm.status, editForm.invoice_date) === "#N/A"
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              }`}>
                <span>{calculateDaysUntilClose(editForm.report_date, editForm.resolved_date, editForm.status, editForm.invoice_date) === "#N/A" ? "#N/A (Belum Close)" : `${calculateDaysUntilClose(editForm.report_date, editForm.resolved_date, editForm.status, editForm.invoice_date)} hari`}</span>
                <span className="text-[10px] font-normal text-zinc-500">Today: {calculateDaysUntilToday(editForm.report_date)} hr</span>
              </div>
            </div>
          </div>

          {/* Baris 3.3: Spesifik In Progress / Reject Details */}
          {(editForm.confirm === "Approve" || editForm.status === "In Progress") && (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2">
              <label className="text-xs font-bold text-blue-900 dark:text-blue-300 block">
                Jenis Alur In Progress:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, inprogress_type: "Operasional" })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    editForm.inprogress_type === "Operasional"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-white dark:bg-slate-900 text-zinc-700 dark:text-slate-300 border-blue-200 dark:border-blue-900/40 hover:border-blue-400"
                  }`}
                >
                  <div className="font-extrabold text-xs flex items-center gap-1.5">
                    <Package className="w-4 h-4" />
                    <span>In Progress (Operasional)</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${editForm.inprogress_type === "Operasional" ? "text-blue-100" : "text-zinc-500 dark:text-slate-400"}`}>
                    Kelalaian fisik pengiriman: Fisik kurang, lebih, salah, tidak ada (Penyiapan barang &amp; antar driver).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, inprogress_type: "Klaim & Retur" })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    editForm.inprogress_type === "Klaim & Retur"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-white dark:bg-slate-900 text-zinc-700 dark:text-slate-300 border-blue-200 dark:border-blue-900/40 hover:border-blue-400"
                  }`}
                >
                  <div className="font-extrabold text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>In Progress (Klaim &amp; Retur)</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${editForm.inprogress_type === "Klaim & Retur" ? "text-blue-100" : "text-zinc-500 dark:text-slate-400"}`}>
                    Retur administratif &amp; kondisi barang: Damage On Delivery, ED dekat, recall, salah SKU, dll.
                  </p>
                </button>
              </div>
            </div>
          )}

          {(editForm.confirm === "Reject" || editForm.status === "Rejected") && (
            <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 dark:text-rose-300">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Form Penolakan Transparan (Akan Tampil di Link Tracking Apotek)</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-slate-300 block mb-1">
                  Alasan Penolakan PBF (Wajib Diisi):
                </label>
                <textarea
                  rows={2}
                  value={editForm.reject_reason || editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, reject_reason: e.target.value, note: e.target.value })}
                  placeholder="Contoh: Dus luar utuh bersegel dan tidak ada video unboxing saat paket diterima..."
                  className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg p-2 text-xs text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-slate-300 block mb-1">
                  Link / Bukti Media Penolakan dari Tim PBF (Opsional):
                </label>
                <input
                  type="text"
                  value={editForm.reject_media_url || ""}
                  onChange={(e) => setEditForm({ ...editForm, reject_media_url: e.target.value })}
                  placeholder="URL Foto/Video Bukti CCTV Gudang atau Packing List..."
                  className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-xs text-zinc-900 dark:text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* Bukti Media Apotek */}
          {(selectedReturn?.video_url || editForm.video_url) && (
            <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded-xl">
              <Video className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-purple-900 dark:text-purple-300 truncate">
                  Tersedia Video Unboxing dari Apotek
                </p>
                <p className="text-[10px] text-purple-700 dark:text-purple-400">
                  Video direkam saat pembukaan paket oleh apotek (durasi max 10 menit).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideoUrl(selectedReturn?.video_url || editForm.video_url || null)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Putar Video</span>
              </button>
            </div>
          )}
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
              onClick={() => handleSaveEdit(false)}
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

          {/* Tab 2: Analisis (Tepat di Sebelah Data Kasus) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("analisis");
              fetchAllReturns(true);
            }}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "analisis"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Analisis</span>
          </button>

          {/* Tab 3: Overview */}
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

          {/* Tab 4: Monthly */}
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

          {/* Tab 5: Weekly */}
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
              if (activeTab !== "list") fetchAllReturns(true);
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
          onSelectInvoice={onSelectInvoice}
          onSelectReturn={(r) => {
            setActiveTab("list");
            setSearch(r.invoice_no || "");
            setSelectedReturn(r);
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
          {showKpiSummary && (
            <div className="space-y-2.5">
              {/* Filter Status Bar Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter Alur Status:</span>
                  </span>
                  {statusFilter === "ALL" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Semua Kasus Ditampilkan ({total.toLocaleString("id-ID")})
                    </span>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                      <span>Sedang difilter:</span>
                      <span className="underline decoration-2 font-black">{statusFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter("ALL");
                          setPage(0);
                        }}
                        className="ml-1 px-1.5 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                        title="Tampilkan Semua Kasus"
                      >
                        ✕ Tampilkan Semua
                      </button>
                    </div>
                  )}
                </div>

                {statusFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("ALL");
                      setPage(0);
                    }}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>✕ Reset ke Semua Kasus</span>
                  </button>
                )}
              </div>

              {/* 4 Status Workflow Metric Cards (Symmetrical 4-Column Grid) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. PENDING */}
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === "Pending" ? "ALL" : "Pending");
                    setPage(0);
                  }}
                  className={`relative overflow-hidden rounded-2xl border p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer touch-manipulation transition-all select-none ${
                    statusFilter === "Pending"
                      ? "border-amber-400 dark:border-amber-400 ring-4 ring-amber-500/20 dark:ring-amber-400/20 bg-amber-500/15 dark:bg-amber-950/70 shadow-lg shadow-amber-500/10 scale-[1.01]"
                      : `${statusFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-700 bg-white dark:bg-slate-900 hover:shadow-md`
                  }`}
                  title="Klik untuk filter tiket Pending (Menunggu Validitas). Klik lagi untuk reset."
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>PENDING</span>
                    </span>
                    {statusFilter === "Pending" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-black flex items-center gap-1 shadow-xs animate-in zoom-in-95">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>AKTIF</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Tahap 1
                      </span>
                    )}
                  </div>
                  <div className="my-1">
                    <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                      {pendingCasesCount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-[10px] font-medium truncate">
                    {statusFilter === "Pending" ? (
                      <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Sedang Difilter (Klik untuk reset)
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        Pengecekan bukti &amp; validitas
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. IN PROGRESS */}
                <div
                  className={`relative overflow-hidden rounded-2xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all select-none ${
                    statusFilter.startsWith("In Progress")
                      ? "border-blue-400 dark:border-blue-400 ring-4 ring-blue-500/20 dark:ring-blue-400/20 bg-blue-500/15 dark:bg-blue-950/70 shadow-lg shadow-blue-500/10 scale-[1.01]"
                      : `${statusFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 bg-white dark:bg-slate-900 hover:shadow-md`
                  }`}
                  title="Klik untuk filter tiket In Progress. Klik lagi untuk reset."
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500" />
                  <div
                    onClick={() => {
                      setStatusFilter(statusFilter === "In Progress" ? "ALL" : "In Progress");
                      setPage(0);
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-mono font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        <span>IN PROGRESS</span>
                      </span>
                      {statusFilter.startsWith("In Progress") ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-blue-500 text-white flex items-center gap-1 shadow-xs animate-in zoom-in-95">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>AKTIF</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Tahap 2
                        </span>
                      )}
                    </div>
                    <div className="my-1">
                      <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                        {inProgressCasesCount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* Sub-Pills: 2 Jenis In Progress */}
                  <div className="grid grid-cols-2 gap-1 pt-1.5 mt-1 border-t border-blue-200/60 dark:border-blue-900/40">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusFilter(statusFilter === "In Progress (Operasional)" ? "ALL" : "In Progress (Operasional)");
                        setPage(0);
                      }}
                      className={`px-1.5 py-1 rounded-lg text-[9px] font-bold text-left transition-all cursor-pointer truncate ${
                        statusFilter === "In Progress (Operasional)"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 hover:bg-blue-200"
                      }`}
                      title="Filter komplain operasional fisik: Kurang, Lebih, Salah, Tidak Ada"
                    >
                      <span className="block opacity-75">📦 Operasional</span>
                      <strong className="text-[11px] font-mono font-black">{inProgressOperasionalCount}</strong>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusFilter(statusFilter === "In Progress (Klaim & Retur)" ? "ALL" : "In Progress (Klaim & Retur)");
                        setPage(0);
                      }}
                      className={`px-1.5 py-1 rounded-lg text-[9px] font-bold text-left transition-all cursor-pointer truncate ${
                        statusFilter === "In Progress (Klaim & Retur)"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 hover:bg-blue-200"
                      }`}
                      title="Filter komplain administratif: Klaim & Retur, Damage, ED dekat, recall"
                    >
                      <span className="block opacity-75">📋 Klaim/Retur</span>
                      <strong className="text-[11px] font-mono font-black">{inProgressKlaimCount}</strong>
                    </button>
                  </div>
                </div>

                {/* 3. RESOLVED */}
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === "Resolved" ? "ALL" : "Resolved");
                    setPage(0);
                  }}
                  className={`relative overflow-hidden rounded-2xl border p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer touch-manipulation transition-all select-none ${
                    statusFilter === "Resolved"
                      ? "border-emerald-400 dark:border-emerald-400 ring-4 ring-emerald-500/20 dark:ring-emerald-400/20 bg-emerald-500/15 dark:bg-emerald-950/70 shadow-lg shadow-emerald-500/10 scale-[1.01]"
                      : `${statusFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700 bg-white dark:bg-slate-900 hover:shadow-md`
                  }`}
                  title="Klik untuk filter tiket Selesai (Resolved). Klik lagi untuk reset."
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>RESOLVED</span>
                    </span>
                    {statusFilter === "Resolved" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500 text-white flex items-center gap-1 shadow-xs animate-in zoom-in-95">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>AKTIF</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Tahap 3
                      </span>
                    )}
                  </div>
                  <div className="my-1">
                    <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                      {resolvedCasesCount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-[10px] font-medium truncate">
                    {statusFilter === "Resolved" ? (
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Sedang Difilter (Klik untuk reset)
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        {resolutionRate}% tuntas diterima apotek
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. REJECTED */}
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === "Rejected" ? "ALL" : "Rejected");
                    setPage(0);
                  }}
                  className={`relative overflow-hidden rounded-2xl border p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer touch-manipulation transition-all select-none ${
                    statusFilter === "Rejected"
                      ? "border-rose-400 dark:border-rose-400 ring-4 ring-rose-500/20 dark:ring-rose-400/20 bg-rose-500/15 dark:bg-rose-950/70 shadow-lg shadow-rose-500/10 scale-[1.01]"
                      : `${statusFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-700 bg-white dark:bg-slate-900 hover:shadow-md`
                  }`}
                  title="Klik untuk filter tiket Ditolak (Rejected). Klik lagi untuk reset."
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-mono font-bold tracking-wider text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>REJECTED</span>
                    </span>
                    {statusFilter === "Rejected" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500 text-white flex items-center gap-1 shadow-xs animate-in zoom-in-95">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>AKTIF</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        Tahap 4
                      </span>
                    )}
                  </div>
                  <div className="my-1">
                    <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                      {rejectedCasesCount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-[10px] font-medium truncate">
                    {statusFilter === "Rejected" ? (
                      <span className="text-rose-800 dark:text-rose-300 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        Sedang Difilter (Klik untuk reset)
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        Bukan kesalahan pihak PBF
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Secondary PBF Cases & Error Rate Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {/* TOTAL CASES MAI */}
                <div
                  onClick={() => {
                    setPbfFilter(pbfFilter === "MAI" ? "ALL" : "MAI");
                    setPage(0);
                  }}
                  className={`relative overflow-hidden rounded-xl border p-2 sm:p-2.5 flex flex-col justify-between cursor-pointer touch-manipulation transition-all select-none ${
                    pbfFilter === "MAI"
                      ? "border-red-400 ring-2 ring-red-400/30 bg-red-500/15 dark:bg-red-950/60 shadow-sm"
                      : `${pbfFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-red-400 bg-white dark:bg-slate-900`
                  }`}
                  title="Klik untuk filter PBF MAI"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                      TOTAL CASES MAI
                    </span>
                    {pbfFilter === "MAI" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-red-500 text-white">
                        ✓ AKTIF
                      </span>
                    )}
                  </div>
                  <div className="my-0.5">
                    <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                      {(stats.maiApproved || stats.totalMai).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    dari {maiInvoiceCount.toLocaleString("id-ID")} inv
                  </div>
                </div>

                {/* TOTAL CASES MBI */}
                <div
                  onClick={() => {
                    setPbfFilter(pbfFilter === "MBI" ? "ALL" : "MBI");
                    setPage(0);
                  }}
                  className={`relative overflow-hidden rounded-xl border p-2 sm:p-2.5 flex flex-col justify-between cursor-pointer touch-manipulation transition-all select-none ${
                    pbfFilter === "MBI"
                      ? "border-blue-400 ring-2 ring-blue-400/30 bg-blue-500/15 dark:bg-blue-950/60 shadow-sm"
                      : `${pbfFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-white dark:bg-slate-900`
                  }`}
                  title="Klik untuk filter PBF MBI"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                      TOTAL CASES MBI
                    </span>
                    {pbfFilter === "MBI" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-blue-500 text-white">
                        ✓ AKTIF
                      </span>
                    )}
                  </div>
                  <div className="my-0.5">
                    <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                      {(stats.mbiApproved || stats.totalMbi).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    dari {mbiInvoiceCount.toLocaleString("id-ID")} inv
                  </div>
                </div>

                {/* ERROR RATE MAI */}
                <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-2 sm:p-2.5 flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />
                  <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                    ERROR RATE MAI
                  </div>
                  <div className="my-0.5">
                    <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                      {errorRateMai}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Approve only
                  </div>
                </div>

                {/* ERROR RATE MBI */}
                <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-2 sm:p-2.5 flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
                  <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                    ERROR RATE MBI
                  </div>
                  <div className="my-0.5">
                    <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                      {errorRateMbi}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Approve only
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Komplain</span>
              </button>
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                disabled={isImporting}
                className="py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Impor Data Excel / CSV"
              >
                <Download className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 rotate-180 ${isImporting ? "animate-bounce" : ""}`} />
                <span>{isImporting ? "Mengimpor..." : "Impor Excel"}</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 border border-zinc-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Unduh Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Ekspor Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHowToUse(true)}
                className="py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Buka Panduan & How to Use Shipment Error"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>How to Use</span>
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportExcel}
              />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Toggle Ringkasan KPI button */}
              <button
                type="button"
                onClick={toggleKpiSummary}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  showKpiSummary
                    ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 dark:border-indigo-800/60"
                }`}
                title={showKpiSummary ? "Sembunyikan 6 Kartu Ringkasan (Biar tabel lebih luas)" : "Tampilkan 6 Kartu Ringkasan"}
              >
                {showKpiSummary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{showKpiSummary ? "Sembunyikan Ringkasan" : "Tampilkan Ringkasan"}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyComplaintLink}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  linkCopied
                    ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                    : "bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700"
                }`}
                title="Salin link form komplain publik untuk dibagikan ke apotek atau tim sales"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">Salin Link Form</span>
                  </>
                )}
              </button>

              <a
                href="/komplain"
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-2.5 bg-white hover:bg-zinc-100 text-black dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-zinc-300 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Buka form input komplain di tab baru"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Buka Form</span>
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </a>
            </div>
          </div>

      {/* ─── Search and Filters Command Bar ─── */}
      <div className="rounded-2xl p-2 sm:p-2.5 bg-white dark:bg-[#0c121f]/90 border border-zinc-200 dark:border-slate-800/80 shadow-xs flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No Faktur, SO, Apotek, Produk, atau Alasan..."
              className="w-full bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl pl-9 pr-8 py-1.5 text-xs text-zinc-900 dark:text-slate-100 placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 dark:bg-slate-950 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Semua Status</option>
              <option value="Pending" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">🟡 Pending (Menunggu Validitas)</option>
              <option value="In Progress" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">🔵 In Progress (Semua)</option>
              <option value="In Progress (Operasional)" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">📦 In Progress (Operasional - Fisik)</option>
              <option value="In Progress (Klaim & Retur)" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">📋 In Progress (Klaim & Retur)</option>
              <option value="Resolved" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">🟢 Resolved (Selesai Diterima)</option>
              <option value="Rejected" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">🔴 Rejected (Ditolak)</option>
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
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 dark:bg-slate-950 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Semua PBF</option>
              <option value="MBI" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">PT MEDIKA BINA INVESTAMA (MBI)</option>
              <option value="MAI" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">PT MEDIKA AKSES INVESTAMA (MAI)</option>
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
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 dark:bg-slate-950 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Semua Bulan (Jan - Des 2026)</option>
              <option value="12" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Desember 2026</option>
              <option value="11" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">November 2026</option>
              <option value="10" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Oktober 2026</option>
              <option value="9" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">September 2026</option>
              <option value="8" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Agustus 2026</option>
              <option value="7" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Juli 2026</option>
              <option value="6" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Juni 2026</option>
              <option value="5" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Mei 2026</option>
              <option value="4" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">April 2026</option>
              <option value="3" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Maret 2026</option>
              <option value="2" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Februari 2026</option>
              <option value="1" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Januari 2026</option>
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
              className="bg-transparent border-none text-xs font-bold text-zinc-800 dark:text-slate-200 dark:bg-slate-950 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Semua Week (W1 - W{Math.max(43, currentWeekNumber)})</option>
              <option value={String(currentWeekNumber)} className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Week Sekarang (W{currentWeekNumber})</option>
              <option disabled className="bg-white dark:bg-slate-900 text-zinc-400">──────────</option>
              {availableWeeks.map((w) => (
                <option key={w} value={String(w)} className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
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

          {/* ─── Mode Tampilan Switcher (Smart vs Spreadsheet) ─── */}
          <div className="flex items-center bg-zinc-100 dark:bg-[#070b13] p-0.5 rounded-xl border border-zinc-200 dark:border-slate-700/60 shadow-xs">
            <button
              type="button"
              onClick={() => handleTableViewModeChange("smart")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tableViewMode === "smart"
                  ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              title="Tampilan Pintar (0 Scroll): Seluruh 14 informasi diringkas dalam 5 kolom rapi dan pas 100% di layar tanpa geser horizontal"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-500 dark:text-white" />
              <span>Ringkas (0 Scroll)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTableViewModeChange("spreadsheet")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tableViewMode === "spreadsheet"
                  ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              title="Tampilan Spreadsheet: 14 kolom terpisah seperti Excel lengkap dengan fitur Freeze & Hide Kolom"
            >
              <Table className="w-3.5 h-3.5 text-indigo-500 dark:text-white" />
              <span>Spreadsheet Lebar</span>
            </button>
          </div>

          {/* ─── Spreadsheet Freeze & Column Selector (Hanya saat mode Spreadsheet) ─── */}
          {tableViewMode === "spreadsheet" && (
            <>
              {/* Spreadsheet Freeze Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#070b13] border border-zinc-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1">
                <Pin className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">Freeze:</span>
                <select
                  value={freezeColLevel}
                  onChange={(e) => handleFreezeChange(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-blue-600 dark:text-blue-400 dark:bg-slate-950 focus:outline-none cursor-pointer pr-1"
                  title="Kunci kolom di sisi kiri seperti Excel/Google Sheets"
                >
                  <option value="none" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Bebas (Tanpa Freeze)</option>
                  <option value="1" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">1. Kolom PBF</option>
                  <option value="2" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">2. PBF + Apotek</option>
                  <option value="3" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">3. Sampai No. Faktur</option>
                </select>
              </div>

              {/* Column Visibility Dropdown Toggle */}
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
            </>
          )}

          <button
            type="button"
            onClick={() => {
              fetchReturns(false, true);
              if (activeTab !== "list") fetchAllReturns(true);
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
      <div className="block md:hidden space-y-3 pb-24 max-w-full overflow-hidden">
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
            const isResolved = (r.status || "").toLowerCase().includes("resolved") || (r.status || "").toLowerCase().includes("selesai");
            const isReject = (r.status || "").toLowerCase().includes("reject") || (r.confirm || "").toLowerCase().includes("reject") || (r.confirm || "").toLowerCase().includes("tolak");
            const isInProgress = (r.status || "").toLowerCase() === "in progress";
            const isPending = !isResolved && !isReject && !isInProgress;
            const isExpanded = selectedReturn?.id === r.id;

            return (
              <div
                key={`mobile-${r.id}`}
                className={`rounded-2xl border transition-all p-3.5 shadow-xs max-w-full overflow-hidden ${
                  isExpanded
                    ? "bg-indigo-50/70 dark:bg-slate-800/80 border-indigo-500 ring-1 ring-indigo-500"
                    : "bg-white dark:bg-[#0a0f1c] border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {/* 1. Header: PBF, Faktur No, & STATUS BADGE (Sangat Jelas di HP) */}
                <div className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80 flex-wrap">
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
                        className="font-mono text-xs font-bold text-blue-600 dark:text-indigo-400 hover:underline flex items-center gap-1 touch-manipulation cursor-pointer"
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black shrink-0 shadow-2xs ${
                      isResolved
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/40"
                        : isInProgress
                        ? "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/25 dark:text-blue-300 dark:border-blue-500/40"
                        : isReject
                        ? "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/25 dark:text-rose-300 dark:border-rose-500/40"
                        : "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/40"
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : isInProgress ? (
                      <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    ) : isReject ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>{isResolved ? "Resolved" : isInProgress ? "In Progress" : isReject ? "Rejected" : "Pending"}</span>
                  </span>
                </div>

                {/* 2. Baris 2: Nama Apotek/Outlet & Nama Produk & Qty */}
                <div className="py-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                      {r.customer_name || "-"}
                    </h4>
                    {r.category && r.category !== "#N/A" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shrink-0">
                        {r.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    <span className="truncate">Produk: {r.product_name || "-"}</span>
                    <span className="shrink-0 text-indigo-600 dark:text-indigo-400 font-mono">
                      Qty: {r.qty || 1}
                    </span>
                  </div>
                </div>

                {/* 3. Baris 3: Jenis Kendala (warna oranye) + PIC Personil (Picker/Checker) */}
                <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
                  <div className="text-amber-700 dark:text-amber-400 font-bold truncate">
                    <span>Kendala: </span>
                    <span className="font-semibold">{r.reason || "-"}</span>
                  </div>
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium truncate flex items-center justify-between gap-1">
                    <span>PIC (Picker/Checker): <strong className="text-zinc-800 dark:text-zinc-200">{r.person || "-"}</strong></span>
                    {r.action && r.action !== "#N/A" && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                        {r.action}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Tanggal Lapor & Selesai */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 pb-1">
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

                {/* 4. Footer: Action Buttons (Nyaman di Jempol iPhone) */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(r.photo_url || (r as any).has_photo) && (
                      <button
                        type="button"
                        onClick={() => handlePreviewPhoto(r)}
                        disabled={loadingPhotoId === r.id}
                        className="h-9 py-2 px-3 rounded-xl text-xs font-bold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:scale-105 transition-all touch-manipulation cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        <span>{loadingPhotoId === r.id ? "Memuat..." : "Foto"}</span>
                      </button>
                    )}
                    {r.video_url && (
                      <button
                        type="button"
                        onClick={() => setPreviewVideoUrl(r.video_url || null)}
                        className="h-9 py-2 px-3 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:scale-105 transition-all touch-manipulation cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Video</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isInProgress && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestResolveReturn(r);
                        }}
                        className="h-9 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all touch-manipulation cursor-pointer"
                        title="Tandai kasus ini selesai (Resolved)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Selesaikan</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedReturn((prev) => (prev?.id === r.id ? null : r))}
                      className={`h-9 py-2 px-3.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
                        isExpanded
                          ? "bg-black text-white dark:bg-indigo-600"
                          : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700"
                      }`}
                    >
                      {isExpanded ? "Tutup Detail" : "Edit & Tindakan"}
                    </button>
                  </div>
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
        {tableViewMode === "smart" ? (
          /* ══════════════════════════════════════════════════════════════════════ */
          /* ── SMART MODE: Pas 100% di layar, ZERO Horizontal Scroll (6 Kolom) ── */
          /* ══════════════════════════════════════════════════════════════════════ */
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 dark:bg-[#070b14] border-b-2 border-zinc-300 dark:border-zinc-800 text-[11px] font-black text-black dark:text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3 px-3 w-[10%] text-center border-r border-zinc-200 dark:border-zinc-800">
                  ACC / Selesai
                </th>
                <th className="py-3 px-4 w-[25%] border-r border-zinc-200 dark:border-zinc-800">
                  Faktur & Pelanggan
                </th>
                <th className="py-3 px-4 w-[24%] border-r border-zinc-200 dark:border-zinc-800">
                  Produk & Fisik
                </th>
                <th className="py-3 px-4 w-[22%] border-r border-zinc-200 dark:border-zinc-800">
                  Kendala & Penyebab
                </th>
                <th className="py-3 px-3 w-[12%] text-center border-r border-zinc-200 dark:border-zinc-800">
                  Status & Timeline
                </th>
                <th className="py-3 px-3 w-[7%] text-center">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 dark:divide-slate-800/50 bg-white dark:bg-[#0a0f1c]">
              {loading && returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span className="font-semibold text-sm">Memuat data tiket komplain & retur...</span>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-400">
                    <RotateCcw className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
                    <p className="font-semibold text-sm text-zinc-600 dark:text-slate-400">Tidak ada tiket komplain/retur yang cocok</p>
                    <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">Gunakan kata kunci lain atau ubah status filter.</p>
                  </td>
                </tr>
              ) : (
                returns.map((r) => {
                  const isResolved = (r.status || "").toLowerCase().includes("resolved");
                  const isPending = (r.status || "").toLowerCase().includes("pending");
                  const isReject = (r.status || "").toLowerCase().includes("reject");
                  const isInProgress = (r.status || "").toLowerCase().includes("in progress");
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
                        {/* 1. ACC / Selesai (Eksekusi Cepat Langsung di Depan) */}
                        <td
                          className="py-3 px-2 text-center align-middle border-r border-zinc-200 dark:border-zinc-800/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.status === "Pending" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDirectApprove(r);
                              }}
                              className="w-full py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-[11px] inline-flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                              title="ACC Komplain ini (Proses ke In Progress)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ACC</span>
                            </button>
                          ) : r.status === "In Progress" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestResolveReturn(r);
                              }}
                              className="w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11px] inline-flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                              title="Tandai kasus ini selesai (Resolved)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selesaikan</span>
                            </button>
                          ) : isResolved ? (
                            <span className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Selesai</span>
                            </span>
                          ) : (r.status || "").toLowerCase().includes("reject") ? (
                            <span className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60 shadow-2xs">
                              <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>Ditolak</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-bold">-</span>
                          )}
                        </td>

                        {/* 2. Faktur & Pelanggan */}
                        <td className="py-3 px-4 border-r border-zinc-200 dark:border-zinc-800/80 align-top">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
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
                            {r.category && r.category !== "#N/A" && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
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
                          <div className="font-bold text-[13px] text-zinc-900 dark:text-slate-100 leading-snug break-words" title={r.customer_name}>
                            {r.customer_name && r.customer_name !== "#N/A" ? r.customer_name : "-"}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] mt-1 font-mono">
                            {r.invoice_no && r.invoice_no !== "#N/A" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onSelectInvoice) onSelectInvoice(r.invoice_no);
                                }}
                                className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                                title="Buka Faktur Terkait"
                              >
                                <span>{r.invoice_no}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ) : (
                              <span className="text-zinc-400 dark:text-slate-600">-</span>
                            )}
                            {r.so_no && r.so_no !== "#N/A" && (
                              <span className="text-zinc-500 dark:text-slate-400 text-[10px]">
                                SO: <strong className="text-zinc-700 dark:text-slate-300">{r.so_no}</strong>
                              </span>
                            )}
                            {getInvoiceDate(r) && (
                              <span className="text-[10px] text-zinc-400 dark:text-slate-500 flex items-center gap-0.5" title="Tanggal Faktur">
                                <Calendar className="w-2.5 h-2.5" />
                                {formatDate(getInvoiceDate(r))}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Produk & Fisik */}
                        <td className="py-3 px-4 border-r border-zinc-200 dark:border-zinc-800/80 align-top">
                          <p className="font-bold text-[12px] text-zinc-900 dark:text-slate-100 leading-snug break-words" title={r.product_name}>
                            {r.product_name && r.product_name !== "#N/A" ? r.product_name : "-"}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-600 dark:text-slate-400 mt-1">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-slate-800 text-zinc-800 dark:text-slate-200 font-bold text-[10px] border border-zinc-200 dark:border-slate-700">
                              Qty: {r.qty || 1}
                            </span>
                            {r.batch_no && r.batch_no !== "#N/A" && (
                              <span className="font-mono text-[10px] text-zinc-500 dark:text-slate-400">
                                Batch: <strong className="text-zinc-700 dark:text-slate-300">{r.batch_no}</strong>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            {(r.photo_url || (r as any).has_photo) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewPhoto(r);
                                }}
                                disabled={loadingPhotoId === r.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 border border-violet-200 dark:border-violet-700 hover:scale-105 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                title="Lihat foto bukti kerusakan dari apotek"
                              >
                                <Camera className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                                <span>{loadingPhotoId === r.id ? "Memuat..." : "Foto Bukti"}</span>
                              </button>
                            )}
                            {r.video_url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewVideoUrl(r.video_url || null);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:scale-105 transition-all shadow-xs cursor-pointer"
                                title="Tonton video unboxing dari apotek"
                              >
                                <Video className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                <span>Video</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 3. Kendala & Penyebab */}
                        <td className="py-3 px-4 border-r border-zinc-200 dark:border-zinc-800/80 align-top">
                          <div className="font-semibold text-zinc-900 dark:text-slate-200 leading-snug break-words text-[11px]" title={r.reason}>
                            {r.reason && r.reason !== "#N/A" ? r.reason : "-"}
                          </div>
                          {r.root_cause && r.root_cause !== "#N/A" && (
                            <div className="text-[10px] text-zinc-500 dark:text-slate-400 mt-1 break-words">
                              Penyebab: <strong className="text-zinc-700 dark:text-slate-300">{r.root_cause}</strong>
                            </div>
                          )}
                          {r.person && r.person !== "#N/A" && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/60">
                                Pelaku: {r.person}
                              </span>
                            </div>
                          )}
                          {r.action && r.action !== "#N/A" && (
                            <div className="text-[10px] text-zinc-500 dark:text-slate-400 mt-1 italic break-words">
                              Tindakan: {r.action}
                            </div>
                          )}
                        </td>

                        {/* 4. Status & Timeline */}
                        <td className="py-3 px-3 text-center border-r border-zinc-200 dark:border-zinc-800/80 align-top">
                          <span
                            className={`inline-flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                              isResolved
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                                : isPending
                                ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                                : isReject
                                ? "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30"
                                : "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {isResolved ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                              ) : isReject ? (
                                <XCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                              ) : isInProgress ? (
                                <Package className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                              )}
                              <span>{isResolved ? "Resolved" : isReject ? "Rejected" : isInProgress ? "In Progress" : "Pending"}</span>
                            </span>
                            {isInProgress && (
                              <span className="text-[8.5px] font-mono uppercase tracking-tight text-blue-800 dark:text-blue-300 opacity-90">
                                {r.inprogress_type || (
                                  [
                                    "fisik yang dikirim kurang",
                                    "fisik yang dikirim lebih",
                                    "fisik yang dikirim salah",
                                    "fisik yang dikirim tidak ada",
                                  ].some((k) =>
                                    (r.description || "").toLowerCase().includes(k) ||
                                    (r.reason || "").toLowerCase().includes(k)
                                  )
                                    ? "Operasional"
                                    : "Klaim/Retur"
                                )}
                              </span>
                            )}
                          </span>
                          <div className="text-[10px] text-zinc-600 dark:text-slate-400 font-mono mt-1.5 flex items-center justify-center gap-1" title="Tanggal Dilaporkan">
                            <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>Lapor: {r.report_date && r.report_date !== "#N/A" ? formatDate(r.report_date) : r.created_at ? formatDate(r.created_at.split(" ")[0]) : "-"}</span>
                          </div>
                          {isResolved ? (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                              {(() => {
                                const d = calculateDaysUntilClose(r.report_date, r.resolved_date, r.status, r.invoice_date);
                                return (
                                  <span className="inline-flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                    Selesai {d !== "#N/A" ? `(${d} hr)` : ""}
                                  </span>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium mt-1">
                              {(() => {
                                const d = calculateDaysUntilToday(r.report_date);
                                return d !== "-" ? (
                                  <span className="inline-flex items-center gap-0.5 bg-zinc-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-slate-700">
                                    Berjalan {d} hr
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </td>

                        {/* 6. Aksi */}
                        <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReturn((prev) => (prev?.id === r.id ? null : r));
                            }}
                            className={`w-full max-w-[85px] py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all shadow-xs cursor-pointer ${
                              isExpanded
                                ? "bg-black text-white dark:bg-indigo-600 border-black dark:border-indigo-500 shadow-sm"
                                : "bg-zinc-100 hover:bg-zinc-200 text-black border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {isExpanded ? "Tutup" : "Tindakan"}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Accordion Row (Smart Mode) */}
                      {isExpanded && (
                        <tr className="bg-zinc-100/90 dark:bg-[#070b16] border-y-2 border-indigo-500/50 animate-in fade-in duration-150">
                          <td colSpan={6} className="p-2 sm:p-3">
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
        ) : (
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
                  const isReject = (r.status || "").toLowerCase().includes("reject");
                  const isInProgress = (r.status || "").toLowerCase().includes("in progress");
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
                            {(r.photo_url || (r as any).has_photo) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewPhoto(r);
                                }}
                                disabled={loadingPhotoId === r.id}
                                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 border border-violet-200 dark:border-violet-700 hover:scale-105 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                title="Lihat foto bukti kerusakan dari apotek"
                              >
                                <Camera className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                                <span>{loadingPhotoId === r.id ? "Memuat..." : "Foto Bukti"}</span>
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
                              const d = calculateDaysUntilClose(r.report_date, r.resolved_date, r.status, r.invoice_date);
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
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-xs cursor-pointer ${
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
        )}

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
                    fetchPersonnelStats(m, weekFilter, personnelReasonFilter);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white dark:bg-slate-950 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Semua Bulan (Jan - Des 2026)</option>
                  <option value="12" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Desember 2026</option>
                  <option value="11" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">November 2026</option>
                  <option value="10" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Oktober 2026</option>
                  <option value="9" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">September 2026</option>
                  <option value="8" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Agustus 2026</option>
                  <option value="7" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Juli 2026</option>
                  <option value="6" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Juni 2026</option>
                  <option value="5" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Mei 2026</option>
                  <option value="4" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">April 2026</option>
                  <option value="3" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Maret 2026</option>
                  <option value="2" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Februari 2026</option>
                  <option value="1" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Januari 2026</option>
                </select>
              </div>

              {/* Filter Week Leaderboard (Mendukung Rentang 3 Minggu, Rolling 3 Weeks, dan Single Week) */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
                <CalendarRange className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase tracking-wider">Week:</span>
                <select
                  value={weekFilter}
                  onChange={(e) => {
                    const w = e.target.value;
                    setWeekFilter(w);
                    fetchPersonnelStats(monthFilter, w, personnelReasonFilter);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white dark:bg-slate-950 focus:outline-none cursor-pointer pr-1 max-w-[200px] truncate"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
                    Semua Week (W1 – W{availableWeeks[0] || 45})
                  </option>
                  <option
                    value="LAST_3"
                    className="bg-emerald-50 text-emerald-800 dark:bg-slate-900 dark:text-emerald-400 font-bold"
                  >
                    ⚡ 3 Minggu Terakhir (W{Math.max(1, (availableWeeks[0] || 45) - 2)} – W{availableWeeks[0] || 45})
                  </option>

                  <optgroup label="── Rentang 3 Mingguan (3 Weeks) ──" className="font-bold text-zinc-500">
                    {threeWeekBlocks.map((blk) => (
                      <option key={blk.id} value={blk.id} className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
                        {blk.label}
                      </option>
                    ))}
                  </optgroup>

                  <optgroup label="── Minggu Tunggal (Single Week) ──" className="font-bold text-zinc-500">
                    {availableWeeks.map((w) => (
                      <option key={w} value={String(w)} className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
                        Week W{w} {w === currentWeekNumber ? "(Minggu Ini)" : ""}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Quick Toggle Button: 3 Minggu Terakhir */}
              <button
                type="button"
                onClick={() => {
                  const next = weekFilter === "LAST_3" ? "ALL" : "LAST_3";
                  setWeekFilter(next);
                  fetchPersonnelStats(monthFilter, next, personnelReasonFilter);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border shrink-0 ${
                  weekFilter === "LAST_3" || (weekFilter.startsWith("3W:") && weekFilter === `3W:${Math.max(1, (availableWeeks[0] || 45) - 2)}-${availableWeeks[0] || 45}`)
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                    : "bg-zinc-50 dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                }`}
                title="Filter cepat 3 minggu terakhir"
              >
                <span>⚡ 3 Minggu Terakhir</span>
              </button>

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

            {/* Row 2: Filter 4 Kendala Fisik Utama (Personil) */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-zinc-100 dark:border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-slate-200 mr-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] uppercase tracking-wider font-extrabold">Fokus Kendala Fisik:</span>
                </div>

                {/* Pill: Semua Kendala */}
                <button
                  type="button"
                  onClick={() => {
                    setPersonnelReasonFilter("ALL");
                    fetchPersonnelStats(monthFilter, weekFilter, "ALL");
                  }}
                  className={`px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    personnelReasonFilter === "ALL"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-xs"
                      : "bg-zinc-50 dark:bg-slate-950 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-800 hover:border-zinc-300"
                  }`}
                >
                  Semua Kendala
                </button>

                {/* Pill: ⭐ 4 Kendala Fisik Utama (Gabungan) */}
                <button
                  type="button"
                  onClick={() => {
                    setPersonnelReasonFilter("PRIMARY_4");
                    fetchPersonnelStats(monthFilter, weekFilter, "PRIMARY_4");
                  }}
                  className={`px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    personnelReasonFilter === "PRIMARY_4"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-md shadow-emerald-500/25"
                      : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
                  }`}
                  title="Filter personil khusus 4 Kendala Fisik Utama: Kurang, Lebih, Salah, Tidak Ada"
                >
                  ⭐ 4 Kendala Fisik Utama
                </button>

                {/* 4 Individual Physical Reasons */}
                {[
                  { name: "Fisik yang dikirim kurang", color: "#10b981" },
                  { name: "Fisik yang dikirim lebih", color: "#eab308" },
                  { name: "Fisik yang dikirim salah", color: "#f97316" },
                  { name: "Fisik yang dikirim tidak ada", color: "#a855f7" },
                ].map((rz) => {
                  const isSelected = personnelReasonFilter === rz.name;
                  return (
                    <button
                      key={rz.name}
                      type="button"
                      onClick={() => {
                        const next = isSelected ? "ALL" : rz.name;
                        setPersonnelReasonFilter(next);
                        fetchPersonnelStats(monthFilter, weekFilter, next);
                      }}
                      className={`px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? "text-white shadow-xs font-black ring-2 ring-offset-1 ring-white/50"
                          : "bg-zinc-50 dark:bg-slate-950 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-800 hover:border-zinc-400"
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: rz.color, borderColor: rz.color }
                          : {}
                      }
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: rz.color }}
                      />
                      <span>{rz.name}</span>
                    </button>
                  );
                })}

                {/* Pill: Kendala Lainnya */}
                <button
                  type="button"
                  onClick={() => {
                    const next = personnelReasonFilter === "OTHER" ? "ALL" : "OTHER";
                    setPersonnelReasonFilter(next);
                    fetchPersonnelStats(monthFilter, weekFilter, next);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    personnelReasonFilter === "OTHER"
                      ? "bg-zinc-700 text-white border-zinc-600"
                      : "bg-zinc-50 dark:bg-slate-950 text-zinc-500 dark:text-slate-400 border-zinc-200 dark:border-slate-800"
                  }`}
                >
                  Lainnya
                </button>
              </div>

              {/* Reset Filter Button */}
              {(personnelReasonFilter !== "ALL" || weekFilter !== "ALL" || monthFilter !== "ALL" || personnelFilterPbf !== "ALL" || personnelSearchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setPersonnelReasonFilter("ALL");
                    setPersonnelFilterPbf("ALL");
                    setPersonnelSearchQuery("");
                    setMonthFilter("ALL");
                    setWeekFilter("ALL");
                    fetchPersonnelStats("ALL", "ALL", "ALL");
                  }}
                  className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filter Personil</span>
                </button>
              )}
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
        <AnalisisView
          returns={allReturns.length > 0 ? allReturns : returns}
          selectedMonth={monthFilter}
          selectedWeek={weekFilter}
          onMonthChange={(m) => {
            setMonthFilter(m);
            setPage(0);
            fetchPersonnelStats(m, weekFilter);
          }}
          onWeekChange={(w) => {
            setWeekFilter(w);
            setPage(0);
            fetchPersonnelStats(monthFilter, w);
          }}
          onSelectPerson={(p) => {
            setSearch(p);
            setActiveTab("list");
          }}
        />
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

      {/* ─── FULLSCREEN VIDEO PREVIEW MODAL ─── */}
      {previewVideoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewVideoUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-3 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 border-b border-zinc-800 mb-2">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                <span>Video Unboxing Asli dari Apotek (Max 10 Menit)</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  download="video-unboxing.mp4"
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Unduh / Buka di tab baru"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unduh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewVideoUrl(null)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[75vh] w-full flex items-center justify-center p-1 bg-black rounded-xl">
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                className="max-h-[72vh] max-w-full rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL KONFIRMASI: ACC KOMPLAIN (VALID / KESALAHAN PBF ➔ IN PROGRESS) ─── */}
      {showConfirmApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-blue-400 dark:border-blue-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  Konfirmasi Validitas Komplain
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium truncate">
                  Faktur #{selectedReturn?.invoice_no} • {selectedReturn?.customer_name}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 font-medium leading-relaxed">
              Komplain ini disetujui (ACC) sebagai kesalahan pihak PBF dan dialihkan ke tahap <strong>In Progress</strong>.
            </div>

            {/* Pilihan 2 Jenis In Progress */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                Pilih Jenis Penanganan:
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, inprogress_type: "Operasional" })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    editForm.inprogress_type === "Operasional"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-blue-400"
                  }`}
                >
                  <div className="font-black text-xs flex items-center gap-1.5">
                    <Package className="w-4 h-4" />
                    <span>In Progress (Operasional)</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${editForm.inprogress_type === "Operasional" ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"}`}>
                    Kelalaian fisik gudang: Kurang, Lebih, Salah, atau Tidak Ada (Penyiapan fisik pengganti &amp; antar driver).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, inprogress_type: "Klaim & Retur" })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    editForm.inprogress_type === "Klaim & Retur"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-blue-400"
                  }`}
                >
                  <div className="font-black text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>In Progress (Klaim &amp; Retur)</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${editForm.inprogress_type === "Klaim & Retur" ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"}`}>
                    Retur administratif &amp; kondisi barang: Damage On Delivery, ED dekat, recall pabrik, salah SKU apotek.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowConfirmApproveModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(true)}
                className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Ya, Sudah Pasti (ACC) ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL KONFIRMASI: REJECT KOMPLAIN (BUKAN KESALAHAN PBF ➔ REJECTED) ─── */}
      {showConfirmRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-rose-400 dark:border-rose-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  Konfirmasi Penolakan Komplain
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium truncate">
                  Faktur #{selectedReturn?.invoice_no} • {selectedReturn?.customer_name}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Alasan Penolakan PBF (Wajib Diisi):
                </label>
                <textarea
                  rows={2}
                  value={editForm.reject_reason || editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, reject_reason: e.target.value, note: e.target.value })}
                  placeholder="Contoh: Dus luar utuh bersegel dan tidak ada video unboxing saat paket diterima..."
                  className="w-full bg-white dark:bg-zinc-800 border border-rose-300 dark:border-rose-800 rounded-xl p-2 text-xs text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Link Bukti CCTV / Packing List (Opsional):
                </label>
                <input
                  type="text"
                  value={editForm.reject_media_url || ""}
                  onChange={(e) => setEditForm({ ...editForm, reject_media_url: e.target.value })}
                  placeholder="URL Foto/Video Rekaman CCTV Gudang..."
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1.5 text-xs text-zinc-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowConfirmRejectModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(true)}
                className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Ya, Tolak Komplain ✕</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL KONFIRMASI: PENERIMAAN BARANG DI APOTEK (RESOLVED) ─── */}
      {confirmResolveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  Konfirmasi Penerimaan Barang
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Faktur #{confirmResolveItem.invoice_no} • {confirmResolveItem.customer_name}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 font-medium leading-relaxed">
              Apakah fisik barang pengganti sudah benar-benar sampai dan diterima dengan baik oleh pihak apotek?
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmResolveItem(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer"
              >
                Belum Sampai
              </button>
              <button
                type="button"
                onClick={() => handleDirectResolve(confirmResolveItem)}
                className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Ya, Fisik Sudah Sampai &amp; Selesai ✓</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL PERINGATAN VALIDASI DATA INVESTIGASI (MODERN IN-APP DIALOG) ─── */}
      {validationModal && validationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-amber-400/80 dark:border-amber-600/80 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg shrink-0 mt-0.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  {validationModal.title}
                </h3>
                {validationModal.subtitle && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                    {validationModal.subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setValidationModal(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-zinc-800 dark:text-zinc-200 space-y-2.5 leading-relaxed">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                {validationModal.message}
              </p>

              {validationModal.missingFields && validationModal.missingFields.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {validationModal.missingFields.map((field, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-amber-200/80 dark:border-amber-800/60 text-xs font-bold text-amber-800 dark:text-amber-300 shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span>{field}</span>
                    </div>
                  ))}
                </div>
              )}

              {validationModal.note && (
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                  💡 {validationModal.note}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  const cb = validationModal.onConfirm;
                  setValidationModal(null);
                  if (cb) cb();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black text-black bg-amber-400 hover:bg-amber-500 shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{validationModal.onConfirmText || "Mengerti & Lengkapi Data"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ANNOUNCEMENT ONETIME: SOP UPDATE SHIPMENT ERROR ─── */}
      {showSopAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c1222] border-2 border-indigo-500/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900/40 via-blue-900/30 to-purple-900/30 border-b border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🚨</span>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Update Penting Tracker</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                      Wajib Baca
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Pembaruan alur operasional Shipment Error
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissSopAnnouncement}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[75vh] text-xs">
              <p className="font-semibold text-zinc-700 dark:text-slate-300">
                Guys, ada update alur baru di sistem:
              </p>

              {/* Point 1 */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-1.5">
                <div className="font-black text-amber-800 dark:text-amber-400 flex items-center gap-1.5 text-xs">
                  <span>1.</span>
                  <span>CEK FOTO PACKING PBF DULU!</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-amber-950 dark:text-amber-200/90 text-[11px] leading-relaxed font-medium">
                  <li>Buka foto packingan gudang &amp; foto bukti komplain apotek.</li>
                  <li>
                    Kalo <strong>BUKAN salah gudang</strong> ➔ Klik <strong>[ Tindakan ]</strong> di kanan, isi Validitas Komplain jadi <strong className="text-rose-600 dark:text-rose-400">REJECT</strong> + wajib tulis alasannya.
                  </li>
                  <li>
                    Kalo <strong>FIX salah gudang</strong> ➔ Langsung klik tombol biru <strong className="text-blue-600 dark:text-blue-400">[ ACC ]</strong> di kolom paling kiri.
                  </li>
                </ul>
              </div>

              {/* Point 2 */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800/60 space-y-1.5">
                <div className="font-black text-blue-800 dark:text-blue-400 flex items-center gap-1.5 text-xs">
                  <span>2.</span>
                  <span>IN PROGRESS WAJIB 2 STEP (DIKUNCI SISTEM):</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-blue-950 dark:text-blue-200/90 text-[11px] leading-relaxed font-medium">
                  <li>
                    <strong>Step 1 (Investigasi):</strong> Wajib isi Tindakan, Penyebab, &amp; Personilnya siapa. Kalo gak lengkap, gak bisa disimpan!
                  </li>
                  <li>
                    <strong>Step 2 (Penerimaan):</strong> Kirim barang pengganti. Kalo barang udah beneran nyampe di apotek, baru klik tombol ijo <strong className="text-emerald-600 dark:text-emerald-400">[ Selesaikan ]</strong>.
                  </li>
                </ul>
              </div>

              {/* Point 3 */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 space-y-1.5">
                <div className="font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                  <span>3.</span>
                  <span>DATA GAK HILANG:</span>
                </div>
                <p className="pl-4 text-emerald-950 dark:text-emerald-200/90 text-[11px] leading-relaxed font-medium">
                  Kalo data keliatan dikit, itu karena filter bulannya lagi <strong>"November 2026"</strong>. Tinggal ganti filternya ke <strong>"Semua Bulan"</strong> biar 1.800+ datanya muncul semua.
                </p>
              </div>

              <div className="pt-1 text-center text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">
                Langsung terapin mulai sekarang ya. Thank you! 🔥
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-zinc-50 dark:bg-[#070b14] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleDismissSopAnnouncement}
                className="w-full py-2.5 px-4 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Siap, Mengerti &amp; Terapkan ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How To Use Modal */}
      <HowToUseModal
        isOpen={showHowToUse}
        onClose={() => setShowHowToUse(false)}
        initialTab="returns"
        onAcknowledgeWorkflow={() => {
          try {
            localStorage.setItem("has_seen_shipment_workflow_v2", "true");
          } catch {}
        }}
      />
    </div>
  );
}