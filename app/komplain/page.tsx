"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Copy,
  Check,
  Package,
  Building2,
  Calendar,
  Sparkles,
  Share2,
  Plus,
  Trash2,
  Camera,
  Image as ImageIcon,
  X,
  ExternalLink,
  MessageCircle,
  Download,
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

interface ReturnProductItem {
  id: string;
  product_name: string;
  qty: number;
  unit: string;
  batch_no: string;
  expiry_date: string;
  reason: string;
  custom_reason: string;
  note: string;
}

export default function KomplainPage() {
  const [headerData, setHeaderData] = useState({
    pbf: "MBI",
    customer_name: "",
    invoice_no: "",
    so_no: "",
  });

  const [products, setProducts] = useState<ReturnProductItem[]>([
    {
      id: "prod-1",
      product_name: "",
      qty: 1,
      unit: "pcs",
      batch_no: "",
      expiry_date: "",
      reason: "Damage on Delivery (Barang rusak / bocor saat pengiriman)",
      custom_reason: "",
      note: "",
    },
  ]);

  // Photo state
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoSizeKb, setPhotoSizeKb] = useState<number>(0);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [submittedTimestamp, setSubmittedTimestamp] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWaText, setCopiedWaText] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [waNotification, setWaNotification] = useState("");

  // Master Customers suggestions
  const [masterCustomers, setMasterCustomers] = useState<{ id: string; name: string; category?: string }[]>([]);
  const [showApotekSuggestions, setShowApotekSuggestions] = useState(false);

  useEffect(() => {
    fetch("/api/tidb?action=customers&limit=200")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setMasterCustomers(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Real-time server search as user types
  useEffect(() => {
    const q = (headerData.customer_name || "").trim();
    if (q.length < 2) return;

    const timer = setTimeout(() => {
      fetch(`/api/tidb?action=customers&search=${encodeURIComponent(q)}&limit=20`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            setMasterCustomers((prev) => {
              const map = new Map<string, { id: string; name: string; category?: string }>();
              for (const c of prev) map.set(c.id || c.name, c);
              for (const c of res.data) map.set(c.id || c.name, c);
              return Array.from(map.values());
            });
          }
        })
        .catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [headerData.customer_name]);

  const apotekSuggestions = useMemo(() => {
    if (!headerData.customer_name || headerData.customer_name.trim().length < 2) return [];
    const q = headerData.customer_name.toLowerCase();
    return masterCustomers
      .filter((c) => c.name && c.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [headerData.customer_name, masterCustomers]);

  // Compress photo via Canvas
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Gagal mengolah gambar");
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.72 quality
          const compressed = canvas.toDataURL("image/jpeg", 0.72);
          const sizeInKb = Math.round((compressed.length * 3) / 4 / 1024);

          setPhotoBase64(compressed);
          setPhotoSizeKb(sizeInKb);
        } catch (err: any) {
          console.error("Compression error:", err);
          setErrorMessage("Gagal mengompres foto. Silakan coba file lain.");
        } finally {
          setIsCompressingPhoto(false);
        }
      };
      img.onerror = () => {
        setIsCompressingPhoto(false);
        setErrorMessage("Format gambar tidak valid.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoBase64(null);
    setPhotoSizeKb(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Add & Remove Product rows
  const handleAddProduct = () => {
    setProducts((prev) => [
      ...prev,
      {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_name: "",
        qty: 1,
        unit: "pcs",
        batch_no: "",
        expiry_date: "",
        reason: "Damage on Delivery (Barang rusak / bocor saat pengiriman)",
        custom_reason: "",
        note: "",
      },
    ]);
  };

  const handleRemoveProduct = (id: string) => {
    if (products.length <= 1) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateProduct = (id: string, field: keyof ReturnProductItem, value: any) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

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

    const itemsList = submittedData.products
      ?.map((p: any, idx: number) => {
        const itemReason = p.reason || "-";
        const itemNote = p.note ? `\n   - Catatan: ${p.note}` : "";
        const itemBatch = p.batch_no ? `Batch: ${p.batch_no}` : "Batch: -";
        const itemED = p.expiry_date ? `ED: ${p.expiry_date}` : "ED: -";
        return `${idx + 1}. *${p.product_name}*
   - Qty: ${p.qty} ${p.unit || "pcs"}
   - ${itemBatch} | ${itemED}
   - Alasan: ${itemReason}${itemNote}`;
      })
      .join("\n\n");

    const photoStatus = submittedData.hasPhoto
      ? "- Bukti Foto: Terlampir di Sistem & WhatsApp"
      : "- Bukti Foto: Tidak dilampirkan";

    return `*FORM PENGAJUAN RETUR BARANG*
----------------------------------------
*PBF*         : ${pbfName}
*Apotek*      : ${submittedData.customer_name}
*No. Faktur*  : ${submittedData.invoice_no}
*No. SO*      : ${submittedData.so_no || "-"}

*DAFTAR ITEM RETUR (${submittedData.products?.length || 1} Produk):*
${itemsList}

${photoStatus}
*Waktu Kirim* : ${submittedTimestamp}
----------------------------------------
*Status*: Tiket telah dicatat ke sistem logistik.`;
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

  const handleDownloadPhoto = () => {
    if (!photoBase64) return;
    const a = document.createElement("a");
    a.href = photoBase64;
    a.download = `bukti-retur-${submittedData?.invoice_no || "faktur"}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareToWhatsApp = async () => {
    const text = getWaSummaryText();
    if (!text) return;

    setIsSharing(true);
    setWaNotification("");

    try {
      // 1. Try native Web Share API with image file attached (Mobile Android/iOS)
      if (photoBase64 && typeof navigator !== "undefined" && (navigator as any).canShare) {
        try {
          const arr = photoBase64.split(",");
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const file = new File(
            [u8arr],
            `bukti-retur-${submittedData?.invoice_no || "faktur"}.jpg`,
            { type: mime }
          );

          if ((navigator as any).canShare({ files: [file] })) {
            await (navigator as any).share({
              files: [file],
              title: "Pengajuan Retur Barang",
              text: text,
            });
            setIsSharing(false);
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") {
            setIsSharing(false);
            return;
          }
          console.warn("Web Share failed, fallback to download + WA URL", shareErr);
        }
      }

      // 2. Fallback (Desktop PC or browser without file sharing)
      if (photoBase64) {
        handleDownloadPhoto();
        setWaNotification("Foto bukti berhasil diunduh & teks disalin! Silakan lampirkan foto saat WhatsApp terbuka.");
      } else {
        setWaNotification("Teks format pengajuan berhasil disalin!");
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text).catch(() => {});
      }

      if (typeof window !== "undefined") {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(waUrl, "_blank");
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDirectWaLink = () => {
    const text = getWaSummaryText();
    if (typeof window !== "undefined" && text) {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, "_blank");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!headerData.customer_name.trim()) {
      setErrorMessage("Nama Apotek wajib diisi.");
      return;
    }
    if (!headerData.invoice_no.trim()) {
      setErrorMessage("Nomor Invoice / Faktur wajib diisi.");
      return;
    }

    // Validate products
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.product_name.trim()) {
        setErrorMessage(`Nama Produk pada item #${i + 1} wajib diisi.`);
        return;
      }
      if (Number(p.qty) <= 0) {
        setErrorMessage(`Kuantitas pada item #${i + 1} minimal 1.`);
        return;
      }
    }

    const now = new Date();
    const formattedTimestamp = now.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(/\./g, ":");

    const processedProducts = products.map((p) => {
      const finalReason =
        p.reason === "Lainnya" && p.custom_reason.trim()
          ? p.custom_reason.trim()
          : p.reason;

      return {
        product_name: p.product_name.trim(),
        qty: Number(p.qty),
        unit: p.unit || "pcs",
        batch_no: p.batch_no.trim(),
        expiry_date: p.expiry_date.trim(),
        reason: finalReason,
        note: p.note.trim(),
      };
    });

    // PENTING: Kolom-kolom evaluasi internal (category, confirm, action, person, root_cause)
    // TIDAK BOLEH diisi otomatis. Harus dibiarkan kosong agar nanti diisi & diinvestigasi oleh tim internal.
    const payload = {
      pbf: headerData.pbf,
      customer_name: headerData.customer_name.trim(),
      invoice_no: headerData.invoice_no.trim(),
      so_no: headerData.so_no.trim(),
      invoice_date: now.toISOString().split("T")[0],
      category: "", // Kosong: diisi oleh tim internal
      confirm: "",  // Kosong: diisi oleh tim internal
      action: "",   // Kosong: diisi oleh tim internal
      status: "Pending", // Status awal tiket
      person: "",   // Kosong: diisi oleh tim internal (picker/checker bersangkutan)
      root_cause: "", // Kosong: diisi oleh tim internal
      photo_url: photoBase64 || null,
      products: processedProducts,
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

      setSubmittedData({
        ...payload,
        hasPhoto: Boolean(photoBase64),
        insertedCount: data.count || processedProducts.length,
      });
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
    setHeaderData({
      pbf: "MBI",
      customer_name: "",
      invoice_no: "",
      so_no: "",
    });
    setProducts([
      {
        id: "prod-1",
        product_name: "",
        qty: 1,
        unit: "pcs",
        batch_no: "",
        expiry_date: "",
        reason: "Damage on Delivery (Barang rusak / bocor saat pengiriman)",
        custom_reason: "",
        note: "",
      },
    ]);
    setPhotoBase64(null);
    setPhotoSizeKb(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSubmittedData(null);
    setSubmittedTimestamp("");
    setIsSuccess(false);
    setErrorMessage("");
    setCopiedWaText(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-black shadow-xs shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black">
                  MBI & MAI
                </span>
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Layanan Pelanggan Apotek
                </span>
              </div>
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
              title="Salin tautan form ini untuk dibagikan ke WhatsApp"
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
          /* SUCCESS STATE WITH WHATSAPP COPY & SHARE */
          <div className="bg-white dark:bg-[#0c0c0e] border border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-3 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-[11px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Pengajuan Berhasil Disimpan
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-3">
              {submittedData?.products?.length || 1} Produk Retur Berhasil Dicatat!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mt-1.5 leading-relaxed">
              Data tiket komplain telah otomatis dicatat ke sistem logistik. Silakan kirim pesan ringkasan beserta foto bukti di bawah ke WhatsApp kami.
            </p>

            {/* Photo Thumbnail if uploaded */}
            {photoBase64 && (
              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={photoBase64}
                    alt="Bukti Retur"
                    className="w-14 h-14 object-cover rounded-lg border border-zinc-300 dark:border-zinc-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Foto Bukti Tersimpan ({photoSizeKb} KB)</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                      Foto bukti siap dikirim ke WhatsApp dan tersimpan di sistem kami.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPhoto}
                  className="px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs"
                  title="Unduh foto bukti ke galeri/komputer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Unduh Foto</span>
                </button>
              </div>
            )}

            {/* WhatsApp Ready Format Card */}
            <div className="mt-5 text-left bg-zinc-900 text-zinc-100 rounded-xl p-4 sm:p-5 font-mono text-xs sm:text-[13px] leading-relaxed shadow-md border border-zinc-700/80 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-zinc-700">
                <span className="font-sans font-bold text-xs text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>Format WhatsApp Siap Kirim</span>
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleShareToWhatsApp}
                    disabled={isSharing}
                    className="px-3.5 py-1.5 rounded-lg font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
                    title={photoBase64 ? "Kirim teks dan foto langsung ke WhatsApp" : "Buka WhatsApp"}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{photoBase64 ? "Kirim ke WA + Foto" : "Buka WA"}</span>
                  </button>
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
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Format</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {waNotification && (
                <div className="mb-3 p-2 bg-emerald-950/80 border border-emerald-700 rounded-lg text-emerald-300 text-xs font-sans animate-in fade-in flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>{waNotification}</span>
                </div>
              )}

              <pre className="whitespace-pre-wrap font-mono text-zinc-200 selection:bg-emerald-800">
                {getWaSummaryText()}
              </pre>

              {photoBase64 && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2 text-[11px] text-zinc-400 font-sans">
                  <span>Foto bukti tersimpan: <strong>{photoSizeKb} KB</strong></span>
                  <button
                    type="button"
                    onClick={handleDownloadPhoto}
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Unduh Foto</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto px-6 py-2.5 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ajukan Retur Lainnya</span>
              </button>
            </div>
          </div>
        ) : (
          /* FORM APOTEK (MULTI-PRODUCT + PHOTO UPLOAD) */
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
                  PBF (Distributor) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "MBI", label: "MBI (PT Medika Bina Investama)" },
                    { id: "MAI", label: "MAI (PT Medika Abadi Investama)" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setHeaderData({ ...headerData, pbf: p.id })}
                      className={`py-2.5 px-3 rounded-xl text-left border transition-all cursor-pointer ${
                        headerData.pbf === p.id
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

              {/* Apotek with Auto-suggestions */}
              <div className="relative">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Nama Apotek <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={headerData.customer_name}
                  onChange={(e) => {
                    setHeaderData({ ...headerData, customer_name: e.target.value });
                    setShowApotekSuggestions(true);
                  }}
                  onFocus={() => setShowApotekSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowApotekSuggestions(false), 250)}
                  placeholder="Ketik nama apotek atau merchant..."
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                />

                {/* Suggestions Dropdown */}
                {showApotekSuggestions && apotekSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto py-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      Saran dari Master Customer & Apotek ({apotekSuggestions.length})
                    </div>
                    {apotekSuggestions.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setHeaderData({ ...headerData, customer_name: cust.name });
                          setShowApotekSuggestions(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between transition-colors cursor-pointer border-b border-zinc-50 dark:border-zinc-800/40 last:border-b-0"
                      >
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {cust.name}
                        </span>
                        {cust.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono shrink-0 ml-2">
                            {cust.category}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* No. Invoice */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    No. Invoice (Faktur) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={headerData.invoice_no}
                    onChange={(e) => setHeaderData({ ...headerData, invoice_no: e.target.value })}
                    placeholder="Contoh: Inv-cfo-2610-20414"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                  />
                </div>

                {/* No. SO */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                    No. Sales Order (SO)
                  </label>
                  <input
                    type="text"
                    value={headerData.so_no}
                    onChange={(e) => setHeaderData({ ...headerData, so_no: e.target.value })}
                    placeholder="Contoh: So-5yen4y-5539 (opsional)"
                    className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: FOTO BUKTI RETUR (KAMERA / UPLOAD) */}
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Foto Bukti Retur / Kerusakan
                  </h2>
                </div>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Opsional tapi sangat dianjurkan
                </span>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
                id="return-photo-input"
              />

              {!photoBase64 ? (
                <label
                  htmlFor="return-photo-input"
                  className={`border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-900/40 text-center ${
                    isCompressingPhoto ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shadow-xs">
                    {isCompressingPhoto ? (
                      <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {isCompressingPhoto ? "Sedang Mengompres Foto..." : "Ambil Foto / Pilih dari Galeri"}
                    </span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Foto otomatis dikompres agar hemat kuota dan cepat terkirim
                    </p>
                  </div>
                </label>
              ) : (
                <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-3">
                  <img
                    src={photoBase64}
                    alt="Preview Bukti Retur"
                    className="w-16 h-16 object-cover rounded-lg border border-zinc-300 dark:border-zinc-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Foto Berhasil Diunggah</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Ukuran: {photoSizeKb} KB (Terkompres optimal)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    title="Hapus foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* CARD 3: DAFTAR PRODUK RETUR (MULTI-PRODUCT SUPPORT) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                    Daftar Produk Retur ({products.length} Item)
                  </h2>
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Dapat menambah lebih dari 1 produk
                </span>
              </div>

              {products.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 relative"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center text-[10px] font-bold">
                        {index + 1}
                      </span>
                      <span>Item #{index + 1}</span>
                    </span>

                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(item.id)}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>

                  {/* Nama Produk */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Nama Produk <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={item.product_name}
                      onChange={(e) => handleUpdateProduct(item.id, "product_name", e.target.value)}
                      placeholder="Contoh: Ceradan ceramide dominant skin barrier cream 80g"
                      className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>

                  {/* Kuantitas & Satuan */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                        Kuantitas <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.qty}
                        onChange={(e) => handleUpdateProduct(item.id, "qty", Number(e.target.value))}
                        className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                        Satuan
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) => handleUpdateProduct(item.id, "unit", e.target.value)}
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
                        Batch No. (Nomor Bets)
                      </label>
                      <input
                        type="text"
                        value={item.batch_no}
                        onChange={(e) => handleUpdateProduct(item.id, "batch_no", e.target.value)}
                        placeholder="Contoh: Bn-160603 (opsional)"
                        className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                        Expiry Date (ED)
                      </label>
                      <input
                        type="text"
                        value={item.expiry_date}
                        onChange={(e) => handleUpdateProduct(item.id, "expiry_date", e.target.value)}
                        placeholder="Contoh: 06/2028 atau MM/YYYY"
                        className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Alasan Retur (Reason) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={item.reason}
                      onChange={(e) => handleUpdateProduct(item.id, "reason", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-all cursor-pointer"
                    >
                      {COMMON_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>

                    {item.reason === "Lainnya" && (
                      <input
                        type="text"
                        required
                        value={item.custom_reason}
                        onChange={(e) => handleUpdateProduct(item.id, "custom_reason", e.target.value)}
                        placeholder="Tuliskan alasan retur lainnya..."
                        className="w-full mt-2 bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all"
                      />
                    )}
                  </div>

                  {/* Catatan Tambahan Per Item */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Catatan Tambahan Produk (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={item.note}
                      onChange={(e) => handleUpdateProduct(item.id, "note", e.target.value)}
                      placeholder="Keterangan spesifik kondisi produk ini..."
                      className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white transition-all resize-y"
                    />
                  </div>
                </div>
              ))}

              {/* Button: + Tambah Produk Lain */}
              <button
                type="button"
                onClick={handleAddProduct}
                className="w-full py-3 px-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 rounded-2xl text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-2 transition-all cursor-pointer bg-white/50 dark:bg-[#0c0c0e]/50 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <Plus className="w-4 h-4 text-emerald-500" />
                <span>+ Tambah Produk Lain Untuk Faktur Ini</span>
              </button>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isCompressingPhoto}
                className="w-full py-3.5 rounded-xl bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-sm font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan {products.length} Pengajuan Retur...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Pengajuan Retur ({products.length} Produk)</span>
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
