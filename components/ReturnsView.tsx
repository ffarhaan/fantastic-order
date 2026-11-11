"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";
import { broadcastRealtimeSignal, subscribeToRealtimeSignal, isSuperAdminUser, broadcastNewComplaint } from "@/lib/firestoreService";
import { parsePersonNames } from "@/lib/personnelUtils";
import { AppUser } from "@/components/LoginModal";
import ReturnsAccordionEditor, { ReturnEditFormState, buildReturnEditFormState } from "./returns/ReturnsAccordionEditor";
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
  Eye,
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
import ReturnsExportModal from "./returns/ReturnsExportModal";

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
    if (/^\d{5}$/.test(cleanStr)) {
      const serial = Number(cleanStr);
      const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
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
let cachedRealtimeVersion: number = 0;
let cachedDataVersion: number = 0;

function classifyReturnStatus(status?: string | null, inprogressType?: string | null) {
  const st = (status || "").trim().toLowerCase();
  if (st === "resolved" || st.includes("selesai")) return { bucket: "resolved" as const, isOp: false };
  if (st === "rejected" || st.includes("reject") || st.includes("tolak")) return { bucket: "rejected" as const, isOp: false };
  if (st.includes("in progress")) return { bucket: "in_progress" as const, isOp: inprogressType === "Operasional" };
  return { bucket: "pending" as const, isOp: false };
}

function applyStatsStatusTransition(
  prev: any,
  oldStatus?: string | null,
  oldType?: string | null,
  newStatus?: string | null,
  newType?: string | null
) {
  if (!prev) return prev;
  const from = classifyReturnStatus(oldStatus, oldType);
  const to = classifyReturnStatus(newStatus, newType);
  if (from.bucket === to.bucket && (from.bucket !== "in_progress" || from.isOp === to.isOp)) {
    return prev;
  }
  const next = { ...prev };
  if (from.bucket === "pending") next.totalPending = Math.max(0, (Number(next.totalPending) || 0) - 1);
  else if (from.bucket === "resolved") next.totalResolved = Math.max(0, (Number(next.totalResolved) || 0) - 1);
  else if (from.bucket === "rejected") next.totalReject = Math.max(0, (Number(next.totalReject) || 0) - 1);
  else if (from.bucket === "in_progress") {
    next.totalInProgress = Math.max(0, (Number(next.totalInProgress) || 0) - 1);
    if (from.isOp) next.totalInProgressOperasional = Math.max(0, (Number(next.totalInProgressOperasional) || 0) - 1);
    else next.totalInProgressKlaim = Math.max(0, (Number(next.totalInProgressKlaim) || 0) - 1);
  }

  if (to.bucket === "pending") next.totalPending = (Number(next.totalPending) || 0) + 1;
  else if (to.bucket === "resolved") next.totalResolved = (Number(next.totalResolved) || 0) + 1;
  else if (to.bucket === "rejected") next.totalReject = (Number(next.totalReject) || 0) + 1;
  else if (to.bucket === "in_progress") {
    next.totalInProgress = (Number(next.totalInProgress) || 0) + 1;
    if (to.isOp) next.totalInProgressOperasional = (Number(next.totalInProgressOperasional) || 0) + 1;
    else next.totalInProgressKlaim = (Number(next.totalInProgressKlaim) || 0) + 1;
  }
  cachedReturnsStats = next;
  return next;
}

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
  const [fetchError, setFetchError] = useState<string | null>(null);
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
  const [showExportModal, setShowExportModal] = useState(false);
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

  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const realtimeVersionRef = useRef<number>(cachedRealtimeVersion);
  const ownMutationUntilRef = useRef<number>(0);
  const pendingSignalRefreshRef = useRef<boolean>(false);
  const lastPersonnelSigRef = useRef<string>("");

  const markOwnMutation = useCallback((broadcastTs?: number | void) => {
    ownMutationUntilRef.current = Date.now() + 4500;
    cachedAllReturnsData = null;
    lastPersonnelSigRef.current = "";
    if (typeof broadcastTs === "number" && broadcastTs > 0) {
      realtimeVersionRef.current = Math.max(realtimeVersionRef.current, broadcastTs);
      cachedRealtimeVersion = realtimeVersionRef.current;
      cachedDataVersion = realtimeVersionRef.current;
    }
  }, []);

  // Master Customer & Apotek suggestions
  const [masterCustNames, setMasterCustNames] = useState<string[]>([]);
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

    return list.sort((a, b) => a.localeCompare(b));
  }, [masterCustNames, records]);

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
    caseCounts?: {
      total_cases: number;
      with_person_count: number;
      unassigned_count: number;
      mbi_total: number;
      mai_total: number;
    } | null;
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

  // Fetch all returns for analytic tabs (prioritizes memory cache, backed by Versioned Edge CDN)
  const fetchAllReturns = useCallback(async (forceFresh = false) => {
    // If not forcing fresh and we already have cached data in memory, prioritize instant memory read (<1ms)
    if (!forceFresh && cachedAllReturnsData && cachedAllReturnsData.length > 0) {
      setAllReturns(cachedAllReturnsData);
      return;
    }
    try {
      const q = new URLSearchParams({ action: "returns", limit: "5000" });
      if (forceFresh) {
        q.set("fresh", "true");
        q.set("_t", String(Date.now()));
      } else if (realtimeVersionRef.current > 0) {
        q.set("_v", String(realtimeVersionRef.current));
      }
      const res = await fetch(`/api/tidb?${q.toString()}`, forceFresh ? { cache: "no-store" } : undefined);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setFetchError(null);
        setAllReturns(json.data);
        cachedAllReturnsData = json.data;
      } else if (!json.success && json.error) {
        setFetchError(json.error);
      }
    } catch (e: any) {
      console.error("fetchAllReturns error:", e);
      setFetchError(e?.message || String(e));
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
        ownMutationUntilRef.current = Date.now() + 4500;
        cachedAllReturnsData = null;
        lastPersonnelSigRef.current = "";
        const ts = await broadcastRealtimeSignal("returns");
        markOwnMutation(ts);
        fetchReturns(false, true);
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

  const fetchPersonnelStats = useCallback(async (
    selectedMonth = monthFilter,
    selectedWeek = weekFilter,
    selectedReason = personnelReasonFilter,
    forceFresh = false
  ) => {
    const sig = `${selectedMonth}|${selectedWeek}|${selectedReason}|${realtimeVersionRef.current}`;
    if (!forceFresh && lastPersonnelSigRef.current === sig) return;
    setLoadingStats(true);
    try {
      const q = new URLSearchParams({ 
        action: "personnel_stats",
      });
      if (selectedMonth && selectedMonth !== "ALL") q.set("month", selectedMonth);
      if (selectedWeek && selectedWeek !== "ALL") q.set("week", selectedWeek);
      if (selectedReason && selectedReason !== "ALL") q.set("reason", selectedReason);
      if (forceFresh) {
        q.set("fresh", "true");
        q.set("_t", String(Date.now()));
      } else if (realtimeVersionRef.current > 0) {
        q.set("_v", String(realtimeVersionRef.current));
      }
      const res = await fetch(`/api/tidb?${q.toString()}`, forceFresh ? { cache: "no-store" } : undefined);
      const json = await res.json();
      if (json.success) {
        lastPersonnelSigRef.current = sig;
        setPersonnelStats({
          personnel: json.personnel || [],
          caseCounts: json.caseCounts || null,
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
    if (activeTab === "leaderboard") {
      fetchPersonnelStats();
    }
  }, [activeTab, fetchPersonnelStats]);

  const handleCopyComplaintLink = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/komplain`;
      navigator.clipboard.writeText(url).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      });
    }
  };

  // Form state kept for Approve / Reject confirmation modals
  const [editForm, setEditForm] = useState<ReturnEditFormState>({
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
      setEditForm(buildReturnEditFormState(selectedReturn));
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
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (pbfFilter !== "ALL") params.set("pbf", pbfFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (monthFilter !== "ALL") params.set("month", monthFilter);
      if (weekFilter !== "ALL") params.set("week", weekFilter);
      if (forceFresh) {
        params.set("fresh", "true");
        params.set("_t", String(Date.now()));
      } else if (realtimeVersionRef.current > 0) {
        params.set("_v", String(realtimeVersionRef.current));
      }

      const res = await fetch(
        `/api/tidb?${params.toString()}`,
        forceFresh ? { cache: "no-store" } : undefined
      );
      const data = await res.json();
      if (data.success) {
        setFetchError(null);
        setReturns(data.data || []);
        setTotal(data.total || 0);
        if (data.stats) setStats(data.stats);
        cachedReturnsData = data.data || [];
        cachedTotalCount = data.total || 0;
        if (data.stats) cachedReturnsStats = data.stats;
        cachedDataVersion = realtimeVersionRef.current;
      } else {
        const errMsg = data.error || "Gagal memuat data shipment returns dari database.";
        console.error("fetchReturns failed:", errMsg);
        setFetchError(errMsg);
      }
    } catch (err: any) {
      console.error("Failed to fetch returns:", err);
      setFetchError(err?.message || String(err));
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
  const fetchPersonnelStatsRef = useRef(fetchPersonnelStats);
  fetchPersonnelStatsRef.current = fetchPersonnelStats;

  // Single query for active page when filters change (Limit 50 - <50ms)
  useEffect(() => {
    const hasCache = Boolean(cachedReturnsData && cachedReturnsData.length > 0);
    fetchReturns(hasCache);
  }, [fetchReturns]);

  // Real-time Firestore cross-browser signal (Mounted ONCE with Zero Listener Churn)
  useEffect(() => {
    let debounceTimer: any = null;
    const triggerRemoteSync = () => {
      // Use versioned URL (_v=signalTs): misses CDN once for fresh DB read, then caches at edge for peers
      fetchReturnsRef.current(true, false);
      if (activeTabRef.current !== "list") {
        fetchAllReturnsRef.current(false);
      }
      if (activeTabRef.current === "leaderboard") {
        fetchPersonnelStatsRef.current();
      }
    };

    const unsubRealtime = subscribeToRealtimeSignal(
      "returns",
      (val) => {
        realtimeVersionRef.current = Math.max(realtimeVersionRef.current, val);
        cachedRealtimeVersion = realtimeVersionRef.current;

        // Ignore our own broadcast echo so optimistic UI never flickers/reverts
        if (Date.now() < ownMutationUntilRef.current) {
          return;
        }

        cachedAllReturnsData = null;
        lastPersonnelSigRef.current = "";

        // Defer network sync if this browser tab is hidden/inactive
        if (typeof document !== "undefined" && document.hidden) {
          pendingSignalRefreshRef.current = true;
          return;
        }

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(triggerRemoteSync, 400);
      },
      (initVal) => {
        realtimeVersionRef.current = Math.max(realtimeVersionRef.current, initVal);
        cachedRealtimeVersion = realtimeVersionRef.current;
        if (cachedReturnsData && initVal > cachedDataVersion) {
          cachedAllReturnsData = null;
          lastPersonnelSigRef.current = "";
          if (typeof document !== "undefined" && document.hidden) {
            pendingSignalRefreshRef.current = true;
          } else {
            fetchReturnsRef.current(true, false);
          }
        }
      }
    );

    const onFocusOrVisible = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (pendingSignalRefreshRef.current) {
        pendingSignalRefreshRef.current = false;
        lastFocusFetchRef.current = Date.now();
        triggerRemoteSync();
        return;
      }
      const now = Date.now();
      // Throttle passive focus refetch to at most once per 5 minutes to prevent origin leakage
      if (now - lastFocusFetchRef.current > 300000) {
        lastFocusFetchRef.current = now;
        fetchReturnsRef.current(true, false);
      }
    };
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubRealtime();
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, []);

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
    const deletedItem = returns.find((r) => r.id === id) || allReturns.find((r) => r.id === id);
    setReturns((prev) => {
      const next = prev.filter((r) => r.id !== id);
      cachedReturnsData = next;
      return next;
    });
    setAllReturns((prev) => prev.filter((r) => r.id !== id));
    if (cachedAllReturnsData) {
      cachedAllReturnsData = cachedAllReturnsData.filter((r) => r.id !== id);
    }
    setTotal((prev) => {
      const next = Math.max(0, prev - 1);
      cachedTotalCount = next;
      return next;
    });
    if (selectedReturn?.id === id) {
      setSelectedReturn(null);
    }

    // Optimistic Local Stats Decrement
    if (deletedItem) {
      const cls = classifyReturnStatus(deletedItem.status, deletedItem.inprogress_type);
      setStats((prev: any) => {
        const next = { ...prev };
        next.totalAll = Math.max(0, (Number(next.totalAll) || 1) - 1);
        if (cls.bucket === "in_progress") {
          next.totalInProgress = Math.max(0, (Number(next.totalInProgress) || 1) - 1);
          if (cls.isOp) {
            next.totalInProgressOperasional = Math.max(0, (Number(next.totalInProgressOperasional) || 1) - 1);
          } else {
            next.totalInProgressKlaim = Math.max(0, (Number(next.totalInProgressKlaim) || 1) - 1);
          }
        } else if (cls.bucket === "pending") {
          next.totalPending = Math.max(0, (Number(next.totalPending) || 1) - 1);
        } else if (cls.bucket === "resolved") {
          next.totalResolved = Math.max(0, (Number(next.totalResolved) || 1) - 1);
        } else if (cls.bucket === "rejected") {
          next.totalReject = Math.max(0, (Number(next.totalReject) || 1) - 1);
        }
        cachedReturnsStats = next;
        return next;
      });
    }

    // 2. Background Asynchronous Persistence (Non-Blocking 0ms UI delay)
    try {
      markOwnMutation();
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
        const ts = await broadcastRealtimeSignal("returns");
        markOwnMutation(ts);
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
    const targetItem = returns.find((r) => r.id === id) || allReturns.find((r) => r.id === id);
    const resolvedDate = newStatus === "Resolved" ? new Date().toISOString().split("T")[0] : null;
    setReturns((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status: newStatus, resolved_date: resolvedDate || r.resolved_date } : r));
      cachedReturnsData = next;
      return next;
    });
    if (targetItem) {
      setStats((prev: any) =>
        applyStatsStatusTransition(prev, targetItem.status, targetItem.inprogress_type, newStatus, targetItem.inprogress_type)
      );
    }
    if (selectedReturn?.id === id) {
      setSelectedReturn((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    setIsUpdating(true);
    try {
      markOwnMutation();
      const res = await fetch("/api/tidb?action=update_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          invoice_no: targetItem?.invoice_no,
          status: newStatus,
          resolved_date: resolvedDate,
          user_name: currentUser?.name || "Admin",
          user_email: currentUser?.email || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        const ts = await broadcastRealtimeSignal("returns");
        markOwnMutation(ts);
      } else {
        alert("Gagal memperbarui status komplain: " + (data.error || "Unknown error"));
        fetchReturns(true, true);
      }
    } catch (err) {
      alert("Gagal memperbarui status komplain.");
      fetchReturns(true, true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEdit = async (
    param?: boolean | React.MouseEvent,
    formOverride?: ReturnEditFormState
  ) => {
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

    const activeForm = formOverride ?? editForm;

    // Form Guard Tahap 4: REJECTED wajib sertakan alasan penolakan + Konfirmasi
    const isRejecting = activeForm.status === "Rejected" || activeForm.confirm === "Reject";
    if (isRejecting) {
      if (!activeForm.note || !activeForm.note.trim()) {
        setEditForm(activeForm);
        setValidationModal({
          isOpen: true,
          title: "Catatan Alasan Reject Wajib Diisi",
          subtitle: `Faktur #${activeForm.invoice_no || selectedReturn.invoice_no} • ${activeForm.customer_name || selectedReturn.customer_name}`,
          message: "Tiket yang ditolak (Reject) wajib menyertakan alasan penolakan pada kolom Catatan Balasan Logistik.",
          missingFields: ["Catatan Balasan Logistik / Alasan Penolakan"],
          note: "Catatan ini akan langsung terbaca oleh apotek pengaju komplain sebagai kejelasan penolakan.",
          type: "error",
          onConfirmText: "Isi Catatan Penolakan",
        });
        return;
      }
      if (!skipDeliveryConfirm && selectedReturn.status !== "Rejected") {
        setEditForm(activeForm);
        setShowConfirmRejectModal(true);
        return;
      }
    }

    // Form Guard Tahap 2: ACC / IN PROGRESS konfirmasi kesalahan PBF
    const isApproveAcc = activeForm.status === "In Progress" || activeForm.confirm === "Approve";
    if (isApproveAcc && !skipDeliveryConfirm && selectedReturn.status !== "In Progress") {
      setEditForm(activeForm);
      setShowConfirmApproveModal(true);
      return;
    }

    // Deteksi apakah jenis komplain adalah Klaim & Retur (personil tidak wajib)
    const isKlaimRetur = activeForm.inprogress_type === "Klaim & Retur" || selectedReturn.inprogress_type === "Klaim & Retur" || (
      !activeForm.inprogress_type && ![
        "fisik yang dikirim kurang",
        "fisik yang dikirim lebih",
        "fisik yang dikirim salah",
        "fisik yang dikirim tidak ada",
      ].some((k) =>
        (selectedReturn.description || "").toLowerCase().includes(k) ||
        (activeForm.reason || "").toLowerCase().includes(k)
      )
    );

    // Form Guard Tahap 2 (Proses 1): Tiket yang SEDANG In Progress wajib lengkapi investigasi gudang
    const isCurrentlyInProgress = selectedReturn.status === "In Progress" && activeForm.status === "In Progress";
    if (isCurrentlyInProgress) {
      const hasAction = activeForm.action && activeForm.action.trim() && activeForm.action !== "-" && activeForm.action !== "#N/A";
      const hasRootCause = activeForm.root_cause && activeForm.root_cause.trim() && activeForm.root_cause !== "-" && activeForm.root_cause !== "#N/A";
      const hasPerson = activeForm.person && activeForm.person.trim() && activeForm.person !== "-" && activeForm.person !== "#N/A";
      const isPersonRequired = !isKlaimRetur;

      if (!hasAction || !hasRootCause || (isPersonRequired && !hasPerson)) {
        const missing: string[] = [];
        if (!hasAction) missing.push("Tindakan Solusi Gudang (Action)");
        if (!hasRootCause) missing.push("Penyebab Kesalahan (Root Cause)");
        if (isPersonRequired && !hasPerson) missing.push("Personil Terkait (Picker / Checker)");

        setEditForm(activeForm);
        setValidationModal({
          isOpen: true,
          title: "Data Investigasi Belum Lengkap",
          subtitle: `Faktur #${activeForm.invoice_no || selectedReturn.invoice_no} • ${activeForm.customer_name || selectedReturn.customer_name}`,
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
    const isResolving = activeForm.status === "Resolved";
    if (isResolving) {
      const hasAction = activeForm.action && activeForm.action.trim() && activeForm.action !== "-" && activeForm.action !== "#N/A";
      const hasRootCause = activeForm.root_cause && activeForm.root_cause.trim() && activeForm.root_cause !== "-" && activeForm.root_cause !== "#N/A";
      const hasPerson = activeForm.person && activeForm.person.trim() && activeForm.person !== "-" && activeForm.person !== "#N/A";
      const isPersonRequired = !isKlaimRetur;

      if (!hasAction || !hasRootCause || (isPersonRequired && !hasPerson)) {
        const missing: string[] = [];
        if (!hasAction) missing.push("Tindakan Solusi Gudang (Action)");
        if (!hasRootCause) missing.push("Penyebab Kesalahan (Root Cause)");
        if (isPersonRequired && !hasPerson) missing.push("Personil Terkait (Picker / Checker)");

        setEditForm(activeForm);
        setValidationModal({
          isOpen: true,
          title: "Tiket Belum Dapat Diselesaikan",
          subtitle: `Faktur #${activeForm.invoice_no || selectedReturn.invoice_no} • ${activeForm.customer_name || selectedReturn.customer_name}`,
          message: "Tiket belum bisa ditandai selesai karena data solusi/penyebab belum lengkap:",
          missingFields: missing,
          note: isKlaimRetur ? "Untuk jenis Klaim & Retur, nama personil boleh dikosongkan." : "Silakan lengkapi tindakan solusi, penyebab kesalahan, dan personil terkait sebelum tiket diselesaikan.",
          type: "warning",
          onConfirmText: "Lengkapi Data",
        });
        return;
      }

      if (!skipDeliveryConfirm && selectedReturn.status !== "Resolved") {
        setEditForm(activeForm);
        setConfirmResolveItem({ ...selectedReturn, ...activeForm });
        return;
      }
    }

    // 1. INSTANT OPTIMISTIC TRANSITION (<1ms) - Seketika berubah di layar
    setShowConfirmApproveModal(false);
    setShowConfirmRejectModal(false);
    setShowDeliveryPrepModal(false);
    setSelectedReturn(null);

    const isResolved = activeForm.status === "Resolved";
    const resolvedDate = isResolved
      ? activeForm.resolved_date || new Date().toISOString().split("T")[0]
      : activeForm.resolved_date;

    const updatedItem = {
      ...selectedReturn,
      ...activeForm,
      resolved_date: resolvedDate,
    };

    setReturns((prev) => {
      const next = prev.map((r) => (r.id === selectedReturn.id ? updatedItem : r));
      cachedReturnsData = next;
      return next;
    });
    setAllReturns((prev) =>
      prev.map((r) => (r.id === selectedReturn.id ? updatedItem : r))
    );
    if (cachedAllReturnsData) {
      cachedAllReturnsData = cachedAllReturnsData.map((r) => (r.id === selectedReturn.id ? updatedItem : r));
    }

    // Optimistic Local Stats Sync (semua transisi status)
    setStats((prev: any) =>
      applyStatsStatusTransition(
        prev,
        selectedReturn.status,
        selectedReturn.inprogress_type,
        activeForm.status,
        activeForm.inprogress_type
      )
    );

    // 2. Background Asynchronous Persistence (0ms UI freeze, 0 duplicate activity_log POST)
    const payload = {
      id: selectedReturn.id,
      ...activeForm,
      resolved_date: resolvedDate,
      user_name: currentUser?.name || "Admin",
      user_email: currentUser?.email || "",
    };

    markOwnMutation();
    fetch("/api/tidb?action=update_return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({ success: false }));
      if (data.success) {
        const ts = await broadcastRealtimeSignal("returns");
        markOwnMutation(ts);
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
    setReturns((prev) => {
      const next = prev.map((r) => (r.id === item.id ? resolvedItem : r));
      cachedReturnsData = next;
      return next;
    });
    setAllReturns((prev) =>
      prev.map((r) => (r.id === item.id ? resolvedItem : r))
    );
    if (cachedAllReturnsData) {
      cachedAllReturnsData = cachedAllReturnsData.map((r) => (r.id === item.id ? resolvedItem : r));
    }

    // Optimistic Local Stats Sync
    setStats((prev: any) =>
      applyStatsStatusTransition(
        prev,
        item.status,
        item.inprogress_type,
        "Resolved",
        item.inprogress_type
      )
    );

    // 2. Background Asynchronous Persistence (0ms UI wait, 0 duplicate activity_log POST)
    const payload: any = {
      id: item.id,
      invoice_no: item.invoice_no,
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

    markOwnMutation();
    fetch("/api/tidb?action=update_return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({ success: false }));
      if (data.success) {
        const ts = await broadcastRealtimeSignal("returns");
        markOwnMutation(ts);
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
      markOwnMutation();
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
        const ts = await broadcastRealtimeSignal("returns");
        markOwnMutation(ts);
        fetchReturns(false, true);
        broadcastNewComplaint({
          id: String(data.id || newForm.invoice_no),
          customer_name: newForm.customer_name,
          invoice_no: newForm.invoice_no,
          reason: newForm.reason,
          pbf: newForm.pbf,
          timestamp: Date.now(),
        }).catch(() => {});
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
    setShowExportModal(true);
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

  // Transparent case counts matching 100% of the actual cases in the database
  const personnelCaseCounts = useMemo(() => {
    if (personnelStats?.caseCounts) {
      const cc = personnelStats.caseCounts;
      return {
        total_cases: Number(cc.total_cases || 0),
        with_person_count: Number(cc.with_person_count || 0),
        unassigned_count: Number(cc.unassigned_count || 0),
        mbi_total: Number(cc.mbi_total || 0),
        mai_total: Number(cc.mai_total || 0),
      };
    }
    // Fallback computed from current filtered returns if API response hasn't arrived
    const filterM = monthFilter !== "ALL" ? Number(monthFilter) : 0;
    let total = 0;
    let withP = 0;
    let unassigned = 0;
    let mbi = 0;
    let mai = 0;
    const sourceList = allReturns.length > 0 ? allReturns : returns;
    for (const r of sourceList) {
      if (filterM > 0) {
        const d = r.report_date || r.invoice_date || r.created_at || "";
        const m = d ? new Date(d).getMonth() + 1 : Number(r.month) || 0;
        if (m !== filterM) continue;
      }
      total++;
      const p = (r.person || "").trim().toUpperCase();
      if (p && !['REJECT', '-', '#N/A', 'ADMIN', 'NONE', 'NULL'].includes(p)) {
        withP++;
      } else {
        unassigned++;
      }
      const pbf = (r.pbf || "MBI").toUpperCase();
      if (pbf.includes("MAI")) mai++;
      else mbi++;
    }
    return {
      total_cases: total,
      with_person_count: withP,
      unassigned_count: unassigned,
      mbi_total: mbi,
      mai_total: mai,
    };
  }, [personnelStats, allReturns, returns, monthFilter]);

  // Personnel Cases Drill-down state
  const [personnelDrillDown, setPersonnelDrillDown] = useState<{
    isOpen: boolean;
    personName: string;
    title: string;
  } | null>(null);
  const [personnelDrillDownSearch, setPersonnelDrillDownSearch] = useState("");

  const personnelDrillDownRows = useMemo(() => {
    if (!personnelDrillDown?.isOpen) return [];
    const targetName = (personnelDrillDown.personName || "").trim().toUpperCase();
    const isUnassigned = targetName === "UNASSIGNED" || targetName === "TANPA PERSONIL";
    const isAll = targetName === "ALL" || targetName === "SEMUA";
    const filterM = monthFilter !== "ALL" ? Number(monthFilter) : 0;
    const sourceList = allReturns.length > 0 ? allReturns : returns;

    return sourceList.filter((r) => {
      // Month filter
      if (filterM > 0) {
        const d = r.report_date || r.invoice_date || r.created_at || "";
        const m = d ? new Date(d).getMonth() + 1 : Number(r.month) || 0;
        if (m !== filterM) return false;
      }
      // PBF filter
      if (personnelFilterPbf !== "ALL") {
        if ((r.pbf || "MBI").toUpperCase() !== personnelFilterPbf) return false;
      }
      // Person match
      const p = (r.person || "").trim().toUpperCase();
      if (isAll) {
        // keep all
      } else if (isUnassigned) {
        if (p && !['REJECT', '-', '#N/A', 'ADMIN', 'NONE', 'NULL'].includes(p)) return false;
      } else {
        const parsed = parsePersonNames(r.person);
        if (!parsed.includes(targetName) && !parsed.some((n) => n.toUpperCase() === targetName)) return false;
      }
      // Search inside modal
      if (personnelDrillDownSearch.trim()) {
        const q = personnelDrillDownSearch.toLowerCase();
        const str = `${r.invoice_no || ""} ${r.so_no || ""} ${r.customer_name || ""} ${r.product_name || ""} ${r.reason || ""} ${r.person || ""} ${r.status || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [personnelDrillDown, allReturns, returns, monthFilter, personnelFilterPbf, personnelDrillDownSearch]);

  const handleExportPersonnelDrillDown = useCallback(() => {
    if (!personnelDrillDownRows.length) return;
    const formatted = personnelDrillDownRows.map((r, i) => ({
      No: i + 1,
      PBF: r.pbf || "MBI",
      "No. Faktur": r.invoice_no || "-",
      "No. SO": r.so_no || "-",
      "Nama Pelanggan": r.customer_name || "-",
      "Nama Produk": r.product_name || "-",
      Qty: r.qty || 1,
      "No. Batch": r.batch_no || "-",
      "Alasan Kendala": r.reason || "-",
      "Akar Penyebab": r.root_cause || "-",
      "Personil Terkait": r.person || "-",
      Status: r.status || "-",
      "Tanggal Lapor": r.report_date || r.invoice_date || "-",
      "Tindakan Solusi": r.action || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kasus_Personil");
    const safeTitle = (personnelDrillDown?.personName || "Semua").replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, `Bukti_Kasus_Personil_${safeTitle}_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [personnelDrillDownRows, personnelDrillDown]);

  const totalPages = Math.ceil(total / limit);

  const handleCloseSelectedReturn = useCallback(() => {
    setSelectedReturn(null);
  }, []);

  const handlePreviewVideoUrl = useCallback((url: string) => {
    setPreviewVideoUrl(url || null);
  }, []);

  const handleDeleteReturnRef = useRef(handleDeleteReturn);
  handleDeleteReturnRef.current = handleDeleteReturn;
  const handleAccordionDelete = useCallback((id: number, invoiceNo: string) => {
    handleDeleteReturnRef.current(id, invoiceNo);
  }, []);

  const handleSaveEditRef = useRef(handleSaveEdit);
  handleSaveEditRef.current = handleSaveEdit;
  const handleAccordionSubmitSave = useCallback((formSnapshot: ReturnEditFormState) => {
    handleSaveEditRef.current(false, formSnapshot);
  }, []);

  const renderAccordionEditor = (r: ShipmentReturnRecord) => (
    <ReturnsAccordionEditor
      record={r}
      canEditReturns={canEditReturns}
      canDeleteReturns={canDeleteReturns}
      isUpdating={isUpdating}
      loadingPhotoId={loadingPhotoId}
      customerSuggestionsList={customerSuggestionsList}
      complaintReasons={COMPLAINT_REASONS}
      calculateDaysUntilToday={calculateDaysUntilToday}
      calculateDaysUntilClose={calculateDaysUntilClose}
      onPreviewPhoto={handlePreviewPhoto}
      onPreviewVideo={handlePreviewVideoUrl}
      onClose={handleCloseSelectedReturn}
      onDelete={handleAccordionDelete}
      onSubmitSave={handleAccordionSubmitSave}
      onSelectCustomer={onSelectCustomer}
    />
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
    <div className="space-y-4">
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
        <WeeklyReportView
          returns={allReturns.length > 0 ? allReturns : returns}
          records={records}
          initialWeekFilter={weekFilter !== "ALL" ? weekFilter : "all"}
        />
      )}

      {/* ─── TAB: OPEN CASES ─── */}
      {activeTab === "open" && (
        <OpenCasesView
          returns={allReturns.length > 0 ? allReturns : returns}
          onRefreshParentReturns={() => {
            markOwnMutation();
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
        <div className="space-y-4">
          {fetchError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Gagal Mengambil Data dari TiDB Database</h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5 font-medium">
                    {fetchError.includes("usage quota") || fetchError.includes("1105")
                      ? "⚠️ Kuota penggunaan database TiDB Cloud telah habis (Usage Quota Exhausted / Error 1105). Query ke database sedang dibatasi oleh TiDB Cloud hingga spending limit disesuaikan."
                      : fetchError}
                  </p>
                  {fetchError.includes("usage quota") && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      👉 Solusi: Buka dashboard <a href="https://tidbcloud.com" target="_blank" rel="noreferrer" className="underline font-bold">tidbcloud.com</a> &rarr; Pilih Cluster &rarr; Atur <strong>Spending Limit</strong> agar akses dibuka kembali.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchReturns(false, true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          )}

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
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-black flex items-center gap-1 shadow-xs">
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
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
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
                      ? "border-blue-400 dark:border-blue-400 ring-2 ring-blue-500/20 bg-blue-500/10 dark:bg-blue-950/60 shadow-sm"
                      : `${statusFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 bg-white dark:bg-slate-900`
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-blue-500 text-white flex items-center gap-1 shadow-xs">
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
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500 text-white flex items-center gap-1 shadow-xs">
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
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
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
                  className={`relative overflow-hidden rounded-2xl border p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer touch-manipulation transition-colors select-none ${
                    statusFilter === "Rejected"
                      ? "border-rose-400 dark:border-rose-400 ring-2 ring-rose-500/20 bg-rose-500/10 dark:bg-rose-950/60 shadow-sm"
                      : `${statusFilter !== "ALL" ? "opacity-50 hover:opacity-100" : "opacity-90 hover:opacity-100"} border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-700 bg-white dark:bg-slate-900`
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
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500 text-white flex items-center gap-1 shadow-xs">
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
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
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
                className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Komplain</span>
              </button>
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                disabled={isImporting}
                className="py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                title="Impor Data Excel / CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 rotate-180" />
                <span>{isImporting ? "Mengimpor..." : "Impor Excel"}</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 border border-zinc-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Buka modal Ekspor Excel (Custom Filter / Ekspor Keseluruhan Sistem)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{`Ekspor Excel${Number(stats.totalAll || total || 0) > 0 ? ` (${Number(stats.totalAll || total || 0).toLocaleString("id-ID")})` : ""}`}</span>
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
                if (activeTabRef.current === "leaderboard") {
                  fetchPersonnelStats(m, weekFilter);
                }
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
                if (activeTabRef.current === "leaderboard") {
                  fetchPersonnelStats(monthFilter, w);
                }
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
                  <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-white dark:bg-[#0c1222] border border-zinc-200 dark:border-zinc-700 shadow-xl p-3 text-xs space-y-2">
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
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* â”€â”€â”€ Enterprise Returns Table â”€â”€â”€ */}
      {/* ─── Mobile Cards View (Khusus Tampilan HP / Layar Kecil) ─── */}
      {isMobileViewport !== false && (
      <div className="block md:hidden space-y-3 pb-24 max-w-full overflow-hidden">
        {loading && returns.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 bg-white dark:bg-[#0a0f1c] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
            <span className="font-semibold text-xs">Memuat data tiket komplain...</span>
          </div>
        ) : returns.length === 0 ? (
          fetchError ? (
            <div className="py-8 text-center text-rose-600 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/40 p-6 shadow-xs">
              <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
              <p className="font-bold text-xs">Gagal Memuat Data dari Database</p>
              <p className="text-[11px] text-rose-500/90 dark:text-rose-400 mt-1 font-mono break-all max-w-md mx-auto">{fetchError}</p>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-400 bg-white dark:bg-[#0a0f1c] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs">
              <RotateCcw className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
              <p className="font-semibold text-xs text-zinc-600 dark:text-slate-400">Tidak ada tiket komplain yang cocok</p>
              <p className="text-[11px] text-zinc-400 dark:text-slate-500 mt-1">Gunakan kata kunci lain atau ubah status filter.</p>
            </div>
          )
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
                        className="h-9 py-2 px-3 rounded-xl text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors touch-manipulation cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{loadingPhotoId === r.id ? "Memuat..." : "Foto"}</span>
                      </button>
                    )}
                    {r.video_url && (
                      <button
                        type="button"
                        onClick={() => setPreviewVideoUrl(r.video_url || null)}
                        className="h-9 py-2 px-3 rounded-xl text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors touch-manipulation cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                      className={`h-9 py-2 px-3.5 rounded-xl text-xs font-bold transition-colors touch-manipulation cursor-pointer ${
                        isExpanded
                          ? "bg-black text-white dark:bg-blue-600"
                          : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700"
                      }`}
                    >
                      {isExpanded ? "Tutup Detail" : "Edit & Tindakan"}
                    </button>
                  </div>
                </div>

                {/* Mobile Expanded Form */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-900/60">
                    {renderAccordionEditor(r)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      )}

      {/* ─── Enterprise Returns Table (Desktop & Tablet) ─── */}
      {isMobileViewport !== true && (
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
                    {fetchError ? (
                      <div className="text-rose-600 dark:text-rose-300 max-w-lg mx-auto p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                        <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
                        <p className="font-bold text-sm">Gagal Mengambil Data dari Database</p>
                        <p className="text-xs text-rose-500/90 dark:text-rose-400 mt-1 font-mono break-all">{fetchError}</p>
                      </div>
                    ) : (
                      <>
                        <RotateCcw className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
                        <p className="font-semibold text-sm text-zinc-600 dark:text-slate-400">Tidak ada tiket komplain/retur yang cocok</p>
                        <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">Gunakan kata kunci lain atau ubah status filter.</p>
                      </>
                    )}
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
                              className="w-full py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] inline-flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
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
                              className="w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] inline-flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                                title="Lihat foto bukti kerusakan dari apotek"
                              >
                                <Camera className="w-3 h-3 text-blue-600 dark:text-blue-400" />
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700 transition-colors shadow-xs cursor-pointer"
                                title="Tonton video unboxing dari apotek"
                              >
                                <Video className="w-3 h-3 text-blue-600 dark:text-blue-400" />
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
                        <tr className="bg-zinc-100/90 dark:bg-[#070b16] border-y-2 border-blue-500/50">
                          <td colSpan={6} className="p-2 sm:p-3">
                            {renderAccordionEditor(r)}
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
                    {fetchError ? (
                      <div className="text-rose-600 dark:text-rose-300 max-w-lg mx-auto p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                        <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
                        <p className="font-bold text-sm">Gagal Mengambil Data dari Database</p>
                        <p className="text-xs text-rose-500/90 dark:text-rose-400 mt-1 font-mono break-all">{fetchError}</p>
                      </div>
                    ) : (
                      <>
                        <RotateCcw className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-50" />
                        <p className="font-semibold text-sm text-zinc-600 dark:text-slate-400">Tidak ada tiket komplain/retur yang cocok</p>
                        <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">Gunakan kata kunci lain atau ubah status filter.</p>
                      </>
                    )}
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
                                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                                title="Lihat foto bukti kerusakan dari apotek"
                              >
                                <Camera className="w-3 h-3 text-blue-600 dark:text-blue-400" />
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
                        <tr className="bg-zinc-100/90 dark:bg-[#070b16] border-y-2 border-blue-500/50">
                          <td colSpan={14} className="p-2 sm:p-3">
                            {renderAccordionEditor(r)}
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
      )}
      </div>
      )}

      {/* ─── TAB 2: LEADERBOARD PERSONIL (PELAKU KESALAHAN GUDANG) ─── */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          {/* Top Summary Cards (100% Transparan & Sesuai Data Kasus Riil) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Total Kasus Riil Database */}
            <div
              onClick={() => setPersonnelDrillDown({ isOpen: true, personName: "ALL", title: "Semua Bukti Kasus Komplain Riil" })}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer group flex flex-col justify-between"
              title="Klik untuk melihat 100% data kasus riil"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                    TOTAL KASUS KOMPLAIN
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Data Riil ↗
                  </span>
                </div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {personnelCaseCounts.total_cases.toLocaleString("id-ID")} Kasus
                </h3>
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-slate-800/80 text-[11px] flex items-center justify-between text-zinc-500 dark:text-slate-400 font-medium">
                <span>MBI: <strong className="text-zinc-800 dark:text-zinc-200">{personnelCaseCounts.mbi_total}</strong></span>
                <span>MAI: <strong className="text-zinc-800 dark:text-zinc-200">{personnelCaseCounts.mai_total}</strong></span>
              </div>
            </div>

            {/* Card 2: Teridentifikasi Personil */}
            <div
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                    TERIDENTIFIKASI PERSONIL
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {personnelCaseCounts.total_cases > 0 ? ((personnelCaseCounts.with_person_count / personnelCaseCounts.total_cases) * 100).toFixed(0) : 0}% Terdata
                  </span>
                </div>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {personnelCaseCounts.with_person_count.toLocaleString("id-ID")} Kasus
                </h3>
              </div>
              <p className="mt-2 pt-2 border-t border-zinc-100 dark:border-slate-800/80 text-[11px] text-zinc-500 dark:text-slate-400 font-medium">
                {filteredPersonnel.length} personil ({totalPersonnelErrors} total atribusi)
              </p>
            </div>

            {/* Card 3: Tanpa Personil / Klaim Retur */}
            <div
              onClick={() => setPersonnelDrillDown({ isOpen: true, personName: "UNASSIGNED", title: "Kasus Tanpa Nama Personil / Klaim Retur" })}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group flex flex-col justify-between"
              title="Klik untuk melihat kasus tanpa nama personil"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    TANPA PERSONIL / RETUR
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Opsional ↗
                  </span>
                </div>
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 group-hover:text-amber-700 transition-colors">
                  {personnelCaseCounts.unassigned_count.toLocaleString("id-ID")} Kasus
                </h3>
              </div>
              <p className="mt-2 pt-2 border-t border-zinc-100 dark:border-slate-800/80 text-[11px] text-zinc-500 dark:text-slate-400 font-medium truncate">
                Klaim kondisi / retur administratif
              </p>
            </div>

            {/* Card 4: Rata-rata per Personil */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-zinc-500 dark:text-slate-400 uppercase tracking-wider block">
                  RATA-RATA KASUS / PERSONIL
                </span>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                  {filteredPersonnel.length
                    ? (totalPersonnelErrors / filteredPersonnel.length).toFixed(1)
                    : 0}{" "}
                  Kasus
                </h3>
              </div>
              <p className="mt-2 pt-2 border-t border-zinc-100 dark:border-slate-800/80 text-[11px] text-zinc-400 dark:text-slate-500 font-medium truncate">
                Tingkat konsentrasi beban kesalahan
              </p>
            </div>
          </div>

          {/* Banner Transparansi Rekonsiliasi Data Kasus */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 text-indigo-950 dark:text-indigo-200">
              <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="leading-relaxed text-[11px]">
                <strong className="text-xs">Transparansi Data Kasus:</strong> Dari total <strong>{personnelCaseCounts.total_cases.toLocaleString("id-ID")} kasus komplain</strong> di database pada periode ini, <strong>{personnelCaseCounts.with_person_count} kasus ({personnelCaseCounts.total_cases > 0 ? ((personnelCaseCounts.with_person_count / personnelCaseCounts.total_cases) * 100).toFixed(0) : 0}%)</strong> telah teridentifikasi nama personilnya ({totalPersonnelErrors} catatan atribusi ke {filteredPersonnel.length} personil). Sisanya sebanyak <strong>{personnelCaseCounts.unassigned_count} kasus</strong> merupakan klaim kondisi barang/retur administrasi (nama personil opsional).
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPersonnelDrillDown({ isOpen: true, personName: "ALL", title: "Semua Bukti Kasus Komplain Riil" })}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Bukti Kasus Riil</span>
            </button>
          </div>

          {/* Top 3 Spotlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Rank 1 (Gold) */}
            {filteredPersonnel[0] && (() => {
              const p0 = filteredPersonnel[0];
              const c0 = personnelFilterPbf === "MAI" ? Number(p0.mai_cases || 0) : personnelFilterPbf === "MBI" ? Number(p0.mbi_cases || 0) : Number(p0.total_cases || 0);
              const pct0 = totalPersonnelErrors > 0 ? ((c0 / totalPersonnelErrors) * 100).toFixed(1) : "0";
              return (
              <div className="relative overflow-hidden rounded-2xl p-4 bg-amber-500/5 border-2 border-amber-400/70 dark:border-amber-400/50 shadow-sm flex flex-col justify-between">
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
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">
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
              <div className="relative overflow-hidden rounded-2xl p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-slate-300 dark:border-slate-600 shadow-sm flex flex-col justify-between">
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
              <div className="relative overflow-hidden rounded-2xl p-4 bg-amber-500/5 border border-amber-600/40 dark:border-amber-700/50 shadow-sm flex flex-col justify-between">
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
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
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
                            onClick={() =>
                              setPersonnelDrillDown({
                                isOpen: true,
                                personName: p.person,
                                title: `Bukti Kasus Riil: ${p.person}`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 mx-auto shadow-2xs"
                            title="Klik untuk membuka rincian kasus riil personil ini"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Lihat Kasus ({p.total_cases})</span>
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

      {/* ─── MODAL DRILL-DOWN: BUKTI KASUS PERSONIL (100% TRANSPARAN SESUAI DATA KASUS) ─── */}
      {personnelDrillDown?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-slate-800 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>{personnelDrillDown.title}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {personnelDrillDownRows.length} Kasus
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                    Data riil dari database shipment returns ({monthFilter === "ALL" ? "Semua Bulan" : `Bulan ${monthFilter}`} • {personnelFilterPbf === "ALL" ? "MBI & MAI" : personnelFilterPbf})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPersonnelDrillDown}
                  disabled={personnelDrillDownRows.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Ekspor Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPersonnelDrillDown(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Search inside modal */}
            <div className="p-3 border-b border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={personnelDrillDownSearch}
                onChange={(e) => setPersonnelDrillDownSearch(e.target.value)}
                placeholder="Cari nomor faktur, no SO, apotek, produk, kendala, atau status..."
                className="w-full bg-transparent text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
              />
              {personnelDrillDownSearch && (
                <button
                  type="button"
                  onClick={() => setPersonnelDrillDownSearch("")}
                  className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Table list */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-5">
              {personnelDrillDownRows.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 text-xs">
                  Tidak ada catatan kasus yang cocok dengan kriteria ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-100 dark:bg-slate-950 text-zinc-600 dark:text-slate-400 font-bold sticky top-0 z-10 border-b border-zinc-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">Faktur / SO</th>
                        <th className="py-2.5 px-3">Apotek / Pelanggan</th>
                        <th className="py-2.5 px-3">Produk &amp; Qty</th>
                        <th className="py-2.5 px-3">Kendala &amp; Penyebab</th>
                        <th className="py-2.5 px-3">Personil Terkait</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Bukti Media</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-slate-800 font-medium">
                      {personnelDrillDownRows.map((r, idx) => {
                        const isResolved = (r.status || "").toLowerCase().includes("resolved");
                        const isReject = (r.status || "").toLowerCase().includes("reject");
                        return (
                          <tr key={r.id || idx} className="hover:bg-zinc-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-zinc-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">#{r.invoice_no || "-"}</span>
                              <div className="text-[10px] text-zinc-500">SO: {r.so_no || "-"}</div>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-white max-w-[180px] truncate" title={r.customer_name}>
                              {r.customer_name || "-"}
                            </td>
                            <td className="py-2.5 px-3 max-w-[200px] truncate" title={r.product_name}>
                              <div className="text-zinc-800 dark:text-zinc-200 truncate">{r.product_name || "-"}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">Qty: <strong>{r.qty || 1}</strong></div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="text-zinc-800 dark:text-zinc-200">{r.reason || "-"}</div>
                              {r.root_cause && <div className="text-[10px] text-zinc-500 font-mono">Penyebab: {r.root_cause}</div>}
                            </td>
                            <td className="py-2.5 px-3 font-bold font-mono text-rose-600 dark:text-rose-400">
                              {r.person || <span className="text-zinc-400 font-normal italic">- (Tanpa Nama)</span>}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isResolved
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : isReject
                                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                }`}
                              >
                                {r.status || "In Progress"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {r.photo_url && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPhotoUrl(r.photo_url || null)}
                                    className="p-1 rounded-md text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-slate-800"
                                    title="Lihat Foto Bukti"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {r.video_url && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewVideoUrl(r.video_url || null)}
                                    className="p-1 rounded-md text-zinc-500 hover:text-purple-600 hover:bg-zinc-100 dark:hover:bg-slate-800"
                                    title="Putar Video Unboxing"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {!r.photo_url && !r.video_url && <span className="text-zinc-300 dark:text-zinc-600">-</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-zinc-200 dark:border-slate-800 flex justify-between items-center bg-zinc-50 dark:bg-slate-950 text-xs">
              <span className="text-zinc-500">
                Menampilkan <strong>{personnelDrillDownRows.length}</strong> kasus
              </span>
              <button
                type="button"
                onClick={() => setPersonnelDrillDown(null)}
                className="px-4 py-1.5 rounded-xl border border-zinc-200 dark:border-slate-700 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
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
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 border-b border-zinc-800 mb-2">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
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
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewVideoUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-3 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 border-b border-zinc-800 mb-2">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-400" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 border border-blue-400 dark:border-blue-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
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

            {/* Box Peringatan Cek Foto Packing */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700/80 space-y-2">
              <div className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="uppercase tracking-wide">⚠️ Peringatan: Sudah Cek Foto Packing PBF?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-950 dark:text-amber-100 font-medium">
                Pastikan Anda sudah membuka &amp; memeriksa <strong>Foto Packingan Gudang</strong> serta <strong>Foto Bukti Komplain Apotek</strong> sebelum melakukan ACC:
              </p>
              <ul className="text-[11px] space-y-1 pl-4 list-disc text-amber-900 dark:text-amber-200">
                <li>
                  Jika <strong>BUKAN kesalahan gudang</strong> ➔ Klik <em>Periksa Kembali</em>, lalu pilih <strong>Reject</strong> pada menu Tindakan.
                </li>
                <li>
                  Jika <strong>FIX kesalahan gudang</strong> ➔ Pilih jenis penanganan di bawah dan klik tombol <strong>Ya, Sudah Pasti (ACC)</strong>.
                </li>
              </ul>
              {(selectedReturn?.photo_url || selectedReturn?.video_url) && (
                <div className="pt-1.5 flex flex-wrap gap-2 border-t border-amber-200 dark:border-amber-900/60">
                  {selectedReturn?.photo_url && (
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoUrl(selectedReturn.photo_url || null)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-200/80 hover:bg-amber-300 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Buka Foto Bukti Komplain</span>
                    </button>
                  )}
                  {selectedReturn?.video_url && (
                    <button
                      type="button"
                      onClick={() => setPreviewVideoUrl(selectedReturn.video_url || null)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 text-purple-900 dark:text-purple-200 flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Putar Video Unboxing</span>
                    </button>
                  )}
                </div>
              )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 border border-rose-400 dark:border-rose-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white dark:bg-zinc-900 border border-amber-400/80 dark:border-amber-600/80 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
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
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black text-black bg-amber-400 hover:bg-amber-500 shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75">
          <div className="bg-white dark:bg-[#0c1222] border border-blue-500/60 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 bg-blue-950/25 border-b border-blue-500/25 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🚨</span>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Update Penting Tracker</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
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
                className="w-full py-2.5 px-4 rounded-xl font-black text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Siap, Mengerti &amp; Terapkan ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Excel Modal (Custom & Full System) */}
      <ReturnsExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        totalSystemAll={Number(stats.totalAll || total || 0)}
        currentFilteredTotal={total}
        availableWeeks={availableWeeks}
        initialSearch={search}
        initialStatus={statusFilter}
        initialPbf={pbfFilter}
        initialCategory={categoryFilter}
        initialMonth={monthFilter}
        initialWeek={weekFilter}
        getInvoiceDate={getInvoiceDate}
        formatDate={formatDate}
        calculateDaysUntilToday={calculateDaysUntilToday}
        calculateDaysUntilClose={calculateDaysUntilClose}
      />

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