"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";
import { broadcastRealtimeSignal, subscribeToRealtimeSignal } from "@/lib/firestoreService";
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
} from "lucide-react";
import * as XLSX from "xlsx";

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
}

export default function ReturnsView({ onSelectCustomer, onSelectInvoice, records }: ReturnsViewProps) {
  const [returns, setReturns] = useState<ShipmentReturnRecord[]>([]);

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
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalAll: 0, totalResolved: 0, totalPending: 0 });
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
  const [activeTab, setActiveTab] = useState<"list" | "leaderboard" | "analytics">("list");
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

  // Fetch all returns for analytic tabs
  const fetchAllReturns = useCallback(async () => {
    try {
      const res = await fetch("/api/tidb?action=returns&limit=1000");
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
      const personCol = getColIdx("personil", "person", "petugas", "pic", "nama personil");
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
          person: val(personCol) || "-",
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

  const fetchPersonnelStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/tidb?action=personnel_stats");
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
  }, []);

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
    reason: "Fisik yang dikirim salah",
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

  const fetchReturns = useCallback(async (silent = false) => {
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
  }, [debouncedSearch, statusFilter, pbfFilter, categoryFilter, page]);

  // Real-time Firestore cross-browser signal + polling when tab is visible
  useEffect(() => {
    fetchReturns();
    fetchAllReturns();
    const unsubRealtime = subscribeToRealtimeSignal("returns", () => {
      fetchReturns(true);
      fetchAllReturns();
      fetchPersonnelStats();
    });
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetchReturns(true);
    }, 30000);
    const onFocus = () => fetchReturns(true);
    window.addEventListener("focus", onFocus);
    return () => {
      unsubRealtime();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchReturns, fetchAllReturns, fetchPersonnelStats]);

  const handleDeleteReturn = async (id: number, invoiceNo: string) => {
    if (!confirm(`Hapus tiket komplain untuk faktur "${invoiceNo || id}"?\n\nData akan dihapus permanen dari sistem Fantastic Order.`)) {
      return;
    }
    setIsUpdating(true);
    try {
      // Delete di TiDB Cloud
      const res = await fetch(`/api/tidb?action=delete_return&id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({ success: false, error: "Gagal membaca respon server" }));

      if (data.success) {
        setReturns((prev) => prev.filter((r) => r.id !== id));
        if (selectedReturn?.id === id) {
          setSelectedReturn(null);
        }
        fetchReturns(true);
        broadcastRealtimeSignal("returns");
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
        broadcastRealtimeSignal("returns");
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
      const resolvedDate = isResolved
        ? editForm.resolved_date || new Date().toISOString().split("T")[0]
        : editForm.resolved_date;

      const payload = {
        id: selectedReturn.id,
        ...editForm,
        resolved_date: resolvedDate,
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
        fetchReturns();
        broadcastRealtimeSignal("returns");
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
          report_date: new Date().toISOString().split("T")[0],
          category: "",
          confirm: "",
          action: "",
          status: "Pending",
          person: "",
          root_cause: "",
          note: "",
        });
        fetchReturns();
        broadcastRealtimeSignal("returns");
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
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-amber-800 dark:text-amber-300 font-bold"
              />
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

          <button
            type="button"
            onClick={() => setSelectedReturn(null)}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-black dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-zinc-300 dark:border-slate-700 transition-all"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={isUpdating}
            className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
          >
            {isUpdating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </button>

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

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* View Switcher Tabs (Data Kasus, Weekly & QC2, Personil, Analisis) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800">
          {/* Tab 1: Data Kasus */}
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
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

          

          {/* Tab 3: Personil Leaderboard */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("leaderboard");
              fetchPersonnelStats();
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "leaderboard"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Users className="w-4 h-4 text-amber-500" />
            <span>Leaderboard Personil</span>
            {personnelStats?.personnel?.length ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono font-bold">
                {personnelStats.personnel.length}
              </span>
            ) : null}
          </button>

          {/* Tab 4: Analisis & Root Cause */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("analytics");
              fetchPersonnelStats();
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "analytics"
                ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span>Analisis & Root Cause</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchReturns();
              fetchAllReturns();
              fetchPersonnelStats();
            }}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 text-zinc-600 dark:text-slate-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading || loadingStats ? "animate-spin text-indigo-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tab 1: Daftar Retur */}
      {activeTab === "list" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Retur (Filter Klik) */}
        <div
          onClick={() => { setStatusFilter("ALL"); setPage(0); }}
          className={`relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border shadow-xs transition-all cursor-pointer select-none active:scale-95 group ${
            statusFilter === "ALL"
              ? "border-blue-500/80 shadow-md bg-blue-500/5 dark:bg-blue-500/10"
              : "border-zinc-200 dark:border-blue-500/20 hover:border-blue-500/40 opacity-90 hover:opacity-100"
          }`}
          title="Klik untuk tampilkan Semua Status"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-xl pointer-events-none -mr-8 -mt-8" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                <Package className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                <span>Total Komplain & Retur</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1 tracking-tight">
                {stats.totalAll.toLocaleString("id-ID")}
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-slate-400 mt-0.5">
                Semua Riwayat Kasus
              </p>
            </div>
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-transform ${
              statusFilter === "ALL"
                ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                : "bg-blue-50 dark:bg-blue-600/20 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400"
            }`}>
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 2: Selesai (Filter Klik Resolved) */}
        <div
          onClick={() => { setStatusFilter("Resolved"); setPage(0); }}
          className={`relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border shadow-xs transition-all cursor-pointer select-none active:scale-95 group ${
            statusFilter === "Resolved"
              ? "border-emerald-500/80 shadow-md bg-emerald-500/5 dark:bg-emerald-500/10"
              : "border-zinc-200 dark:border-emerald-500/20 hover:border-emerald-500/40 opacity-90 hover:opacity-100"
          }`}
          title="Klik untuk filter kasus Selesai (Resolved)"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-xl pointer-events-none -mr-8 -mt-8" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span>Terselesaikan (Resolved)</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
                {stats.totalResolved.toLocaleString("id-ID")}
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-slate-400 mt-0.5">
                {stats.totalAll > 0 ? ((stats.totalResolved / stats.totalAll) * 100).toFixed(1) : 0}% Tingkat Solusi
              </p>
            </div>
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-transform ${
              statusFilter === "Resolved"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                : "bg-emerald-50 dark:bg-emerald-600/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 3: Pending (Filter Klik Pending/Unresolved) */}
        <div
          onClick={() => { setStatusFilter("Pending"); setPage(0); }}
          className={`relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border shadow-xs transition-all cursor-pointer select-none active:scale-95 group ${
            statusFilter === "Pending" || statusFilter === "In Progress" || statusFilter === "Open case"
              ? "border-amber-500/80 shadow-md bg-amber-500/5 dark:bg-amber-500/10"
              : "border-zinc-200 dark:border-amber-500/20 hover:border-amber-500/40 opacity-90 hover:opacity-100"
          }`}
          title="Klik untuk filter kasus Menunggu Tindak Lanjut"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-xl pointer-events-none -mr-8 -mt-8" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                <span>Menunggu Tindak Lanjut</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tracking-tight">
                {stats.totalPending.toLocaleString("id-ID")}
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-slate-400 mt-0.5">
                Perlu tukar fisik / CN Retur
              </p>
            </div>
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-transform ${
              statusFilter === "Pending" || statusFilter === "In Progress" || statusFilter === "Open case"
                ? "bg-amber-600 text-white border-amber-500 shadow-sm"
                : "bg-amber-50 dark:bg-amber-600/20 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400"
            }`}>
              <Clock className="w-4 h-4" />
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
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">Impor, Ekspor & Input</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex-1 py-1.5 px-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input</span>
            </button>
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={isImporting}
              className="py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Impor Data Excel / CSV"
            >
              <Download className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 rotate-180 ${isImporting ? "animate-bounce" : ""}`} />
              <span>{isImporting ? "Impor..." : "Impor"}</span>
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
              className="py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 border border-zinc-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
              title="Unduh Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ekspor</span>
            </button>
          </div>
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
            onClick={() => fetchReturns()}
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
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 dark:bg-[#070b14] border-b-2 border-zinc-300 dark:border-zinc-800 text-[11px] font-black text-black dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3 w-16">PBF</th>
                <th className="py-2.5 px-4">Nama Apotek</th>
                <th className="py-2.5 px-3">No. Faktur</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Tgl Faktur</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Tgl Lapor</th>
                <th className="py-2.5 px-3">No. SO</th>
                <th className="py-2.5 px-4">Nama Produk & Qty</th>
                <th className="py-2.5 px-4">Alasan (Reason)</th>
                <th className="py-2.5 px-3 text-center">Tgl Selesai</th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap" title="Days until Today (Hari sejak lapor)">Days Today</th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap" title="Days until close (#N/A jika belum selesai)">Days Until Close</th>
                <th className="py-2.5 px-3">Tindakan</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 dark:divide-slate-800/50">
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
                        className={`group hover:bg-zinc-100 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                          isExpanded
                            ? "bg-indigo-50/70 dark:bg-slate-800/60 font-semibold border-l-4 border-l-indigo-600 dark:border-l-indigo-500"
                            : ""
                        }`}
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

                        {/* Status Tiket (Langsung di samping No Faktur) */}
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

                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap text-zinc-700 dark:text-slate-300">
                          {getInvoiceDate(r) ? (
                            <span className="inline-flex items-center gap-1 font-semibold" title="Tanggal Faktur (dari daftar faktur)">
                              <Calendar className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>{formatDate(getInvoiceDate(r))}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-slate-600">-</span>
                          )}
                        </td>

                        {/* Tgl Lapor / Report Date */}
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap text-zinc-700 dark:text-slate-300">
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

                        <td className="py-2.5 px-4 max-w-[190px]">
                          <span className="truncate block text-zinc-800 dark:text-slate-300 font-semibold" title={r.reason}>
                            {r.reason && r.reason !== "#N/A" ? r.reason : "-"}
                          </span>
                          {r.root_cause && r.root_cause !== "#N/A" && (
                            <span className="text-[10px] text-zinc-500 dark:text-slate-500 truncate block">
                              Penyebab: {r.root_cause}
                            </span>
                          )}
                          {r.person && r.person !== "#N/A" && (
                            <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold truncate block">
                              Pelaku: {r.person}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono text-[11px] whitespace-nowrap">
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

                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] whitespace-nowrap">
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

                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] whitespace-nowrap">
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

                        <td className="py-2.5 px-3 text-zinc-800 dark:text-slate-300 max-w-[130px] truncate font-medium">
                          {r.action && r.action !== "#N/A" ? r.action : "-"}
                        </td>

                        <td className="py-2.5 px-3 text-center">
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

      {/* ─── TAB 3: ANALISIS & ROOT CAUSE ─── */}
      {activeTab === "analytics" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* PBF MBI & MAI Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* MBI Card */}
            {(() => {
              const mbiData = personnelStats?.pbfComparison?.find((p) => p.pbf === "MBI") || {
                total: 0,
                resolved: 0,
                pending: 0,
              };
              const resRate =
                Number(mbiData.total) > 0
                  ? ((Number(mbiData.resolved) / Number(mbiData.total)) * 100).toFixed(1)
                  : 0;
              return (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      MBI (PT Medika Bina Investama)
                    </span>
                    <span className="text-xs font-bold text-zinc-500 dark:text-slate-400">
                      {resRate}% Diselesaikan
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-slate-950">
                      <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase block">
                        Total Kasus
                      </span>
                      <span className="text-xl font-black text-zinc-900 dark:text-white">
                        {Number(mbiData.total).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase block">
                        Selesai
                      </span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {Number(mbiData.resolved).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block">
                        Pending
                      </span>
                      <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                        {Number(mbiData.pending).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* MAI Card */}
            {(() => {
              const maiData = personnelStats?.pbfComparison?.find((p) => p.pbf === "MAI") || {
                total: 0,
                resolved: 0,
                pending: 0,
              };
              const resRate =
                Number(maiData.total) > 0
                  ? ((Number(maiData.resolved) / Number(maiData.total)) * 100).toFixed(1)
                  : 0;
              return (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/40 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      MAI (PT Medika Abadi Investama)
                    </span>
                    <span className="text-xs font-bold text-zinc-500 dark:text-slate-400">
                      {resRate}% Diselesaikan
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-slate-950">
                      <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase block">
                        Total Kasus
                      </span>
                      <span className="text-xl font-black text-zinc-900 dark:text-white">
                        {Number(maiData.total).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase block">
                        Selesai
                      </span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {Number(maiData.resolved).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block">
                        Pending
                      </span>
                      <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                        {Number(maiData.pending).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Root Causes and Return Reasons Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Root Causes Breakdown */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Penyebab Masalah (Root Cause)
                  </h3>
                </div>
                <span className="text-xs font-bold text-zinc-500 dark:text-slate-400 font-mono">
                  {totalRootCauses} Kasus
                </span>
              </div>

              <div className="space-y-3">
                {(!personnelStats?.rootCauses || personnelStats.rootCauses.length === 0) ? (
                  <p className="text-xs text-zinc-400 py-6 text-center">Belum ada data root cause.</p>
                ) : (
                  personnelStats.rootCauses.map((rc, idx) => {
                    const pct = totalRootCauses > 0 ? ((Number(rc.total) / totalRootCauses) * 100).toFixed(1) : "0";
                    return (
                      <div key={rc.root_cause} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-800 dark:text-slate-200 truncate max-w-[240px]">
                            {rc.root_cause}
                          </span>
                          <span className="font-mono text-zinc-500 dark:text-slate-400 font-bold">
                            {rc.total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              idx === 0
                                ? "bg-rose-500"
                                : idx === 1
                                ? "bg-amber-500"
                                : "bg-indigo-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reasons Breakdown */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Alasan Komplain Dilaporkan (Reasons)
                  </h3>
                </div>
                <span className="text-xs font-bold text-zinc-500 dark:text-slate-400 font-mono">
                  {totalReasons} Kasus
                </span>
              </div>

              <div className="space-y-3">
                {(!personnelStats?.reasons || personnelStats.reasons.length === 0) ? (
                  <p className="text-xs text-zinc-400 py-6 text-center">Belum ada data alasan.</p>
                ) : (
                  personnelStats.reasons.map((r, idx) => {
                    const pct = totalReasons > 0 ? ((Number(r.total) / totalReasons) * 100).toFixed(1) : "0";
                    return (
                      <div key={r.reason} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-800 dark:text-slate-200 truncate max-w-[240px]">
                            {r.reason}
                          </span>
                          <span className="font-mono text-zinc-500 dark:text-slate-400 font-bold">
                            {r.total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              idx === 0
                                ? "bg-amber-500"
                                : idx === 1
                                ? "bg-blue-500"
                                : "bg-teal-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
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