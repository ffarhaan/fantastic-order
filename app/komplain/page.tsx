"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
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
  User,
  HelpCircle,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";

const COMMON_PERSONS = [
  "ZAMI / RIZKY HERDIANSYAH",
  "FATUR / PRAYOGA",
  "DEPRI / IBNU",
  "FEBRI / YOGA",
  "ANGGA / RIAN",
  "ARIS / FAJAR",
  "DIMAS / ANDI",
];

const COMMON_REASONS = [
  "Fisik yang dikirim salah (salah produk)",
  "Kuantitas kurang kirim",
  "Kuantitas kelebihan kirim",
  "Barang rusak / pecah / bocor",
  "Kemasan penyok / segel rusak",
  "Mendekati ED / Sudah ED",
  "Salah cetak faktur / salah harga",
  "Toko tutup / dibatalkan apotek",
  "Komplain kualitas produk",
  "Lainnya",
];

const COMMON_ROOT_CAUSES = [
  "Human error (kelalaian petugas)",
  "Salah picking / ambil barang di rak",
  "Salah checking / tidak double check",
  "Kemasan rusak dari principal",
  "Salah input sistem SO",
  "Kesalahan kurir / ekspedisi",
  "Lainnya",
];

const COMMON_ACTIONS = [
  "Tukar fisik",
  "Potong tagihan (Credit Note)",
  "Tukar guling",
  "Tarik barang retur",
  "Retur dana / refund",
  "Lainnya",
];

