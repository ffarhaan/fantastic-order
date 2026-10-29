"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CustomerRecord, ShipmentReturnRecord } from "@/lib/types";
import { broadcastRealtimeSignal, subscribeToRealtimeSignal, isSuperAdminUser } from "@/lib/firestoreService";
import { AppUser } from "@/components/LoginModal";
import { recordActivityLog } from "@/lib/activityLogger";
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
  Image as ImageIcon,
} from "lucide-react";
import * as XLSX from "xlsx";

interface CustomerDocument {
  file_id: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  folder_id?: string | null;
  folder_name?: string | null;
  modified_at?: string | null;
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  currentUser?: AppUser | null;
}

export default function CustomersView({ onSelectCustomerForFilter, currentUser }: CustomersViewProps) {
  const isSuper = isSuperAdminUser(currentUser?.name) || isSuperAdminUser(currentUser?.email);
  const canEditCustomers = isSuper || Boolean(currentUser?.permissions?.can_edit_customers);
  const canDeleteCustomers = isSuper || Boolean(currentUser?.permissions?.can_delete_data);

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [hasDocsFilter, setHasDocsFilter] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Customer Detail / Docs Gallery state
  const [selectedCust, setSelectedCust] = useState<CustomerRecord | null>(null);
  const [docsGalleryCust, setDocsGalleryCust] = useState<CustomerRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customerReturns, setCustomerReturns] = useState<ShipmentReturnRecord[]>([]);
  const [customerFakturs, setCustomerFakturs] = useState<any[]>([]);
  const [customerDocs, setCustomerDocs] = useState<CustomerDocument[]>([]);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);

  // Customer Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CustomerRecord> | null>(null);
  const [isSavingCust, setIsSavingCust] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadCustomerDocs = async (custId: string, custName: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tidb?action=customer_detail&id=${encodeURIComponent(custId)}&name=${encodeURIComponent(custName)}`);
      const data = await res.json();
      if (data.success) {
        setCustomerReturns(data.returns || []);
        setCustomerFakturs(data.fakturs || []);
        setCustomerDocs(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to load customer detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const uploadSingleDocToTiDB = async (customerId: string, fileName: string, mimeType: string, sizeBytes: number, base64Data: string, folderName?: string) => {
    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const safeSlug = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48);
    const fileId = `local_${customerId}_${safeSlug}_${sizeBytes}`;
    const CHUNK_LEN = 700 * 1024;
    const totalChunks = Math.max(1, Math.ceil(cleanBase64.length / CHUNK_LEN));

    for (let idx = 0; idx < totalChunks; idx++) {
      const chunkData = cleanBase64.slice(idx * CHUNK_LEN, (idx + 1) * CHUNK_LEN);
      const res = await fetch("/api/tidb?action=upload_customer_document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: fileId,
          customer_id: customerId,
          file_name: fileName,
          mime_type: mimeType || "application/pdf",
          size_bytes: sizeBytes,
          folder_name: folderName || customerId,
          chunk_index: idx,
          total_chunks: totalChunks,
          chunk_data: chunkData,
        }),
      });
      if (!res.ok) throw new Error(`Gagal upload bagian ${idx + 1}/${totalChunks}`);
    }
    return fileId;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "npwp_file_url" | "document_url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Ukuran berkas maksimal 20MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (editForm?.id) {
        try {
          setZipProgress(`Mengunggah ${file.name}...`);
          const fileId = await uploadSingleDocToTiDB(editForm.id, file.name, file.type || "application/pdf", file.size, dataUrl, editForm.name || editForm.id);
          const viewUrl = `/api/tidb?action=view_document&file_id=${encodeURIComponent(fileId)}`;
          setEditForm((prev) => ({
            ...prev,
            [field]: viewUrl,
            ...(field === "document_url" ? { document_name: file.name } : {}),
          }));
          await loadCustomerDocs(editForm.id, editForm.name || "");
          setToastMsg(`✓ Berkas "${file.name}" berhasil disimpan!`);
          setTimeout(() => setToastMsg(null), 3500);
        } catch (err: any) {
          alert(`Gagal upload berkas: ${err.message || String(err)}`);
        } finally {
          setZipProgress(null);
        }
      } else {
        setEditForm((prev) => ({
          ...prev,
          [field]: dataUrl,
          ...(field === "document_url" ? { document_name: file.name } : {}),
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImportZipDocs = async (e: React.ChangeEvent<HTMLInputElement>, fallbackCustomerId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipProgress("Membaca file ZIP...");
    try {
      const JSZip = (await import("jszip")).default;
      const entriesToUpload: Array<{ customerId: string; folderName: string; fileName: string; mimeType: string; sizeBytes: number; base64: string }> = [];

      const guessMime = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
      };

      const unpackZip = async (buf: ArrayBuffer | Uint8Array, inheritedId?: string, inheritedFolder?: string) => {
        const zip = await JSZip.loadAsync(buf);
        for (const entry of Object.values(zip.files)) {
          if (entry.dir) continue;
          const parts = entry.name.split("/").filter(Boolean);
          const baseName = parts[parts.length - 1];
          if (!baseName || baseName.startsWith("._") || baseName === ".DS_Store") continue;

          const match = entry.name.match(/C\.\d+/i);
          const custId = match ? match[0].toUpperCase() : inheritedId || fallbackCustomerId;
          if (!custId) continue;
          const folderName = parts.find((p) => /C\.\d+/i.test(p)) || inheritedFolder || custId;

          if (baseName.toLowerCase().endsWith(".zip")) {
            const nestedBuf = await entry.async("uint8array");
            await unpackZip(nestedBuf, custId, folderName);
            continue;
          }

          const uint8 = await entry.async("uint8array");
          const base64 = await entry.async("base64");
          entriesToUpload.push({
            customerId: custId,
            folderName,
            fileName: baseName,
            mimeType: guessMime(baseName),
            sizeBytes: uint8.byteLength,
            base64,
          });
        }
      };

      const arrayBuf = await file.arrayBuffer();
      await unpackZip(arrayBuf, fallbackCustomerId);

      if (entriesToUpload.length === 0) {
        alert("Tidak ditemukan berkas dengan format folder (C.xxxx) di dalam ZIP ini.");
        return;
      }

      for (let i = 0; i < entriesToUpload.length; i++) {
        const it = entriesToUpload[i];
        setZipProgress(`Mengupload ${i + 1} / ${entriesToUpload.length}: (${it.customerId}) ${it.fileName}`);
        await uploadSingleDocToTiDB(it.customerId, it.fileName, it.mimeType, it.sizeBytes, it.base64, it.folderName);
      }

      setToastMsg(`✓ Berhasil mengupload ${entriesToUpload.length} dokumen dari file ZIP!`);
      setTimeout(() => setToastMsg(null), 5000);
      fetchCustomers();
      broadcastRealtimeSignal("customers");
      if (editForm?.id) {
        await loadCustomerDocs(editForm.id, editForm.name || "");
      } else if (selectedCust?.id) {
        await loadCustomerDocs(selectedCust.id, selectedCust.name || "");
      }
    } catch (err: any) {
      console.error("ZIP upload error:", err);
      alert(`Gagal memproses ZIP: ${err.message || String(err)}`);
    } finally {
      setZipProgress(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteCustomerDoc = async (doc: CustomerDocument) => {
    if (!confirm(`Hapus dokumen "${doc.file_name}"?`)) return;
    try {
      const res = await fetch("/api/tidb?action=delete_customer_document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: doc.file_id }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomerDocs((prev) => prev.filter((d) => d.file_id !== doc.file_id));
        fetchCustomers();
        broadcastRealtimeSignal("customers");
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleOpenEdit = (cust: CustomerRecord) => {
    setSelectedCust(null);
    setDocsGalleryCust(null);
    setEditForm({
      ...cust,
      sia_expired: parseToDateInputValue(cust.sia_expired),
      sipa_expired: parseToDateInputValue(cust.sipa_expired),
    });
    setCustomerDocs([]);
    setShowEditModal(true);
    loadCustomerDocs(cust.id, cust.name);
  };

  const handleOpenDocsGallery = (cust: CustomerRecord) => {
    setSelectedCust(null);
    setShowEditModal(false);
    setDocsGalleryCust(cust);
    setCustomerDocs([]);
    loadCustomerDocs(cust.id, cust.name);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCustomers) {
      alert("Akses Ditolak: Akun Anda tidak memiliki hak akses mengubah Master Pelanggan.");
      return;
    }
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
        broadcastRealtimeSignal("customers");
        await recordActivityLog({
          action_type: "UPDATE_CUSTOMER",
          module: "CUSTOMERS",
          target_id: String(editForm.id || editForm.name),
          details: `Mengubah data pelanggan: ${editForm.name}`,
          metadata: { id: editForm.id, name: editForm.name },
        });
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

  const fetchCustomers = useCallback(async (forceFresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "customers",
        limit: String(limit),
        offset: String(page * limit),
      });
      if (forceFresh) params.set("fresh", "true");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (hasDocsFilter) params.set("has_docs", "true");

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
  }, [debouncedSearch, categoryFilter, statusFilter, hasDocsFilter, page]);

  const selectedCustRef = useRef<CustomerRecord | null>(null);
  useEffect(() => {
    selectedCustRef.current = selectedCust;
  }, [selectedCust]);

  useEffect(() => {
    fetchCustomers();
    const unsubRealtime = subscribeToRealtimeSignal("customers", () => {
      fetchCustomers(true);
      if (selectedCustRef.current) {
        handleOpenDetail(selectedCustRef.current);
      }
    });
    return () => unsubRealtime();
  }, [fetchCustomers]);

  // Fetch full details + returns + fakturs when customer clicked
  const handleOpenDetail = async (cust: CustomerRecord) => {
    setSelectedCust(cust);
    setCustomerDocs([]);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tidb?action=customer_detail&id=${encodeURIComponent(cust.id)}&name=${encodeURIComponent(cust.name)}`);
      const data = await res.json();
      if (data.success) {
        setCustomerReturns(data.returns || []);
        setCustomerFakturs(data.fakturs || []);
        setCustomerDocs(data.documents || []);
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
      {/* ─── Compact KPI Header ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: Total Merchant */}
        <div className="relative overflow-hidden rounded-xl p-3 sm:p-3.5 bg-white dark:bg-gradient-to-br dark:from-[#0d1322] dark:to-[#070b14] border border-zinc-200 dark:border-indigo-500/20 shadow-xs hover:border-indigo-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-xl pointer-events-none -mr-8 -mt-8" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                <Store className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Direktori Mitra Customer</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1 tracking-tight">
                {total.toLocaleString("id-ID")}
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Apotek, Klinik, RS & PBF Terdaftar
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs group-hover:scale-105 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 2: Import & Ekspor Tools */}
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
          
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <label className="flex-1 py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap" title="Upload File ZIP Dokumen Pelanggan (Otomatis Cocokkan Kode C.xxxx)">
              <Package className="w-3.5 h-3.5" />
              <span>{zipProgress ? "Proses ZIP..." : "Upload ZIP Dokumen"}</span>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => handleImportZipDocs(e)}
                disabled={!!zipProgress}
                className="hidden"
              />
            </label>
            <label className="py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap" title="Upload Excel Master Customer">
              <Upload className="w-3.5 h-3.5" />
              <span>{isImporting ? "..." : "Excel"}</span>
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
              className="py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border border-zinc-200 dark:border-zinc-700 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
              title="Unduh Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Unduh</span>
            </button>
          </div>
          {zipProgress && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1.5 truncate animate-pulse">
              {zipProgress}
            </p>
          )}
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

          {/* Filter Sudah Ada Dokumen */}
          <button
            type="button"
            onClick={() => {
              setHasDocsFilter((v) => !v);
              setPage(0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              hasDocsFilter
                ? "bg-amber-600 text-white border-amber-500 shadow-xs"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100"
            }`}
            title="Tampilkan apotek yang sudah memiliki dokumen terupload"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{hasDocsFilter ? "✓ Sudah Ada Dokumen" : "Filter Ada Dokumen"}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchCustomers(true)}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/80 transition-all active:scale-95 shadow-xs cursor-pointer"
            title="Refresh Data dari TiDB"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-500" : ""}`} />
          </button>
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
                  const isSelected = docsGalleryCust?.id === c.id || (showEditModal && editForm?.id === c.id);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenEdit(c)}
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
                        <div className="flex items-center gap-1.5">
                          <span
                            className="truncate block text-zinc-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-indigo-200 transition-colors"
                            title={c.name}
                          >
                            {c.name || "-"}
                          </span>
                          {Number(c.doc_count) > 0 && (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-[10px] font-bold"
                              title={`${c.doc_count} dokumen tersimpan di aplikasi`}
                            >
                              <FileText className="w-2.5 h-2.5" />
                              {c.doc_count}
                            </span>
                          )}
                        </div>
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

                      {/* Action Buttons: Edit + Dokumen (di sebelah kanan Edit) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(c);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-slate-700 text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                            title="Edit Data Customer (Buka Panel Kanan)"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDocsGallery(c);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer ${
                              Number(c.doc_count) > 0
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"
                                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-200 border-zinc-200 dark:border-slate-700"
                            }`}
                            title="Lihat Foto & Dokumen Customer"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>Dokumen{Number(c.doc_count) > 0 ? ` (${c.doc_count})` : ""}</span>
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

      {/* ─── GALERI FOTO & DOKUMEN LANGSUNG (DIBUKA DARI TOMBOL SEBELAH KANAN EDIT) ─── */}
      {docsGalleryCust && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          onClick={() => setDocsGalleryCust(null)}
        >
          <div
            className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden text-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white truncate">
                  🖼️ Foto &amp; Dokumen: {docsGalleryCust.name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                  ID: {docsGalleryCust.id} • Oracle: {docsGalleryCust.customer_id_oracle || "-"} • Total: {customerDocs.length} Berkas
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{zipProgress ? "Mengupload..." : "Tambah Foto / PDF"}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf,.zip"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.name.toLowerCase().endsWith(".zip")) {
                        handleImportZipDocs(e, docsGalleryCust.id);
                      } else {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const dataUrl = ev.target?.result as string;
                          try {
                            setZipProgress(`Mengunggah ${f.name}...`);
                            await uploadSingleDocToTiDB(docsGalleryCust.id, f.name, f.type || "application/pdf", f.size, dataUrl, docsGalleryCust.name);
                            await loadCustomerDocs(docsGalleryCust.id, docsGalleryCust.name);
                            fetchCustomers();
                          } finally {
                            setZipProgress(null);
                          }
                        };
                        reader.readAsDataURL(f);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(docsGalleryCust)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDocsGalleryCust(null)}
                  className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {zipProgress && (
              <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold animate-pulse">
                {zipProgress}
              </div>
            )}

            {/* Gallery Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-zinc-100/60 dark:bg-zinc-950">
              {detailLoading ? (
                <div className="py-16 text-center text-zinc-500">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
                  <p className="text-sm font-semibold">Memuat foto &amp; dokumen...</p>
                </div>
              ) : customerDocs.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 max-w-md mx-auto">
                  <ImageIcon className="w-12 h-12 mx-auto text-zinc-400 mb-3 opacity-60" />
                  <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                    Belum ada foto / dokumen untuk {docsGalleryCust.name} ({docsGalleryCust.id})
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Klik tombol <strong>Tambah Foto / PDF</strong> di kanan atas untuk mengunggah foto, PDF, atau file .ZIP dokumen apotek.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customerDocs.map((doc) => {
                    const isLocalDoc = doc.file_id.startsWith("local_") || doc.folder_id === "local_zip";
                    const docStreamUrl = isLocalDoc
                      ? `/api/tidb?action=view_document&file_id=${encodeURIComponent(doc.file_id)}`
                      : `https://drive.google.com/file/d/${doc.file_id}/preview`;
                    const isImage = (doc.mime_type || "").startsWith("image/");

                    return (
                      <div
                        key={doc.file_id}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col"
                      >
                        <div className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-950/60">
                          <div className="flex items-center gap-2 min-w-0">
                            {isImage ? (
                              <ImageIcon className="w-4 h-4 text-sky-600 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-zinc-900 dark:text-white truncate" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            {doc.size_bytes ? (
                              <span className="text-[10px] text-zinc-500 shrink-0">({formatFileSize(doc.size_bytes)})</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Layar Penuh
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomerDoc(doc)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Visual Photo or PDF Preview directly rendered */}
                        <div
                          className="h-72 w-full bg-zinc-900/5 dark:bg-black/40 flex items-center justify-center overflow-hidden cursor-pointer"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          {isImage ? (
                            <img
                              src={docStreamUrl}
                              alt={doc.file_name}
                              className="w-full h-full object-contain hover:scale-[1.02] transition-transform"
                            />
                          ) : (
                            <iframe
                              src={docStreamUrl}
                              title={doc.file_name}
                              className="w-full h-full border-0"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

                {/* Section 5: Foto & Dokumen Legalitas (NPWP / SIA / SIPA) */}
                <div className="space-y-3 bg-zinc-50/80 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                      5. Foto &amp; Dokumen Legalitas ({customerDocs.length} Berkas)
                    </span>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer transition">
                      <Package className="w-3.5 h-3.5" />
                      <span>{zipProgress ? "Memproses ZIP..." : "Upload File .ZIP Dokumen"}</span>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={(e) => handleImportZipDocs(e, editForm.id)}
                        disabled={!!zipProgress}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {zipProgress && (
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold animate-pulse">
                      {zipProgress}
                    </div>
                  )}

                  {/* GALERI FOTO & DOKUMEN TERSIMPAN APOTEK INI (VISUAL LANGSUNG, TANPA LINK GDRIVE) */}
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-amber-200 dark:border-amber-500/30">
                    {detailLoading ? (
                      <p className="text-xs text-zinc-500">Memuat foto &amp; berkas...</p>
                    ) : customerDocs.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">
                        Belum ada foto/dokumen terupload untuk apotek ini ({editForm.id}). Silakan upload foto/PDF di bawah atau klik <strong>Upload File .ZIP Dokumen</strong>.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {customerDocs.map((doc) => {
                          const isLocalDoc = doc.file_id.startsWith("local_") || doc.folder_id === "local_zip";
                          const docStreamUrl = isLocalDoc
                            ? `/api/tidb?action=view_document&file_id=${encodeURIComponent(doc.file_id)}`
                            : `https://drive.google.com/file/d/${doc.file_id}/preview`;
                          const isImage = (doc.mime_type || "").startsWith("image/");
                          return (
                            <div
                              key={doc.file_id}
                              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 overflow-hidden"
                            >
                              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                  {doc.file_name}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc(doc)}
                                    className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Perbesar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomerDoc(doc)}
                                    className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                    title="Hapus dokumen"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div
                                className="h-52 w-full bg-zinc-900/5 dark:bg-black/40 flex items-center justify-center overflow-hidden cursor-pointer"
                                onClick={() => setPreviewDoc(doc)}
                              >
                                {isImage ? (
                                  <img
                                    src={docStreamUrl}
                                    alt={doc.file_name}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <iframe
                                    src={docStreamUrl}
                                    title={doc.file_name}
                                    className="w-full h-full border-0"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Upload File NPWP Apotek */}
                    <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Tambah Foto / PDF NPWP
                      </label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileUpload(e, "npwp_file_url")}
                        className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                      />
                    </div>

                    {/* Upload Dokumen Legalitas */}
                    <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Tambah Foto / PDF SIA, SIPA, KTP
                      </label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileUpload(e, "document_url")}
                        className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-800 hover:file:bg-purple-200 cursor-pointer"
                      />
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

      {/* PREVIEW DOKUMEN LANGSUNG DI DALAM APLIKASI */}
      {previewDoc && (() => {
        const isLocalDoc = previewDoc.file_id.startsWith("local_") || previewDoc.folder_id === "local_zip";
        const docStreamUrl = isLocalDoc
          ? `/api/tidb?action=view_document&file_id=${encodeURIComponent(previewDoc.file_id)}`
          : `https://drive.google.com/file/d/${previewDoc.file_id}/preview`;
        const docExternalUrl = isLocalDoc
          ? `/api/tidb?action=view_document&file_id=${encodeURIComponent(previewDoc.file_id)}`
          : `https://drive.google.com/file/d/${previewDoc.file_id}/view`;
        const isImage = (previewDoc.mime_type || "").startsWith("image/");

        return (
          <div
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="w-full max-w-5xl h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{previewDoc.file_name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {[selectedCust?.name || editForm?.name, previewDoc.folder_name, formatFileSize(previewDoc.size_bytes)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={docExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isLocalDoc ? "Buka / Download Tab Baru" : "Buka di Drive"}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    title="Tutup"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {isLocalDoc && isImage ? (
                <div className="flex-1 w-full bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-auto p-4">
                  <img
                    src={docStreamUrl}
                    alt={previewDoc.file_name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                  />
                </div>
              ) : (
                <iframe
                  key={previewDoc.file_id}
                  src={docStreamUrl}
                  className="flex-1 w-full bg-zinc-100 dark:bg-zinc-950"
                  allow="autoplay"
                  title={previewDoc.file_name}
                />
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
