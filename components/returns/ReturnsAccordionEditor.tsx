"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { ShipmentReturnRecord } from "@/lib/types";
import { OFFICIAL_MBI_PERSONNEL } from "@/lib/personnelUtils";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Maximize2,
  Video,
  Package,
  FileText,
  XCircle,
  Trash2,
  RefreshCw,
  Building2,
} from "lucide-react";

export interface ReturnEditFormState {
  pbf: string;
  customer_name: string;
  invoice_no: string;
  so_no: string;
  product_name: string;
  qty: number;
  batch_no: string;
  expiry_date: string;
  reason: string;
  invoice_date: string;
  report_date: string;
  category: string;
  confirm: string;
  action: string;
  nota_retur_no: string;
  resolved_date: string;
  status: string;
  note: string;
  person: string;
  root_cause: string;
  video_url: string;
  reject_reason: string;
  reject_media_url: string;
  inprogress_type: string;
}

export function buildReturnEditFormState(r: ShipmentReturnRecord): ReturnEditFormState {
  return {
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
    confirm: r.confirm || "",
    action: r.action || "",
    nota_retur_no: r.nota_retur_no || "",
    resolved_date: r.resolved_date || "",
    status: r.status || "Pending",
    note: r.note || "",
    person: r.person || "",
    root_cause: r.root_cause || "",
    video_url: r.video_url || "",
    reject_reason: r.reject_reason || "",
    reject_media_url: r.reject_media_url || "",
    inprogress_type: r.inprogress_type || "",
  };
}

interface ReturnsAccordionEditorProps {
  record: ShipmentReturnRecord;
  canEditReturns: boolean;
  canDeleteReturns: boolean;
  isUpdating: boolean;
  loadingPhotoId: number | null;
  customerSuggestionsList: string[];
  complaintReasons: string[];
  calculateDaysUntilToday: (reportDateStr?: string | null) => number | string;
  calculateDaysUntilClose: (
    reportDateStr?: string | null,
    resolvedDateStr?: string | null,
    status?: string | null,
    invoiceDateStr?: string | null
  ) => number | string;
  onPreviewPhoto: (r: ShipmentReturnRecord) => void;
  onPreviewVideo: (url: string) => void;
  onClose: () => void;
  onDelete: (id: number, invoiceNo: string) => void;
  onSubmitSave: (formSnapshot: ReturnEditFormState) => void;
  onSelectCustomer?: (customerName: string) => void;
}

