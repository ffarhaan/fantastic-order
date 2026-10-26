"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  AlertCircle,
  XCircle,
  Search,
  RefreshCw,
  Image as ImageIcon,
  X,
  Maximize2,
  Plus,
  Send,
  Building2,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { FakturRecord } from "@/lib/types";

export interface ReturnRequestItem {
  id: number;
  request_id: string;
  request_date: string;
  pbf: string;
  customer_name: string;
  invoice_no: string;
  product_name: string;
  qty: number;
  batch_no?: string;
  expiry_date?: string;
  reason: string;
  note?: string;
  requester_name: string;
  status: string;
  processed_date?: string;
  processed_by?: string;
  photos?: string;
  created_at?: string;
}

interface ReturSubmissionViewProps {
  records?: FakturRecord[];
  onRefreshParentReturns?: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: any }
> = {
  Pending: {
    label: "Pending",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
    icon: Clock,
  },
  Dikonfirmasi: {
    label: "Dikonfirmasi",
    badgeClass:
      "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800",
    icon: CheckCircle2,
  },
  "Dalam Perjalanan": {
    label: "Dalam Perjalanan",
    badgeClass:
      "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800",
    icon: Truck,
  },
  Terkirim: {
    label: "Terkirim",
    badgeClass:
      "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800",
    icon: PackageCheck,
  },
  Selesai: {
    label: "Selesai",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  Gagal: {
    label: "Gagal",
    badgeClass:
      "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
    icon: XCircle,
  },
};

export default function ReturSubmissionView({
  records = [],
  onRefreshParentReturns,
}: ReturSubmissionViewProps) {
  const [subTab, setSubTab] = useState<"list" | "form">("list");
  const [requests, setRequests] = useState<ReturnRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    dikonfirmasi: 0,
    dalam_perjalanan: 0,
    terkirim: 0,
    selesai: 0,
    gagal: 0,
  });

  // Form State
  const [formPbf, setFormPbf] = useState("MBI");
  const [formPengaju, setFormPengaju] = useState("");
  const [formApotek, setFormApotek] = useState("");
  const [formFaktur, setFormFaktur] = useState("");
  const [formProduk, setFormProduk] = useState("");
  const [formQty, setFormQty] = useState(1);
  const [formBatch, setFormBatch] = useState("");
  const [formED, setFormED] = useState("");
  const [formJenis, setFormJenis] = useState("");
  const [formKet, setFormKet] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState("");
  const [submitErrMsg, setSubmitErrMsg] = useState("");

  // Lightbox Modal
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<ReturnRequestItem | null>(null);

  // Suggestions for Apotek
  const apotekSuggestions = useMemo(() => {
    if (!formApotek || formApotek.length < 2) return [];
    const q = formApotek.toLowerCase();
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of records) {
      const anyR = r as any;
      const cName = r.customerName || anyR.customer_name;
      if (cName && cName.toLowerCase().includes(q)) {
        if (!seen.has(cName)) {
          seen.add(cName);
          list.push(cName);
          if (list.length >= 8) break;
        }
      }
    }
    return list;
  }, [formApotek, records]);

  // Auto-fill from invoice input
  const handleFakturChange = (val: string) => {
    setFormFaktur(val);
    const clean = val.trim();
    if (!clean) return;

    const matched = records.find((r) => {
      const anyR = r as any;
      const invNo = r.invoiceNumber || anyR.no_faktur;
      return (
        invNo &&
        (invNo.toLowerCase() === clean.toLowerCase() ||
          invNo.toLowerCase().endsWith(clean.toLowerCase()))
      );
    });

    if (matched) {
      const anyM = matched as any;
      const cName = matched.customerName || anyM.customer_name;
      if (cName && !formApotek) {
        setFormApotek(cName);
      }
      const pbfStr = (anyM.pbf || anyM.sourceFile || matched.invoiceNumber || "").toUpperCase();
      if (pbfStr) {
        setFormPbf(pbfStr.includes("MAI") ? "MAI" : "MBI");
      }
    }
  };

  // Fetch Requests from TiDB
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tidb?action=return_requests&limit=500");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRequests(json.data);
        if (json.summary) {
          setSummary(json.summary);
        }
      }
    } catch (e) {
      console.error("fetchRequests error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Image upload & canvas resize compression
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 3 - formPhotos.length;
    if (remaining <= 0) {
      alert("Maksimal 3 bukti foto.");
      return;
    }

    const toProcess = Array.from(files).slice(0, remaining);

    for (const file of toProcess) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1000;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            setFormPhotos((prev) => [...prev, dataUrl].slice(0, 3));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setFormPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit new Return Request
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErrMsg("");
    setSubmitSuccessMsg("");

    if (!formPengaju.trim()) {
      setSubmitErrMsg("Nama pengaju wajib diisi.");
      return;
    }
    if (!formApotek.trim()) {
      setSubmitErrMsg("Nama apotek/outlet wajib diisi.");
      return;
    }
    if (!formFaktur.trim()) {
      setSubmitErrMsg("Nomor faktur wajib diisi.");
      return;
    }
    if (!formProduk.trim()) {
      setSubmitErrMsg("Nama produk/barang wajib diisi.");
      return;
    }
    if (!formJenis.trim()) {
      setSubmitErrMsg("Pilih jenis masalah retur.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tidb?action=submit_return_request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pbf: formPbf,
          requester_name: formPengaju.trim(),
          customer_name: formApotek.trim(),
          invoice_no: formFaktur.trim(),
          product_name: formProduk.trim(),
          qty: formQty,
          batch_no: formBatch.trim(),
          expiry_date: formED.trim(),
          reason: formJenis,
          note: formKet.trim(),
          photos: formPhotos,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmitSuccessMsg(`✓ ${json.message}`);
        // Reset form
        setFormPengaju("");
        setFormApotek("");
        setFormFaktur("");
        setFormProduk("");
        setFormQty(1);
        setFormBatch("");
        setFormED("");
        setFormJenis("");
        setFormKet("");
        setFormPhotos([]);
        // Refresh list
        fetchRequests();
        setTimeout(() => setSubTab("list"), 1200);
      } else {
        setSubmitErrMsg(json.error || "Gagal mengirim pengajuan retur.");
      }
    } catch (err: any) {
      setSubmitErrMsg(err?.message || "Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  };

  // Update status (Approve, Reject, or Pipeline advance)
  const handleUpdateStatus = async (
    item: ReturnRequestItem,
    newStatus: string
  ) => {
    const isApprove = newStatus === "Dikonfirmasi";
    const isReject = newStatus === "Gagal";

    let confirmPrompt = `Ubah status tiket ${item.request_id} menjadi "${newStatus}"?`;
    if (isApprove) {
      confirmPrompt = `Setujui pengajuan ${item.request_id}?\n\nKasus ini otomatis dibuatkan data baru di tabel Shipment Error sebagai "In Progress".`;
    } else if (isReject) {
      confirmPrompt = `Tolak pengajuan retur ${item.request_id}? (Status akan menjadi Gagal)`;
    }

    if (!confirm(confirmPrompt)) return;

    try {
      const res = await fetch(
        "/api/tidb?action=update_return_request_status",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id: item.request_id,
            status: newStatus,
            processed_by: "Admin Logistik",
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        alert(
          isApprove
            ? `✓ Pengajuan ${item.request_id} berhasil disetujui!\nData otomatis tercatat di Shipment Error sebagai In Progress.`
            : `✓ Status berhasil diperbarui menjadi ${newStatus}.`
        );
        fetchRequests();
        if (onRefreshParentReturns) onRefreshParentReturns();
        if (selectedItem?.id === item.id) {
          setSelectedItem({
            ...selectedItem,
            status: newStatus,
            processed_date: new Date().toLocaleString("id-ID"),
            processed_by: "Admin Logistik",
          });
        }
      } else {
        alert(json.error || "Gagal memperbarui status.");
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + (err?.message || err));
    }
  };

  // Filtered list
  const filteredList = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "ALL") {
        if (r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (r.request_id && r.request_id.toLowerCase().includes(q)) ||
          (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
          (r.invoice_no && r.invoice_no.toLowerCase().includes(q)) ||
          (r.product_name && r.product_name.toLowerCase().includes(q)) ||
          (r.requester_name && r.requester_name.toLowerCase().includes(q)) ||
          (r.reason && r.reason.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  // Helper to extract photo URLs from json string or comma-separated
  const getPhotoUrls = (photosField?: string): string[] => {
    if (!photosField) return [];
    try {
      if (photosField.startsWith("[")) {
        const parsed = JSON.parse(photosField);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      }
    } catch {}
    return photosField.split(",").map((s) => s.trim()).filter(Boolean);
  };

  return (
    <div className="space-y-4">
      {/* Sub-nav Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("list")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === "list"
                ? "bg-white text-black dark:bg-zinc-800 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700"
                : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4 text-blue-500" />
            <span>Daftar Pengajuan Retur</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
              {summary.total}
            </span>
            {summary.pending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-amber-500 text-white animate-pulse">
                {summary.pending} Pending
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab("form")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === "form"
                ? "bg-white text-black dark:bg-zinc-800 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700"
                : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Plus className="w-4 h-4 text-emerald-500" />
            <span>+ Form Pengajuan Baru</span>
          </button>
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-500" : ""}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. SUB-TAB: DAFTAR RETUR                                   */}
      {/* ========================================================= */}
      {subTab === "list" && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total Pengajuan</span>
              <span className="text-xl font-black text-zinc-900 dark:text-white mt-0.5 block">{summary.total}</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Pending Review</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{summary.pending}</span>
            </div>
            <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Dikonfirmasi</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">{summary.dikonfirmasi}</span>
            </div>
            <div className="p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 shadow-2xs">
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">Dalam Perjalanan</span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5 block">{summary.dalam_perjalanan}</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Selesai</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{summary.selesai}</span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 shadow-2xs">
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Ditolak / Gagal</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{summary.gagal}</span>
            </div>
          </div>

          {/* Status Filter Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: "ALL", label: "Semua", count: summary.total },
                { id: "Pending", label: "Pending", count: summary.pending, color: "text-amber-500" },
                { id: "Dikonfirmasi", label: "Dikonfirmasi", count: summary.dikonfirmasi, color: "text-blue-500" },
                { id: "Dalam Perjalanan", label: "Perjalanan", count: summary.dalam_perjalanan, color: "text-purple-500" },
                { id: "Terkirim", label: "Terkirim", count: summary.terkirim, color: "text-teal-500" },
                { id: "Selesai", label: "Selesai", count: summary.selesai, color: "text-emerald-500" },
                { id: "Gagal", label: "Gagal", count: summary.gagal, color: "text-rose-500" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStatusFilter(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === t.id
                      ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white"
                  }`}
                >
                  <span>{t.label}</span>
                  <span className={`text-[10px] font-mono font-bold ${statusFilter === t.id ? "" : t.color || ""}`}>
                    ({t.count})
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari ID, Faktur, Apotek, Produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 backdrop-blur-sm text-zinc-700 dark:text-zinc-300 font-bold">
                    <th className="py-3 px-3">ID Retur</th>
                    <th className="py-3 px-3">Tgl Pengajuan</th>
                    <th className="py-3 px-3">PBF</th>
                    <th className="py-3 px-3">Apotek / Outlet</th>
                    <th className="py-3 px-3">No. Faktur</th>
                    <th className="py-3 px-3">Nama Produk</th>
                    <th className="py-3 px-3">Jenis Masalah</th>
                    <th className="py-3 px-3">Bukti Foto</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                  {loading && requests.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-zinc-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        <span>Memuat data pengajuan retur...</span>
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-zinc-500">
                        Belum ada tiket pengajuan retur yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item) => {
                      const cfg = STATUS_CONFIG[item.status] || {
                        label: item.status,
                        badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-300",
                        icon: Clock,
                      };
                      const StatusIcon = cfg.icon;
                      const photos = getPhotoUrls(item.photos);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedItem(item)}
                              className="hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{item.request_id}</span>
                            </button>
                          </td>
                          <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {item.request_date || "-"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                item.pbf === "MAI"
                                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              }`}
                            >
                              {item.pbf || "MBI"}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-zinc-900 dark:text-zinc-100 max-w-[180px] truncate">
                            {item.customer_name || "-"}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                            {item.invoice_no || "-"}
                          </td>
                          <td className="py-3 px-3 max-w-[200px] truncate text-zinc-700 dark:text-zinc-300">
                            <span>{item.product_name || "-"}</span>
                            {item.qty > 1 && (
                              <span className="ml-1 text-[10px] font-mono text-zinc-500 font-bold">
                                (x{item.qty})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-[180px] truncate text-zinc-600 dark:text-zinc-400">
                            {item.reason || "-"}
                          </td>
                          <td className="py-3 px-3">
                            {photos.length > 0 ? (
                              <div className="flex items-center gap-1">
                                {photos.slice(0, 2).map((imgUrl, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setLightboxImg(imgUrl)}
                                    className="w-7 h-7 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:scale-110 transition-transform cursor-pointer"
                                    title="Klik untuk perbesar"
                                  >
                                    <img
                                      src={imgUrl}
                                      alt="Bukti"
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                                {photos.length > 2 && (
                                  <span className="text-[10px] font-bold text-zinc-500">
                                    +{photos.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.badgeClass}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span>{cfg.label}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.status === "Pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(item, "Dikonfirmasi")}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                                    title="Setujui dan masukkan ke Shipment Error"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(item, "Gagal")}
                                    className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                                    title="Tolak pengajuan retur"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Tolak</span>
                                  </button>
                                </>
                              )}

                              {item.status === "Dikonfirmasi" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(item, "Dalam Perjalanan")}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                                >
                                  <Truck className="w-3 h-3" />
                                  <span>Kirim Balik</span>
                                </button>
                              )}

                              {item.status === "Dalam Perjalanan" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(item, "Terkirim")}
                                  className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                                >
                                  <PackageCheck className="w-3 h-3" />
                                  <span>Terkirim</span>
                                </button>
                              )}

                              {item.status === "Terkirim" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(item, "Selesai")}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Selesai</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedItem(item)}
                                className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold cursor-pointer"
                              >
                                Detail
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
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SUB-TAB: FORM PENGAJUAN RETUR BARU                     */}
      {/* ========================================================= */}
      {subTab === "form" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span>Form Pengajuan Retur Barang 2026</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Apotek → Distribusi
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Lengkapi formulir di bawah ini. Pengajuan yang di-approve otomatis diteruskan ke tim gudang dan dicatat dalam Shipment Error.
              </p>
            </div>

            {submitSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{submitSuccessMsg}</span>
              </div>
            )}

            {submitErrMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{submitErrMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PBF */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    PBF Distributor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formPbf}
                    onChange={(e) => setFormPbf(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="MBI">MBI (PT Medika Bina Investama)</option>
                    <option value="MAI">MAI (PT Medika Akses Investama)</option>
                  </select>
                </div>

                {/* Nama Pengaju */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nama Pengaju / Pelapor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi (Apoteker) / Admin"
                    value={formPengaju}
                    onChange={(e) => setFormPengaju(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* No Faktur */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    No. Faktur Penjualan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 001/MBI/26 atau 2610"
                    value={formFaktur}
                    onChange={(e) => handleFakturChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    Ketik no faktur untuk auto-fill nama apotek & PBF
                  </span>
                </div>

                {/* Nama Apotek */}
                <div className="relative">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nama Apotek / Outlet <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Apotek Kimia Farma / Bungur"
                    value={formApotek}
                    onChange={(e) => setFormApotek(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {apotekSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                      {apotekSuggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setFormApotek(sug)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nama Barang / Produk */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nama Barang / Produk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Paracetamol 500mg Strip / Bisolvon"
                    value={formProduk}
                    onChange={(e) => setFormProduk(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Qty */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Jumlah / Qty Retur
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formQty}
                    onChange={(e) => setFormQty(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* No Batch */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    No. Batch
                  </label>
                  <input
                    type="text"
                    placeholder="Opsional (contoh: 24A10B)"
                    value={formBatch}
                    onChange={(e) => setFormBatch(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Expired Date */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Expired Date (ED)
                  </label>
                  <input
                    type="text"
                    placeholder="Opsional (contoh: 12/2027)"
                    value={formED}
                    onChange={(e) => setFormED(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Jenis Masalah */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Jenis Masalah Retur <span className="text-red-500">*</span>
                </label>
                <select
                  value={formJenis}
                  onChange={(e) => setFormJenis(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— Pilih Jenis Masalah / Alasan Komplain —</option>
                  <option value="Fisik yang dikirim kurang">📦 Fisik yang dikirim kurang</option>
                  <option value="Fisik yang dikirim salah">🔄 Fisik yang dikirim salah</option>
                  <option value="Fisik yang dikirim tidak ada">❌ Fisik yang dikirim tidak ada</option>
                  <option value="Fisik yang dikirim lebih">➕ Fisik yang dikirim lebih</option>
                  <option value="Damage On Delivery">💥 Damage On Delivery</option>
                  <option value="Batch number dan expiry date tidak sesuai">🏷️ Batch number dan expiry date tidak sesuai</option>
                  <option value="ED kurang dari 1 tahun">⏳ ED kurang dari 1 tahun</option>
                  <option value="Isi dalam kemasan box/strip tidak utuh">🧩 Isi dalam kemasan box/strip tidak utuh</option>
                  <option value="Produk rusak (berubah warna/berbau/kapsul bocor)">⚠️ Produk rusak (berubah warna/berbau/kapsul bocor)</option>
                  <option value="Produk terkontaminasi">☣️ Produk terkontaminasi</option>
                  <option value="Kemasan seal rusak">🔓 Kemasan seal rusak</option>
                  <option value="Lainnya">📋 Alasan Lainnya</option>
                </select>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Keterangan / Kronologi Tambahan
                </label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan kronologi kejadian, catatan nomor segel, atau detail penting lainnya..."
                  value={formKet}
                  onChange={(e) => setFormKet(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Upload Foto (Maks 3) */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Bukti Foto <span className="font-normal text-zinc-400">(Maksimal 3 foto, JPG/PNG)</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {formPhotos.map((imgUrl, i) => (
                    <div
                      key={i}
                      className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 group"
                    >
                      <img src={imgUrl} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-sm hover:bg-rose-700 transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {formPhotos.length < 3 && (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 hover:text-blue-500">
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px] font-bold">+ Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? "Mengirim..." : "Kirim Pengajuan Retur"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormPengaju("");
                    setFormApotek("");
                    setFormFaktur("");
                    setFormProduk("");
                    setFormQty(1);
                    setFormBatch("");
                    setFormED("");
                    setFormJenis("");
                    setFormKet("");
                    setFormPhotos([]);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Reset Form
                </button>
              </div>
            </form>
          </div>

          {/* Right Info Box */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-500" />
                <span>Alur Proses Retur</span>
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </span>
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">Pending Review</span>
                    <span className="text-[11px] text-zinc-500">Tiket diajukan oleh outlet/apotek dan menunggu peninjauan admin logistik.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </span>
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">Dikonfirmasi / Approve</span>
                    <span className="text-[11px] text-zinc-500">Admin menyetujui, dan kasus otomatis masuk ke Shipment Error sebagai "In Progress".</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    3
                  </span>
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">Dalam Perjalanan</span>
                    <span className="text-[11px] text-zinc-500">Barang fisik sedang dijemput ekspedisi atau kurir logistik.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    4
                  </span>
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">Selesai</span>
                    <span className="text-[11px] text-zinc-500">Barang fisik diterima di gudang, diperiksa QC, dan diterbitkan Nota Retur.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. LIGHTBOX FOTO VIEWER MODAL                             */}
      {/* ========================================================= */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <button
            type="button"
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xl cursor-pointer"
          >
            ✕
          </button>
          <img
            src={lightboxImg}
            alt="Bukti Retur"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. DETAIL TIKET MODAL                                      */}
      {/* ========================================================= */}
      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">DETAIL PENGAJUAN RETUR</span>
                <h3 className="text-base font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                  {selectedItem.request_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-zinc-400 font-bold block">PBF</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{selectedItem.pbf}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-bold block">Status</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{selectedItem.status}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-bold block">No. Faktur</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">{selectedItem.invoice_no || "-"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-bold block">Tgl Pengajuan</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{selectedItem.request_date || "-"}</span>
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-bold block">Apotek / Outlet</span>
                <span className="font-bold text-zinc-900 dark:text-white text-sm">{selectedItem.customer_name}</span>
              </div>

              <div>
                <span className="text-zinc-400 font-bold block">Nama Barang & Qty</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {selectedItem.product_name} (x{selectedItem.qty})
                </span>
              </div>

              <div>
                <span className="text-zinc-400 font-bold block">Jenis Masalah</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{selectedItem.reason}</span>
              </div>

              {selectedItem.note && (
                <div>
                  <span className="text-zinc-400 font-bold block">Keterangan / Kronologi</span>
                  <p className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {selectedItem.note}
                  </p>
                </div>
              )}

              {/* Photos */}
              {getPhotoUrls(selectedItem.photos).length > 0 && (
                <div>
                  <span className="text-zinc-400 font-bold block mb-1.5">Bukti Foto</span>
                  <div className="flex items-center gap-2">
                    {getPhotoUrls(selectedItem.photos).map((imgUrl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightboxImg(imgUrl)}
                        className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:scale-105 transition-transform"
                      >
                        <img src={imgUrl} alt="Foto" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons in Modal */}
              {selectedItem.status === "Pending" && (
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedItem, "Gagal")}
                    className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold cursor-pointer"
                  >
                    Tolak Pengajuan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedItem, "Dikonfirmasi")}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
                  >
                    ✓ Setujui (Approve)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
