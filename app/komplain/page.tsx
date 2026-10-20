"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowLeft,
  Copy,
  Check,
  Package,
  Building2,
  Calendar,
  Sparkles,
  ExternalLink,
  ClipboardCheck,
  Share2,
} from "lucide-react";

const COMMON_REASONS = [
  "Damage on Delivery (Barang rusak / bocor saat pengiriman)",
  "Fisik yang dikirim salah (Salah produk)",
  "Kuantitas kurang kirim (Shortage)",
  "Kuantitas kelebihan kirim (Overage)",
  "Kemasan penyok / segel terbuka",
  "Mendekati ED / Sudah ED (Expired Date)",
  "Salah cetak faktur / salah harga",
  "Toko tutup / dibatalkan apotek",
  "Komplain kualitas produk / cacat pabrik",
  "Lainnya",
];

export default function KomplainPage() {
  const [formData, setFormData] = useState({
    pbf: "MBI",
    customer_name: "",
    invoice_no: "",
    so_no: "",
    product_name: "",
    qty: 1,
    unit: "pcs",
    batch_no: "",
    expiry_date: "",
    reason: "Damage on Delivery (Barang rusak / bocor saat pengiriman)",
    custom_reason: "",
    note: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [submittedTimestamp, setSubmittedTimestamp] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWaText, setCopiedWaText] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const getWaSummaryText = () => {
    if (!submittedData) return "";
    const pbfName =
      submittedData.pbf === "MBI"
        ? "MBI (PT Medika Bina Investama)"
        : "MAI (PT Medika Abadi Investama)";

    return `📋 PENGAJUAN RETUR BARANG
────────────────────
🏢 PBF         : ${pbfName}
🏪 Apotek      : ${submittedData.customer_name}
🧾 No. Invoice : ${submittedData.invoice_no}
📦 No. SO      : ${submittedData.so_no || "-"}

💊 Nama Produk : ${submittedData.product_name}
🔢 Kuantitas   : ${submittedData.qty} ${submittedData.unit || "pcs"}
🏷️ Batch No.   : ${submittedData.batch_no || "-"}
📅 Expiry Date : ${submittedData.expiry_date || "-"}

⚠️ Reason      : ${submittedData.reason}${
      submittedData.note ? `\n📝 Catatan     : ${submittedData.note}` : ""
    }

⏰ Waktu Kirim : ${submittedTimestamp}
────────────────────
✅ Tiket retur telah dicatat ke sistem Fantastic Order & Google Sheet SHIPMENT ERROR.`;
  };

  const handleCopyWaText = () => {
    const text = getWaSummaryText();
    if (typeof window !== "undefined" && text) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedWaText(true);
        setTimeout(() => setCopiedWaText(false), 2500);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.customer_name.trim()) {
      setErrorMessage("Nama Apotek wajib diisi.");
      return;
    }
    if (!formData.invoice_no.trim()) {
      setErrorMessage("Nomor Invoice / Faktur wajib diisi.");
      return;
    }
    if (!formData.product_name.trim()) {
      setErrorMessage("Nama Produk wajib diisi.");
      return;
    }
    if (Number(formData.qty) <= 0) {
      setErrorMessage("Kuantitas minimal 1.");
      return;
    }

    const finalReason =
      formData.reason === "Lainnya" && formData.custom_reason.trim()
        ? formData.custom_reason.trim()
        : formData.reason;

    const now = new Date();
    const formattedTimestamp = now.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(/\./g, ":");

    const payload = {
      pbf: formData.pbf,
      customer_name: formData.customer_name.trim(),
      invoice_no: formData.invoice_no.trim(),
      so_no: formData.so_no.trim(),
      product_name: formData.product_name.trim(),
      qty: Number(formData.qty),
      unit: formData.unit,
      batch_no: formData.batch_no.trim(),
      expiry_date: formData.expiry_date.trim(),
      reason: finalReason,
      invoice_date: now.toISOString().split("T")[0],
      category: "3P", // default standard
      confirm: "Approve",
      action: "", // dikerjakan internal tim PBF
      status: "Pending",
      note: formData.note.trim(),
      person: "", // dikerjakan internal tim PBF
      root_cause: "", // dikerjakan internal tim PBF
    };

    setIsSubmitting(true);

    try {
      // 1. Simpan ke Database TiDB Cloud
      const res = await fetch("/api/tidb?action=create_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan pengajuan komplain ke database.");
      }

      setSubmittedData({ ...payload, insertId: data.insertId });
      setSubmittedTimestamp(formattedTimestamp);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kendala saat mengirim pengajuan komplain.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      pbf: "MBI",
      customer_name: "",
      invoice_no: "",
      so_no: "",
      product_name: "",
      qty: 1,
      unit: "pcs",
      batch_no: "",
      expiry_date: "",
      reason: "Damage on Delivery (Barang rusak / bocor saat pengiriman)",
      custom_reason: "",
      note: "",
    });
    setSubmittedData(null);
    setSubmittedTimestamp("");
    setIsSuccess(false);
    setErrorMessage("");
    setCopiedWaText(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Ke Beranda"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black">
                MBI & MAI
              </span>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
                Form Pengajuan Retur Barang
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                copiedLink
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              title="Salin link form ini untuk dibagikan ke WhatsApp"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Salin Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto w-full px-4 py-6 sm:py-8 flex-1">
        {isSuccess ? (
          /* SUCCESS STATE WITH WHATSAPP COPY FORMAT */
          <div className="bg-white dark:bg-[#0c0c0e] border border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-3 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-[11px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Pengajuan Berhasil Terkirim
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-3">
              Laporan Retur Berhasil Dicatat!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mt-1.5 leading-relaxed">
              Data tiket komplain telah otomatis disimpan ke sistem Fantastic Order dan otomatis tersinkron ke spreadsheet Google Sheet.
            </p>

            {/* WhatsApp Ready Format Card */}
            <div className="mt-5 text-left bg-zinc-900 text-zinc-100 rounded-xl p-4 sm:p-5 font-mono text-xs sm:text-[13px] leading-relaxed shadow-md border border-zinc-700/80 relative">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-700">
                <span className="font-sans font-bold text-xs text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>Format WhatsApp Siap Kirim</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyWaText}
                  className={`px-3 py-1.5 rounded-lg font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                    copiedWaText
                      ? "bg-emerald-500 text-white"
                      : "bg-white text-zinc-900 hover:bg-zinc-200"
                  }`}
                >
                  {copiedWaText ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersalin ke WA!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Salin Format WA</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="whitespace-pre-wrap font-mono text-zinc-200 selection:bg-emerald-800">
                {getWaSummaryText()}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto px-5 py-2.5 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ajukan Retur Lainnya</span>
              </button>
              <Link
                href="/"
                className="w-full sm:w-auto px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-zinc-300 dark:border-zinc-700 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ke Beranda Fantastic Order</span>
              </Link>
            </div>
          </div>
        ) : (
          /* CLEAN APOTEK / CUSTOMER FORM */
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-xs flex items-center gap-2 font-medium animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* CARD 1: INFORMASI APOTEK & FAKTUR */}
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <Building2 className="w-4 h-4 text-zinc-500" />
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  Informasi Apotek & Faktur
                </h2>
              </div>

              {/* PBF */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  🏢 PBF (Distributor) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "MBI", label: "MBI (PT Medika Bina Investama)" },
                    { id: "MAI", label: "MAI (PT Medika Abadi Investama)" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, pbf: p.id })}
                      className={`py-2.5 px-3 rounded-xl text-left border transition-all cursor-pointer ${
                        formData.pbf === p.id
                          ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-xs"
                          : "bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                      }`}
                    >
                      <div className="text-xs font-black">{p.id}</div>
                      <div className="text-[10px] opacity-75 truncate">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Apotek */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  🏪 Nama Apotek <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Contoh: Apotek Halomedika Bungur Malang"
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* No. Invoice */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    🧾 No. Invoice (Faktur) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.invoice_no}
                    onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                    placeholder="Contoh: Inv-cfo-2610-20414"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                  />
                </div>

                {/* No. SO */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    📦 No. Sales Order (SO)
                  </label>
                  <input
                    type="text"
                    value={formData.so_no}
                    onChange={(e) => setFormData({ ...formData, so_no: e.target.value })}
                    placeholder="Contoh: So-5yen4y-5539 (opsional)"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: DETAIL PRODUK & ALASAN */}
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <Package className="w-4 h-4 text-zinc-500" />
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  Detail Produk & Alasan Retur
                </h2>
              </div>

              {/* Nama Produk */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  💊 Nama Produk <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="Contoh: Ceradan ceramide dominant skin barrier cream 80g"
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                />
              </div>

              {/* Kuantitas & Satuan */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    🔢 Kuantitas <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: Number(e.target.value) })}
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Satuan
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all cursor-pointer"
                  >
                    <option value="pcs">pcs</option>
                    <option value="box">box</option>
                    <option value="botol">botol</option>
                    <option value="tube">tube</option>
                    <option value="strip">strip</option>
                    <option value="blister">blister</option>
                    <option value="ampul">ampul</option>
                    <option value="vial">vial</option>
                  </select>
                </div>
              </div>

              {/* Batch No & Expiry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    🏷️ Batch No. (Nomor Bets)
                  </label>
                  <input
                    type="text"
                    value={formData.batch_no}
                    onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })}
                    placeholder="Contoh: Bn-160603 (opsional)"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    📅 Expiry Date (ED)
                  </label>
                  <input
                    type="text"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    placeholder="Contoh: 06/2028 atau MM/YYYY"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  ⚠️ Reason (Alasan Retur) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all cursor-pointer"
                >
                  {COMMON_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {formData.reason === "Lainnya" && (
                  <input
                    type="text"
                    required
                    value={formData.custom_reason}
                    onChange={(e) => setFormData({ ...formData, custom_reason: e.target.value })}
                    placeholder="Tuliskan alasan retur lainnya..."
                    className="w-full mt-2 bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                )}
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  📝 Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Keterangan kondisi barang, foto bukti, atau catatan lainnya..."
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all resize-y"
                />
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-sm font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                    <span>Mengirim Pengajuan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Pengajuan Retur</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
        <p>
          Form Pengajuan Retur &bull; PT Medika Bina Investama &bull; PT Medika Abadi Investama
        </p>
      </footer>
    </div>
  );
}