const ReturnsAccordionEditor = memo(function ReturnsAccordionEditor({
  record: r,
  canEditReturns,
  canDeleteReturns,
  isUpdating,
  loadingPhotoId,
  customerSuggestionsList,
  complaintReasons,
  calculateDaysUntilToday,
  calculateDaysUntilClose,
  onPreviewPhoto,
  onPreviewVideo,
  onClose,
  onDelete,
  onSubmitSave,
  onSelectCustomer,
}: ReturnsAccordionEditorProps) {
  const [editForm, setEditForm] = useState<ReturnEditFormState>(() => buildReturnEditFormState(r));
  const [showEditCustomerSuggestions, setShowEditCustomerSuggestions] = useState(false);
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);

  // Sync only when switching to another record ID
  useEffect(() => {
    setEditForm(buildReturnEditFormState(r));
    setShowEditCustomerSuggestions(false);
    setShowPersonSuggestions(false);
  }, [r]);

  const currentPersonQuery = useMemo(() => {
    const raw = editForm.person || "";
    const parts = raw.split(/[\/]/);
    return (parts[parts.length - 1] || "").trim().toLowerCase();
  }, [editForm.person]);

  const editPersonSuggestions = useMemo(() => {
    if (!currentPersonQuery) {
      return OFFICIAL_MBI_PERSONNEL;
    }
    return OFFICIAL_MBI_PERSONNEL.filter((p) => p.toLowerCase().includes(currentPersonQuery));
  }, [currentPersonQuery]);

  const editCustomerSuggestions = useMemo(() => {
    const q = (editForm.customer_name || "").trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return customerSuggestionsList.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [editForm.customer_name, customerSuggestionsList]);

  const handleSelectPerson = useCallback((selectedName: string) => {
    setEditForm((prev) => {
      const current = prev.person || "";
      const parts = current.split(/[\/]/);
      parts.pop();
      const existing = parts.map((p) => p.trim()).filter(Boolean);
      existing.push(selectedName);
      const newPerson = existing.join(" / ");

      const updates: Partial<ReturnEditFormState> = { person: newPerson };
      if (newPerson.trim() && (prev.status === "Pending" || !prev.status)) {
        updates.status = "In Progress";
        if (prev.confirm !== "Approve") updates.confirm = "Approve";
      }
      return { ...prev, ...updates };
    });
    setShowPersonSuggestions(false);
  }, []);

  const handleAppendPersonSeparator = useCallback(() => {
    setEditForm((prev) => {
      const current = (prev.person || "").trim();
      if (!current || current.endsWith("/")) return prev;
      return { ...prev, person: `${current} / ` };
    });
    setShowPersonSuggestions(true);
  }, []);

  const daysUntilCloseValue = useMemo(
    () =>
      calculateDaysUntilClose(
        editForm.report_date,
        editForm.resolved_date,
        editForm.status,
        editForm.invoice_date
      ),
    [
      calculateDaysUntilClose,
      editForm.report_date,
      editForm.resolved_date,
      editForm.status,
      editForm.invoice_date,
    ]
  );

  const daysUntilTodayValue = useMemo(
    () => calculateDaysUntilToday(editForm.report_date),
    [calculateDaysUntilToday, editForm.report_date]
  );

  return (
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

          {/* Status Tiket */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs ${
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
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
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
              onClick={() => onPreviewPhoto(r)}
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
              onClick={() => onPreviewVideo(r.video_url || "")}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800"
            >
              <Video className="w-3 h-3" />
              <span>Putar Video Unboxing</span>
            </button>
          )}
        </div>
      </div>

      {/* Form Edit Ringkas & Lengkap */}
      <div className="space-y-3 text-xs">
        {!canEditReturns && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Mode Hanya Lihat: Akun Anda tidak memiliki hak akses mengubah modul Shipment Error. Hubungi Farhan (Super Admin) untuk meminta akses.
            </span>
          </div>
        )}

        {/* Bagian 1: Data Faktur & Merchant */}
        <div className="bg-zinc-50 dark:bg-slate-950/80 p-2.5 sm:p-3 rounded-lg border border-zinc-200 dark:border-slate-800 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
            1. Data Faktur &amp; Merchant
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
                  const val = e.target.value;
                  setEditForm((prev) => ({ ...prev, customer_name: val }));
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
                        setEditForm((prev) => ({ ...prev, customer_name: name }));
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
                onChange={(e) => setEditForm((prev) => ({ ...prev, pbf: e.target.value }))}
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
                onChange={(e) => setEditForm((prev) => ({ ...prev, invoice_no: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-indigo-700 dark:text-indigo-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Tgl Faktur</label>
              <input
                type="date"
                value={editForm.invoice_date ? editForm.invoice_date.split("T")[0] : ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, invoice_date: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Tgl Lapor / Kejadian</label>
              <input
                type="date"
                value={editForm.report_date ? editForm.report_date.split("T")[0] : ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, report_date: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-rose-700 dark:text-rose-400 font-mono font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">No. Sales Order (SO)</label>
              <input
                type="text"
                value={editForm.so_no}
                onChange={(e) => setEditForm((prev) => ({ ...prev, so_no: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Kategori</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
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
            2. Detail Produk &amp; Kendala (Reason)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <div className="sm:col-span-3">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Nama Produk</label>
              <input
                type="text"
                value={editForm.product_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, product_name: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Kuantitas (Qty)</label>
              <input
                type="number"
                min="1"
                value={editForm.qty}
                onChange={(e) => setEditForm((prev) => ({ ...prev, qty: Number(e.target.value) || 1 }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Batch Number</label>
              <input
                type="text"
                value={editForm.batch_no}
                onChange={(e) => setEditForm((prev) => ({ ...prev, batch_no: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Expiry Date (ED)</label>
              <input
                type="text"
                value={editForm.expiry_date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Alasan / Kendala Dilaporkan (Dari Pelapor)
              </label>
              <input
                type="text"
                list="complaint-reasons-list"
                value={editForm.reason}
                onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Pilih atau ketik alasan..."
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-amber-800 dark:text-amber-300 font-bold"
              />
              <datalist id="complaint-reasons-list">
                {complaintReasons.map((reasonOption) => (
                  <option key={reasonOption} value={reasonOption} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-3">
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Catatan Tambahan dari Pengaju Komplain (Note Pelapor)
              </label>
              <input
                type="text"
                value={editForm.note}
                onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
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
              <span>🏢 3. Balasan &amp; Tindak Lanjut Pihak Gudang / Logistik (Investigasi, Solusi &amp; Keputusan)</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">
              *Mengisi Tindakan / Penyebab otomatis mengaktifkan status{" "}
              <strong className="text-blue-600 dark:text-blue-400">In Progress</strong>
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
                  setEditForm((prev) => {
                    const updates: Partial<ReturnEditFormState> = { action: val };
                    if (val.trim() && (prev.status === "Pending" || !prev.status)) {
                      updates.status = "In Progress";
                      if (prev.confirm !== "Approve") updates.confirm = "Approve";
                    }
                    return { ...prev, ...updates };
                  });
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
                  setEditForm((prev) => {
                    const updates: Partial<ReturnEditFormState> = { root_cause: val };
                    if (val.trim() && (prev.status === "Pending" || !prev.status)) {
                      updates.status = "In Progress";
                      if (prev.confirm !== "Approve") updates.confirm = "Approve";
                    }
                    return { ...prev, ...updates };
                  });
                }}
                placeholder="Human error / Salah ambil picker / dll"
                className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-lg p-1.5 text-blue-900 dark:text-blue-200 font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-zinc-700 dark:text-slate-400 font-bold block">
                  Personil Terkait{" "}
                  {editForm.inprogress_type === "Klaim & Retur"
                    ? "(Opsional untuk Klaim & Retur)"
                    : "(Picker / Checker)"}
                </label>
                {editForm.person && editForm.person.trim() && !editForm.person.trim().endsWith("/") && (
                  <button
                    type="button"
                    onClick={handleAppendPersonSeparator}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 cursor-pointer"
                    title="Tambah personil ke-2 atau ke-3 dengan pemisah garis miring ( / )"
                  >
                    + Tambah Personil ( / )
                  </button>
                )}
              </div>
              <input
                type="text"
                value={editForm.person}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditForm((prev) => {
                    const updates: Partial<ReturnEditFormState> = { person: val };
                    if (val.trim() && (prev.status === "Pending" || !prev.status)) {
                      updates.status = "In Progress";
                      if (prev.confirm !== "Approve") updates.confirm = "Approve";
                    }
                    return { ...prev, ...updates };
                  });
                  setShowPersonSuggestions(true);
                }}
                onFocus={() => setShowPersonSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 250)}
                placeholder={
                  editForm.inprogress_type === "Klaim & Retur"
                    ? "Opsional (Boleh dikosongkan)"
                    : "Ketik nama personil (contoh: AGUS SUROSO / BUDI SUSANTO)"
                }
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-bold"
              />

              {/* Petunjuk format pemisah garis miring */}
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-slate-400 flex items-center justify-between">
                <span>
                  Wajib pakai tanda{" "}
                  <strong className="text-blue-600 dark:text-blue-400 font-black px-1 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-800">
                    {" "}
                    /{" "}
                  </strong>{" "}
                  jika 2 atau 3 personil
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-slate-500">Master: 60 Personil MBI</span>
              </div>

              {/* Suggestions Dropdown */}
              {showPersonSuggestions && editPersonSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto py-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-zinc-100 dark:border-slate-800 flex items-center justify-between">
                    <span>Pilih Personil MBI ({editPersonSuggestions.length})</span>
                    <span className="text-[9px] text-zinc-400 lowercase">klik nama untuk memasukkan</span>
                  </div>
                  {editPersonSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectPerson(name);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-black dark:text-white hover:bg-blue-50 dark:hover:bg-blue-950/60 flex items-center justify-between transition-colors cursor-pointer border-b border-zinc-50 dark:border-slate-800/40 last:border-b-0"
                    >
                      <span className="font-bold">{name}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-slate-500 font-medium">Gudang MBI</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">No. Nota Retur</label>
              <input
                type="text"
                value={editForm.nota_retur_no}
                onChange={(e) => setEditForm((prev) => ({ ...prev, nota_retur_no: e.target.value }))}
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
                  setEditForm((prev) => {
                    const updates: Partial<ReturnEditFormState> = { confirm: val };
                    if (val === "Approve") {
                      updates.status = "In Progress";
                      if (!prev.inprogress_type) {
                        const isOp = [
                          "fisik yang dikirim kurang",
                          "fisik yang dikirim lebih",
                          "fisik yang dikirim salah",
                          "fisik yang dikirim tidak ada",
                        ].some(
                          (k) =>
                            (r.description || "").toLowerCase().includes(k) ||
                            (prev.reason || "").toLowerCase().includes(k)
                        );
                        updates.inprogress_type = isOp ? "Operasional" : "Klaim & Retur";
                      }
                    } else if (val === "Reject") {
                      updates.status = "Rejected";
                      updates.resolved_date = "";
                    } else {
                      updates.status = "Pending";
                    }
                    return { ...prev, ...updates };
                  });
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
                <option value="Approve">Valid (Kesalahan PBF)</option>
                <option value="Reject">Reject (Bukan Kesalahan PBF)</option>
              </select>
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">
                Tgl Penyelesaian (Resolved Date)
              </label>
              <input
                type="date"
                value={editForm.resolved_date ? editForm.resolved_date.split("T")[0] : ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, resolved_date: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-black dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-zinc-700 dark:text-slate-400 font-bold block mb-0.5">Days Until Close</label>
              <div
                className={`p-1.5 border rounded-lg font-mono font-bold text-xs flex items-center justify-between ${
                  daysUntilCloseValue === "#N/A"
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                }`}
              >
                <span>
                  {daysUntilCloseValue === "#N/A"
                    ? "#N/A (Belum Close)"
                    : `${daysUntilCloseValue} hari`}
                </span>
                <span className="text-[10px] font-normal text-zinc-500">
                  Today: {daysUntilTodayValue} hr
                </span>
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
                  onClick={() => setEditForm((prev) => ({ ...prev, inprogress_type: "Operasional" }))}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    editForm.inprogress_type === "Operasional"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-white dark:bg-slate-900 text-zinc-700 dark:text-slate-300 border-blue-200 dark:border-blue-900/40 hover:border-blue-400"
                  }`}
                >
                  <div className="font-extrabold text-xs flex items-center gap-1.5">
                    <Package className="w-4 h-4" />
                    <span>In Progress (Operasional)</span>
                  </div>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      editForm.inprogress_type === "Operasional"
                        ? "text-blue-100"
                        : "text-zinc-500 dark:text-slate-400"
                    }`}
                  >
                    Kelalaian fisik pengiriman: Fisik kurang, lebih, salah, tidak ada (Penyiapan barang &amp; antar driver).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setEditForm((prev) => ({ ...prev, inprogress_type: "Klaim & Retur" }))}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    editForm.inprogress_type === "Klaim & Retur"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-white dark:bg-slate-900 text-zinc-700 dark:text-slate-300 border-blue-200 dark:border-blue-900/40 hover:border-blue-400"
                  }`}
                >
                  <div className="font-extrabold text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>In Progress (Klaim &amp; Retur)</span>
                  </div>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      editForm.inprogress_type === "Klaim & Retur"
                        ? "text-blue-100"
                        : "text-zinc-500 dark:text-slate-400"
                    }`}
                  >
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditForm((prev) => ({ ...prev, reject_reason: val, note: val }));
                  }}
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
                  onChange={(e) => setEditForm((prev) => ({ ...prev, reject_media_url: e.target.value }))}
                  placeholder="URL Foto/Video Bukti CCTV Gudang atau Packing List..."
                  className="w-full bg-white dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 rounded-lg p-1.5 text-xs text-zinc-900 dark:text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* Bukti Media Apotek */}
          {(r.video_url || editForm.video_url) && (
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
                onClick={() => onPreviewVideo(r.video_url || editForm.video_url || "")}
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
          {canDeleteReturns && (
            <button
              type="button"
              onClick={() => onDelete(r.id, r.invoice_no)}
              disabled={isUpdating}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 rounded-xl text-xs font-bold border border-red-300 dark:border-red-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Hapus komplain ini dari database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-black dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-zinc-300 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {canEditReturns ? (
            <button
              type="button"
              onClick={() => onSubmitSave(editForm)}
              disabled={isUpdating}
              className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-colors disabled:opacity-50 cursor-pointer"
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
              Read-Only
            </span>
          )}

          {onSelectCustomer && (
            <button
              type="button"
              onClick={() => {
                const c = r.customer_name;
                onClose();
                onSelectCustomer(c);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 ml-2 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Lihat Master Customer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default ReturnsAccordionEditor;