export default function KomplainPage() {
  const [formData, setFormData] = useState({
    pbf: "MBI",
    category: "3P",
    customer_name: "",
    invoice_no: "",
    so_no: "",
    invoice_date: new Date().toISOString().split("T")[0],
    product_name: "",
    qty: 1,
    batch_no: "",
    expiry_date: "",
    reason: "Fisik yang dikirim salah (salah produk)",
    custom_reason: "",
    person: "",
    root_cause: "Human error (kelalaian petugas)",
    custom_root_cause: "",
    action: "Tukar fisik",
    note: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.customer_name.trim()) {
      setErrorMessage("Nama Apotek / Fasilitas Kesehatan wajib diisi.");
      return;
    }
    if (!formData.invoice_no.trim()) {
      setErrorMessage("Nomor Faktur wajib diisi.");
      return;
    }
    if (!formData.product_name.trim()) {
      setErrorMessage("Nama Produk wajib diisi.");
      return;
    }
    if (Number(formData.qty) <= 0) {
      setErrorMessage("Kuantitas retur minimal 1.");
      return;
    }

    const finalReason =
      formData.reason === "Lainnya" && formData.custom_reason.trim()
        ? formData.custom_reason.trim()
        : formData.reason;

    const finalRootCause =
      formData.root_cause === "Lainnya" && formData.custom_root_cause.trim()
        ? formData.custom_root_cause.trim()
        : formData.root_cause;

    const payload = {
      pbf: formData.pbf,
      customer_name: formData.customer_name.trim().toUpperCase(),
      invoice_no: formData.invoice_no.trim().toUpperCase(),
      so_no: formData.so_no.trim().toUpperCase(),
      product_name: formData.product_name.trim(),
      qty: Number(formData.qty),
      batch_no: formData.batch_no.trim().toUpperCase(),
      expiry_date: formData.expiry_date,
      reason: finalReason,
      invoice_date: formData.invoice_date,
      category: formData.category,
      confirm: "Approve",
      action: formData.action,
      status: "Pending",
      note: formData.note.trim(),
      person: formData.person.trim().toUpperCase(),
      root_cause: finalRootCause,
    };

    setIsSubmitting(true);

    try {
      // 1. Simpan ke Database TiDB Cloud Fantastic Order
      const res = await fetch("/api/tidb?action=create_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan komplain ke database.");
      }

      // 2. Direct browser sync fallback ke Google Apps Script Webhook
      const webhookUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_SHIPMENT_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          fetch(webhookUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actionType: "create",
              pbf: payload.pbf,
              namaApotek: payload.customer_name,
              invoiceNo: payload.invoice_no,
              soNo: payload.so_no,
              productName: payload.product_name,
              qty: payload.qty,
              batchNo: payload.batch_no,
              expiryDate: payload.expiry_date,
              reason: payload.reason,
              invoiceDate: payload.invoice_date,
              reportDate: new Date().toISOString().split("T")[0],
              category: payload.category,
              confirm: payload.confirm,
              action: payload.action,
              status: payload.status,
              note: payload.note,
              person: payload.person,
              rootCause: payload.root_cause,
            }),
          }).catch(() => {});
        } catch (e) {
          // ignore client-side CORS silently
        }
      }

      setSubmittedData({ ...payload, insertId: data.insertId });
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat mengirim komplain.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      pbf: "MBI",
      category: "3P",
      customer_name: "",
      invoice_no: "",
      so_no: "",
      invoice_date: new Date().toISOString().split("T")[0],
      product_name: "",
      qty: 1,
      batch_no: "",
      expiry_date: "",
      reason: "Fisik yang dikirim salah (salah produk)",
      custom_reason: "",
      person: "",
      root_cause: "Human error (kelalaian petugas)",
      custom_root_cause: "",
      action: "Tukar fisik",
      note: "",
    });
    setSubmittedData(null);
    setIsSuccess(false);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0a0a0c]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Kembali ke Fantastic Order"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest uppercase px-2 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black">
                  FANTASTIC ORDER
                </span>
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Shipment Error
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-900 dark:text-white mt-0.5">
                Form Input Komplain & Retur
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
              title="Salin link form ini"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="hidden sm:inline">Salin Link Form</span>
                  <span className="sm:hidden">Salin</span>
                </>
              )}
            </button>

            <a
              href="https://docs.google.com/spreadsheets/d/1ZU07XQR0PWqa2gqZc2Cf6a1pFITgkSE06R9rPScamg0/edit?gid=1888106176#gid=1888106176"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition-all flex items-center gap-1.5"
              title="Buka Spreadsheet Shipment Error"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Sheet</span>
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto w-full px-4 py-6 sm:py-8 flex-1">
        {isSuccess ? (
          /* SUCCESS STATE */
          <div className="bg-white dark:bg-[#0c0c0e] border border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Sinkronisasi Berhasil
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-3">
              Komplain Berhasil Dicatat!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mt-2 leading-relaxed">
              Data tiket komplain telah otomatis disimpan ke database{" "}
              <strong className="text-zinc-900 dark:text-white font-semibold">Fantastic Order</strong>{" "}
              dan tersinkron ke spreadsheet{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                SHIPMENT ERROR
              </strong>
              .
            </p>

            {/* Ticket Summary Box */}
            {submittedData && (
              <div className="mt-6 max-w-lg mx-auto bg-zinc-50 dark:bg-black/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-left text-xs space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium">No. Faktur:</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">
                    {submittedData.invoice_no}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium">Nama Apotek:</span>
                  <span className="font-bold text-zinc-900 dark:text-white text-right">
                    {submittedData.customer_name}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium">Produk & Qty:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-right">
                    {submittedData.product_name} ({submittedData.qty} item)
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium">Alasan (Reason):</span>
                  <span className="text-zinc-700 dark:text-zinc-300 text-right">
                    {submittedData.reason}
                  </span>
                </div>
                {submittedData.person && (
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 font-medium">Pelaku Kesalahan (Person):</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {submittedData.person}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium">Tindakan:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {submittedData.action}
                  </span>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto px-5 py-2.5 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Kirim Komplain Lainnya</span>
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
          /* INPUT FORM */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Banner Information */}
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-xs leading-relaxed">
                <h3 className="font-bold text-zinc-900 dark:text-white">
                  Formulir Laporan Retur & Shipment Error
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Gunakan link ini untuk melaporkan salah kirim barang, selisih kuantitas, fisik
                  rusak, atau faktur bermasalah. Data yang dikirim akan otomatis masuk ke tabel
                  retur Fantastic Order dan baris baru spreadsheet Google Sheet.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-xs flex items-center gap-2 font-medium animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SECTION 1: DATA TRANSAKSI & FAKTUR */}
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <Building2 className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  1. Informasi Transaksi & Pelanggan
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PBF Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    PBF (Distributor) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["MBI", "MAI"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, pbf: p })}
                        className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          formData.pbf === p
                            ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-xs"
                            : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kategori */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["1P", "2P", "3P"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat })}
                        className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          formData.category === cat
                            ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-xs"
                            : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nama Apotek */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Nama Apotek / Klinik / RS <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    placeholder="Contoh: APOTEK KIMIA FARMA BINTARO, APOTEK ROXY..."
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all uppercase"
                  />
                </div>

                {/* No. Faktur */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Nomor Faktur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.invoice_no}
                    onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                    placeholder="Contoh: 00123/INV/2026 atau nomor faktur lainnya"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all uppercase"
                  />
                </div>

                {/* No. SO / TO / Shipment ID */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    No. Sales Order (SO) / Transfer Order
                  </label>
                  <input
                    type="text"
                    value={formData.so_no}
                    onChange={(e) => setFormData({ ...formData, so_no: e.target.value })}
                    placeholder="Contoh: SO-2603001 (opsional)"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all uppercase"
                  />
                </div>

                {/* Tanggal Faktur */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Tanggal Faktur
                  </label>
                  <input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: DETAIL PRODUK & KENDALA */}
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <Package className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  2. Detail Produk & Keluhan Retur
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Produk */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Nama Produk (Sesuai Penamaan di Invoice) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="Contoh: AMOXICILLIN 500MG BOX 100 TAB"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all uppercase"
                  />
                </div>

                {/* Kuantitas Retur */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Kuantitas (Yang Diretur / Selisih) <span className="text-red-500">*</span>
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

                {/* Batch Number */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Batch Number (Nomor Bets)
                  </label>
                  <input
                    type="text"
                    value={formData.batch_no}
                    onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })}
                    placeholder="Contoh: B240101 (opsional)"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all uppercase"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Expiry Date (ED)
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>

                {/* Reason (Alasan Retur) */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Alasan Komplain / Retur (Reason) <span className="text-red-500">*</span>
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
                      placeholder="Jelaskan alasan komplain lainnya..."
                      className="w-full mt-2 bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: INVESTIGASI & TINDAK LANJUT */}
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <User className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  3. Investigasi Internal & Pelaku Kesalahan (Gudang)
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Person: Pelaku Kesalahan (Picker & Checker) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
                      <span>Person (Pelaku Kesalahan / Picker & Checker)</span>
                    </label>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      Bisa pilih dari daftar atau ketik baru
                    </span>
                  </div>

                  <input
                    list="person-suggestions"
                    type="text"
                    value={formData.person}
                    onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                    placeholder="Pilih atau ketik: ZAMI / RIZKY HERDIANSYAH, FATUR / PRAYOGA..."
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all uppercase"
                  />
                  <datalist id="person-suggestions">
                    {COMMON_PERSONS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>

                  {/* Quick Pills for Common Pairs */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-zinc-400 self-center mr-1">Rekomendasi:</span>
                    {COMMON_PERSONS.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, person: p })}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Root Cause */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Penyebab Kesalahan (Root Cause)
                  </label>
                  <select
                    value={formData.root_cause}
                    onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all cursor-pointer"
                  >
                    {COMMON_ROOT_CAUSES.map((rc) => (
                      <option key={rc} value={rc}>
                        {rc}
                      </option>
                    ))}
                  </select>

                  {formData.root_cause === "Lainnya" && (
                    <input
                      type="text"
                      required
                      value={formData.custom_root_cause}
                      onChange={(e) =>
                        setFormData({ ...formData, custom_root_cause: e.target.value })
                      }
                      placeholder="Jelaskan penyebab lainnya..."
                      className="w-full mt-2 bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  )}
                </div>

                {/* Tindakan yang Diajukan (Action) */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Tindakan Yang Diajukan (Action)
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-black dark:focus:border-white transition-all cursor-pointer"
                  >
                    {COMMON_ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Catatan Tambahan (Note) */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Catatan Tambahan / Kronologi Kejadian (Note)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Tuliskan catatan detail kejadian, nomor batch pengganti, atau kronologi serah terima barang..."
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Reset Form
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-7 py-3 rounded-xl bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan & Menyinkronkan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Laporan Komplain</span>
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
          Fantastic Order &bull; Terhubung ke Google Sheet SHIPMENT ERROR MAI & MBI &bull; TiDB Cloud
        </p>
      </footer>
    </div>
  );
}
