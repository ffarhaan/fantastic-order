"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  ReceiptText,
  RotateCcw,
  Building2,
  Pill,
  Keyboard,
  CheckCircle2,
  Layers,
  ExternalLink,
  Zap,
  Video,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  initialTab?: "quick" | "workspace" | "returns" | "apotek" | "produk" | "shortcuts";
  onAcknowledgeWorkflow?: () => void;
}

export default function HowToUseModal({
  isOpen,
  onClose,
  isDarkMode: propIsDarkMode,
  initialTab = "quick",
  onAcknowledgeWorkflow,
}: HowToUseModalProps) {
  const [activeTab, setActiveTab] = useState<
    "quick" | "workspace" | "returns" | "apotek" | "produk" | "shortcuts"
  >(initialTab);

  // Auto-detect theme from document if prop is undefined
  const [docDark, setDocDark] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setDocDark(document.documentElement.classList.contains("dark"));
    }
  }, [isOpen]);

  const isDark = propIsDarkMode !== undefined ? propIsDarkMode : docDark;

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors ${
          isDark
            ? "bg-[#0b1220] border-slate-700 text-slate-100 shadow-black/80"
            : "bg-white border-slate-200 text-slate-900 shadow-xl"
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isDark ? "bg-[#142038] border-slate-700" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-base font-extrabold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                <span>Panduan &amp; How to Use</span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                  isDark
                    ? "bg-blue-950 text-blue-300 border-blue-700"
                    : "bg-blue-100 text-blue-800 border-blue-200"
                }`}>
                  v2.0
                </span>
              </h2>
              <p className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Panduan praktis operasional sistem Fantastic Order untuk seluruh staf &amp; admin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors cursor-pointer ${
              isDark ? "text-slate-300 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
            }`}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`px-4 pt-3 border-b flex gap-1.5 overflow-x-auto scrollbar-none ${
            isDark ? "bg-[#080d17] border-slate-800" : "bg-slate-100 border-slate-200"
          }`}
        >
          {[
            { id: "quick", label: "Alur Utama", icon: Zap },
            { id: "workspace", label: "Daftar Faktur", icon: ReceiptText },
            { id: "returns", label: "Shipment Error", icon: RotateCcw },
            { id: "apotek", label: "Master Apotek", icon: Building2 },
            { id: "produk", label: "Master Produk", icon: Pill },
            { id: "shortcuts", label: "Shortcut Keyboard", icon: Keyboard },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? isDark
                      ? "bg-[#142038] text-blue-400 border-blue-500 shadow-sm"
                      : "bg-white text-blue-700 border-blue-600 shadow-sm"
                    : isDark
                    ? "text-slate-400 hover:text-white border-transparent hover:bg-slate-800/60"
                    : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? (isDark ? "text-blue-400" : "text-blue-600") : ""}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className={`flex-1 overflow-y-auto p-5 text-xs space-y-4 ${
          isDark ? "bg-[#0b1220]" : "bg-slate-50/50"
        }`}>
          {/* TAB 1: ALUR UTAMA (QUICK START) */}
          {activeTab === "quick" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-blue-950/40 border-blue-800/80 text-blue-200"
                  : "bg-blue-50 border-blue-200 text-blue-900"
              }`}>
                <h3 className={`font-extrabold text-sm mb-1 flex items-center gap-2 ${isDark ? "text-blue-300" : "text-blue-900"}`}>
                  <Zap className="w-4 h-4 text-blue-500" />
                  Alur Cepat Operasional Harian
                </h3>
                <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-blue-200/90" : "text-blue-950"}`}>
                  Fantastic Order dirancang untuk kecepatan operasional tinggi dengan sinkronisasi real-time antar laptop tanpa perlu me-refresh halaman web.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className={`p-4 rounded-xl border flex flex-col justify-between shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <div>
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs mb-2.5 shadow-xs">1</span>
                    <h4 className={`font-extrabold text-sm mb-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                      Pilih Gudang &amp; Upload
                    </h4>
                    <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      Pilih gudang aktif (<strong className={isDark ? "text-white font-bold" : "text-slate-900 font-bold"}>MBI</strong> atau <strong className={isDark ? "text-white font-bold" : "text-slate-900 font-bold"}>MAI</strong>) di pojok kiri atas. Unggah file <strong className={isDark ? "text-white font-bold" : "text-slate-900 font-bold"}>XXCUST</strong> resmi dari Oracle.
                    </p>
                  </div>
                  <div className={`mt-3 pt-2.5 border-t text-[11px] font-bold flex items-center gap-1.5 ${
                    isDark ? "border-slate-700 text-blue-400" : "border-slate-100 text-blue-700"
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                    Auto-deteksi entitas MBI/MAI
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <div>
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs mb-2.5 shadow-xs">2</span>
                    <h4 className={`font-extrabold text-sm mb-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                      Cetak &amp; Tandai Done
                    </h4>
                    <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      Semua faktur baru otomatis masuk tab <strong className={isDark ? "text-white font-bold" : "text-slate-900 font-bold"}>"Belum Terprint"</strong>. Saat fisik faktur selesai dicetak, klik tombol <strong className={isDark ? "text-white font-bold" : "text-slate-900 font-bold"}>"Done Print"</strong> (atau tekan spasi).
                    </p>
                  </div>
                  <div className={`mt-3 pt-2.5 border-t text-[11px] font-bold flex items-center gap-1.5 ${
                    isDark ? "border-slate-700 text-emerald-400" : "border-slate-100 text-emerald-700"
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Realtime sync &lt;50ms ke rekan
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <div>
                    <span className="w-7 h-7 rounded-full bg-amber-600 text-white font-extrabold flex items-center justify-center text-xs mb-2.5 shadow-xs">3</span>
                    <h4 className={`font-extrabold text-sm mb-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                      Kelola Shipment Error
                    </h4>
                    <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      Cek laporan kendala fisik atau retur. Klik nomor faktur untuk langsung mencari di Daftar Faktur secara instan tanpa reload!
                    </p>
                  </div>
                  <div className={`mt-3 pt-2.5 border-t text-[11px] font-bold flex items-center gap-1.5 ${
                    isDark ? "border-slate-700 text-amber-400" : "border-slate-100 text-amber-700"
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                    Keep-alive 0 detik tanpa loading
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DAFTAR FAKTUR */}
          {activeTab === "workspace" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Highlight Box: DOO vs ORA & Strict Key Isolation */}
              <div className={`p-4 rounded-xl border shadow-sm ${
                isDark ? "bg-[#142038] border-slate-700" : "bg-white border-blue-200 shadow-blue-50/50"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white">
                    LOCKED RULES #1
                  </span>
                  <h3 className={`font-extrabold text-sm flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                    <ReceiptText className="w-4 h-4 text-blue-500" />
                    Pemisahan Mutlak DOO vs ORA (Strict Key Isolation)
                  </h3>
                </div>
                <p className={`text-xs font-medium leading-relaxed mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Sistem Fantastic Order menerapkan <strong>aturan baku permanen</strong> yang membedakan transaksi reguler (DOO) dan transaksi konsorsium (ORA):
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className={`p-3 rounded-xl border ${
                    isDark ? "bg-[#0e1628] border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-blue-500">1. Transaksi DOO (Direct Order)</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded">
                        Contoh: 16180
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      <strong>Apa itu DOO?</strong> Faktur pesanan reguler untuk jaringan apotek umum &amp; swasta (Halomedika, Medika Prima, SBS, Pasti Hemat, K24, Kimia Farma, dll). Nomor invoice disimpan murni tanpa akhiran (contoh: <code>16180</code>).
                    </p>
                  </div>

                  <div className={`p-3 rounded-xl border ${
                    isDark ? "bg-[#0e1628] border-slate-800" : "bg-slate-200/80 border-slate-300"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-purple-500">2. Transaksi ORA (Konsorsium Helios)</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded">
                        Contoh: 16180-1P
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      <strong>Apa itu ORA?</strong> Transaksi jaringan konsorsium Helios (PT Helios Alchemist Kesehatan, IHC, awalan HAK, kode 1001, CA-900001). Di sistem, nomor faktur ORA <strong>WAJIB memiliki akhiran <code>-1P</code></strong> (contoh: <code>16180-1P</code>).
                    </p>
                  </div>
                </div>

                {/* Kenapa bisa sama & Bagaimana sistem membaca */}
                <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  isDark ? "bg-amber-950/20 border-amber-800/60 text-amber-200" : "bg-amber-50/80 border-amber-200 text-amber-950"
                }`}>
                  <h4 className="font-extrabold text-xs mb-1.5 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    ❓ Kenapa Ada Nomor Invoice yang Sama Persis &amp; Bagaimana Sistem Membacanya?
                  </h4>
                  <p className="mb-2">
                    Oracle menerbitkan nomor urut transaksi dari channel yang berbeda, sehingga <strong>nomor invoice DOO dan ORA bisa kebetulan sama persis (misal sama-sama 16180)</strong>. Namun keduanya adalah <strong>2 lembar berkas fisik faktur yang berbeda total</strong>.
                  </p>
                  <div className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 font-medium ${
                    isDark ? "bg-[#0b1220] border-amber-900/60" : "bg-white border-amber-200"
                  }`}>
                    <div className="font-bold text-amber-700 dark:text-amber-300">
                      🛡️ Sistem kami mengunci (LOCKED) mekanisme ini agar TIDAK TERJADI:
                    </div>
                    <ul className="list-disc list-inside space-y-1 pl-1">
                      <li>
                        <strong>Mencegah Salah Cetak (Cross-Check Collision):</strong> Jika operator mencentang <em>Done Print</em> pada DOO <code>16180</code>, faktur ORA <code>16180-1P</code> <strong>TIDAK AKAN IKUT TERCETAK</strong>. Status cetak keduanya 100% independen.
                      </li>
                      <li>
                        <strong>Mencegah Salah Kirim / Salah Ambil di Gudang:</strong> Operator gudang langsung tahu barang berlabel <code>-1P</code> adalah packingan khusus cabang Helios/ORA, bukan DOO biasa.
                      </li>
                      <li>
                        <strong>Mencegah Data Tertimpa (Anti-Downgrade / Non-Destructive):</strong> Saat file export harian diupload, No SO dan daftar rincian obat ORA dari file <code>XXCUST</code> tidak akan terhapus atau tertimpa oleh tanda strip (<code>-</code>).
                      </li>
                      <li>
                        <strong>Mencegah Faktur Baru Otomatis Tercentang (Anti-Stale Print Guard):</strong> Faktur baru dijamin 100% berstatus <em>Belum Terprint</em> dan tidak akan tercentang karena stempel cetak lampau.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Aturan Produk Dominan & Prioritas 1P/2P/3P */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className={`p-4 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <h4 className={`font-bold text-xs flex items-center gap-2 mb-2 ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                    <Pill className="w-4 h-4" />
                    Aturan Kategori Mayoritas Produk (Dominant Rule)
                  </h4>
                  <p className={`text-[11px] leading-relaxed mb-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Kategori header faktur (<strong>FARMA, ALKES, CCP, PREKURSOR, OOT</strong>) dihitung berdasarkan <strong>mayoritas item obat terbanyak</strong>:
                  </p>
                  <div className={`p-2.5 rounded-lg border text-[11px] ${
                    isDark ? "bg-[#0e1628] border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    Jika faktur memuat 15 obat Farma dan 1 alkohol (Alkes), sistem mencapnya sebagai <strong className="text-emerald-600 dark:text-emerald-400">FARMA</strong> (bukan Alkes sepihak). Urutan pemutus imbang: <code>CCP &gt; PREKURSOR &gt; OOT &gt; FARMA &gt; ALKES</code>.
                  </div>
                </div>

                <div className={`p-4 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <h4 className={`font-bold text-xs flex items-center gap-2 mb-2 ${isDark ? "text-blue-400" : "text-blue-700"}`}>
                    <Layers className="w-4 h-4" />
                    Kategori Prioritas 1P, 2P, dan 3P
                  </h4>
                  <ul className={`text-[11px] space-y-1.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    <li>
                      <strong className="text-rose-500 font-bold">1P (Prioritas Utama):</strong> ORA (Helios) &amp; Apotek Inti (Halomedika, Medika Prima, SBS, Pasti Hemat, Medika Akses).
                    </li>
                    <li>
                      <strong className="text-amber-500 font-bold">2P (Prioritas Menengah):</strong> Apotek prioritas 2 berdasarkan daftar resmi master site ID.
                    </li>
                    <li>
                      <strong className="text-slate-500 font-bold">3P (Reguler):</strong> Seluruh apotek langganan reguler lainnya.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Fitur Meja Kerja Faktur */}
              <div className={`p-4 rounded-xl border shadow-xs ${
                isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
              }`}>
                <h4 className={`font-bold text-xs mb-2.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Fitur Tambahan di Meja Kerja Faktur:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className={`p-2.5 rounded-lg border ${isDark ? "bg-[#0e1628] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                    <strong className={isDark ? "text-white" : "text-slate-900"}>Top Bar Filter 9 Metrik:</strong> Klik kartu Belum Terprint, Farma, Alkes, CCP, Prekursor, OOT, Retur, atau Double SO untuk memfilter seketika.
                  </div>
                  <div className={`p-2.5 rounded-lg border ${isDark ? "bg-[#0e1628] border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                    <strong className={isDark ? "text-white" : "text-slate-900"}>Basis Tanggal Fleksibel:</strong> Pilih antara <em>Tanggal Transaksi</em> (waktu gudang) atau <em>Tanggal Order/Faktur</em> via filter tanggal.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHIPMENT ERROR */}
          {activeTab === "returns" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Header Box */}
              <div className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-amber-950/30 border-amber-800/80 text-amber-200"
                  : "bg-amber-50 border-amber-200 text-amber-950"
              }`}>
                <h3 className={`font-extrabold text-sm mb-1 flex items-center gap-2 ${isDark ? "text-amber-300" : "text-amber-900"}`}>
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  Alur Operasional Baku &amp; SOP Modul Shipment Error
                </h3>
                <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-amber-200/90" : "text-amber-900"}`}>
                  Setiap komplain barang (selisih koli, barang rusak, fisik kurang, salah barang, ED dekat) wajib melalui 4 tahapan baku dan investigasi gudang untuk menjamin akurasi dan ketuntasan pengiriman fisik ke apotek.
                </p>
              </div>

              {/* FITUR BARU: Kolom Eksekusi Cepat di Paling Kiri & Performa Instan */}
              <div className={`p-3.5 rounded-xl border shadow-xs ${
                isDark ? "bg-[#142038] border-indigo-700/60" : "bg-indigo-50/70 border-indigo-200"
              }`}>
                <h4 className="font-extrabold text-xs mb-1.5 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Zap className="w-4 h-4 text-indigo-500" />
                  Fitur Baru: Kolom Eksekusi Cepat (Kolom 1: ACC / Selesai) &amp; Performa Kilat (&lt;1ms)
                </h4>
                <p className={`text-xs leading-relaxed mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Tabel dirancang 100% pas di layar laptop tanpa perlu scroll ke kanan atau scroll ke bawah form. Seluruh aksi bekerja instan (&lt;1ms) di memori identik dengan kecepatan Meja Kerja Faktur:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className={`p-2.5 rounded-lg border ${isDark ? "bg-[#0b1220] border-slate-700" : "bg-white border-indigo-100"}`}>
                    <strong className="text-blue-600 dark:text-blue-400 block mb-0.5">Tombol [ ✓ ACC ] (Biru):</strong>
                    Untuk tiket <em>Pending</em>. Klik langsung di baris tabel untuk memvalidasi kesalahan operasional PBF dan memindahkan tiket ke <em>In Progress</em> sesuai klasifikasi jenis pengerjaannya.
                  </div>
                  <div className={`p-2.5 rounded-lg border ${isDark ? "bg-[#0b1220] border-slate-700" : "bg-white border-indigo-100"}`}>
                    <strong className="text-emerald-600 dark:text-emerald-400 block mb-0.5">Tombol [ ✓ Selesaikan ] (Hijau):</strong>
                    Untuk tiket <em>In Progress</em>. Sistem secara otomatis memvalidasi kelengkapan data investigasi gudang sebelum mengonfirmasi penerimaan fisik barang di apotek.
                  </div>
                </div>
              </div>

              {/* 4 Tahapan Workflow Baku */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. PENDING */}
                <div className={`p-3.5 rounded-xl border shadow-xs space-y-2 ${
                  isDark ? "bg-[#142038] border-amber-800/60" : "bg-white border-amber-200"
                }`}>
                  <div className="flex items-center justify-between border-b border-amber-200/50 dark:border-amber-900/50 pb-2">
                    <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      1. TAHAP PENDING (Pengecekan Komplain Baru)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Tahap Awal
                    </span>
                  </div>
                  <ul className="text-xs space-y-1.5 leading-relaxed text-zinc-700 dark:text-slate-300 list-disc list-inside">
                    <li>Setiap tiket baru yang dikirim dari form apotek/sales otomatis masuk antrean <strong>Pending</strong>.</li>
                    <li>Admin/CS memeriksa rincian kendala beserta foto bukti komplain, video unboxing apotek, dan foto packing tim gudang.</li>
                    <li>Eksekusi cepat via kolom 1 atau tombol Tindakan:
                      <div className="mt-1 pl-4 space-y-1">
                        <div className="text-blue-600 dark:text-blue-400 font-bold">
                          • Klik [ ACC ]: Komplain dinyatakan Valid (Kesalahan PBF). Tiket otomatis dialokasikan ke jenis <strong>In Progress (Operasional)</strong> atau <strong>In Progress (Klaim &amp; Retur)</strong>.
                        </div>
                        <div className="text-rose-600 dark:text-rose-400 font-bold">
                          • Reject: Bukan kesalahan gudang. Tim PBF wajib mengisi alasan penolakan dan lampiran bukti (CCTV/packing list) jika ada.
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* 2. IN PROGRESS */}
                <div className={`p-3.5 rounded-xl border shadow-xs space-y-2 ${
                  isDark ? "bg-[#142038] border-blue-800/60" : "bg-white border-blue-200"
                }`}>
                  <div className="flex items-center justify-between border-b border-blue-200/50 dark:border-blue-900/50 pb-2">
                    <span className="font-extrabold text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      2. TAHAP IN PROGRESS (2 Alur Terpisah &amp; Personil)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      2 Jalur Khusus
                    </span>
                  </div>
                  <ul className="text-xs space-y-1.5 leading-relaxed text-zinc-700 dark:text-slate-300 list-disc list-inside">
                    <li><strong className="text-blue-500 dark:text-blue-400">Jalur 1: In Progress (Operasional):</strong>
                      <div className="mt-0.5 pl-4 space-y-0.5 font-medium text-[11px]">
                        <div>• Khusus 4 kelalaian fisik gudang: <em>Fisik kurang, lebih, salah kirim, tidak ada</em>.</div>
                        <div>• Barang pengganti disiapkan dan diantar oleh driver ke apotek pemesan.</div>
                        <div>• <strong>Wajib Mengisi 3 Data Lengkap:</strong> (1) Tindakan Solusi, (2) Akar Penyebab, dan (3) <strong>Personil Terkait (Picker / Checker Wajib)</strong>.</div>
                      </div>
                    </li>
                    <li><strong className="text-cyan-600 dark:text-cyan-400">Jalur 2: In Progress (Klaim &amp; Retur):</strong>
                      <div className="mt-0.5 pl-4 space-y-0.5 font-medium text-[11px]">
                        <div>• Khusus kendala kondisi &amp; administrasi: <em>Damage on delivery (pecah/bocor), ED dekat, Recall pabrik, Retur admin salah SKU apotek</em>.</div>
                        <div>• <strong className="text-amber-500 dark:text-amber-400">Aturan Khusus Personil:</strong> Nama personil <strong>TIDAK WAJIB (opsional / boleh dikosongkan)</strong> untuk diselesaikan, karena kerusakan dari pabrik/ekspedisi atau administrasi faktur bukan kelalaian personil picking/checking.</div>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* 3. RESOLVED */}
                <div className={`p-3.5 rounded-xl border shadow-xs space-y-2 ${
                  isDark ? "bg-[#142038] border-emerald-800/60" : "bg-white border-emerald-200"
                }`}>
                  <div className="flex items-center justify-between border-b border-emerald-200/50 dark:border-emerald-900/50 pb-2">
                    <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      3. TAHAP RESOLVED (Selesai Diterima Apotek)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Tuntas 100%
                    </span>
                  </div>
                  <ul className="text-xs space-y-1.5 leading-relaxed text-zinc-700 dark:text-slate-300 list-disc list-inside">
                    <li>Klik tombol hijau <strong>"Selesaikan"</strong> pada kolom 1 atau kartu In Progress.</li>
                    <li>Sistem memvalidasi kelengkapan data investigasi:
                      <div className="mt-1 pl-4 space-y-0.5 text-[11px] font-medium">
                        <div>• <strong>Jenis Operasional:</strong> Wajib 3 data lengkap (Tindakan, Penyebab, dan Personil).</div>
                        <div>• <strong>Jenis Klaim &amp; Retur:</strong> Cukup mengisi Tindakan &amp; Penyebab (Personil boleh kosong).</div>
                      </div>
                    </li>
                    <li>Sistem memunculkan konfirmasi kepastian fisik:
                      <div className="p-2 mt-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium">
                        <em>"Apakah barang pengganti ini sudah benar-benar sampai dan diterima dengan baik oleh pihak apotek?"</em>
                      </div>
                    </li>
                    <li>Saat dikonfirmasi, tanggal selesai terisi otomatis dan tiket berstatus tuntas 100%.</li>
                  </ul>
                </div>

                {/* 4. REJECTED */}
                <div className={`p-3.5 rounded-xl border shadow-xs space-y-2 ${
                  isDark ? "bg-[#142038] border-rose-800/60" : "bg-white border-rose-200"
                }`}>
                  <div className="flex items-center justify-between border-b border-rose-200/50 dark:border-rose-900/50 pb-2">
                    <span className="font-extrabold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      4. TAHAP REJECTED (Tiket Ditolak &amp; Transparansi ke Apotek)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      Bukan Kesalahan PBF
                    </span>
                  </div>
                  <ul className="text-xs space-y-1.5 leading-relaxed text-zinc-700 dark:text-slate-300 list-disc list-inside">
                    <li>Dipilih jika hasil pengecekan membuktikan bukan kesalahan gudang (salah pesan sales/apotek, klaim fiktif, dll).</li>
                    <li><strong className="text-rose-600 dark:text-rose-400">Wajib Mengisi Alasan:</strong> Kolom catatan alasan penolakan wajib diisi secara jelas dan profesional.</li>
                    <li><strong>Lampiran Bukti PBF (Opsional):</strong> Dapat melampirkan link foto/CCTV gudang atau resi packing timbangan.</li>
                    <li>Alasan penolakan beserta bukti otomatis tampil di <strong>link pelacak komplain publik</strong> agar pihak apotek memahami dasar penolakan secara transparan tanpa sengketa.</li>
                  </ul>
                </div>
              </div>

              {/* FITUR BARU: DIRECT VIDEO UNBOXING & DRILL-DOWN ANALISIS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3.5 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-blue-900/60" : "bg-blue-50/60 border-blue-200"
                }`}>
                  <h4 className="font-extrabold text-xs mb-1.5 flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Video className="w-4 h-4 text-blue-500" />
                    Direct Video Unboxing Apotek (Max 10 Menit)
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Apotek dapat mengunggah video unboxing hingga <strong>10 menit (600 detik)</strong> langsung dari link form komplain. Video diunggah langsung ke Cloud Storage tanpa membebani server backend (0% beban server). Tim PBF dapat langsung memutar video unboxing dengan tombol <strong>"Putar Video"</strong> di tabel.
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-emerald-900/60" : "bg-emerald-50/60 border-emerald-200"
                }`}>
                  <h4 className="font-extrabold text-xs mb-1.5 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                    Interactive Drill-Down Tab Analisis (Data Kasus Riil)
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Pada tab <strong>Analisis</strong>, klik langsung kategori kendala pada daftar atau irisan <em>Donut Chart</em>. Sistem akan membuka popup modal yang menampilkan <strong>100% data kasus asli database TiDB</strong> yang mendasari grafik, lengkap dengan pencarian dan tombol <strong>"Ekspor XLSX"</strong> untuk unduh audit Excel.
                  </p>
                </div>
              </div>

              {/* PANDUAN FILTER BULAN & RETENSI DATA */}
              <div className={`p-3.5 rounded-xl border shadow-xs ${
                isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
              }`}>
                <h4 className={`font-bold text-xs flex items-center gap-1.5 mb-1.5 ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                  📌 Catatan Penting: Filter Bulan &amp; Riwayat Data Lengkap
                </h4>
                <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Database menyimpan 100% data komplain dari awal tahun hingga sekarang secara permanen (1.800+ kasus). Jika pada tabel jumlah kasus terlihat lebih sedikit, periksa dropdown <strong>"Bulan"</strong> pada filter bar di atas tabel:
                  pilih <strong>"Semua Bulan (Jan - Des 2026)"</strong> untuk menampilkan seluruh data riwayat, atau pilih bulan tertentu (misal <em>November 2026</em>) untuk fokus pada operasional bulan berjalan.
                </p>
              </div>

              {/* Fitur Interaktif Tambahan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3.5 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <h4 className={`font-bold text-xs flex items-center gap-1.5 mb-1.5 ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                    <ExternalLink className="w-4 h-4" />
                    Link Cepat Nomor Faktur (Keep-Alive)
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-200" : "text-slate-600"}`}>
                    Klik langsung nomor invoice pada tabel (contoh: <code>#16180 ↗</code>) untuk langsung berpindah ke tab <strong>Daftar Faktur</strong> dan otomatis memfilter faktur tersebut tanpa perlu reload halaman.
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <h4 className={`font-bold text-xs flex items-center gap-1.5 mb-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    Interaktivitas 4 Kartu Status
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-200" : "text-slate-600"}`}>
                    Klik kartu status di baris atas (Pending, In Progress, Resolved, Rejected) untuk memfilter antrean tabel seketika. Klik sekali lagi pada kartu yang sedang aktif untuk me-reset filter kembali ke "Semua Status".
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MASTER APOTEK */}
          {activeTab === "apotek" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border shadow-xs ${
                isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
              }`}>
                <h3 className={`font-extrabold text-sm mb-2.5 flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  Klasifikasi Master Apotek MBI vs MAI (Terpisah 100%)
                </h3>
                <p className={`text-xs font-medium leading-relaxed mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Sesuai aturan baku, master apotek dan klasifikasi 2P / 3P antara <strong className={isDark ? "text-white font-bold" : "text-slate-900 font-bold"}>MBI</strong> dan <strong className={isDark ? "text-white font-bold" : "text-slate-900 font-bold"}>MAI</strong> diisolasi secara mandiri:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-3.5 rounded-lg border shadow-xs ${
                    isDark ? "bg-[#0e1628] border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <span className="font-extrabold text-xs text-blue-500 block mb-1.5">🏭 Master Apotek MBI</span>
                    <ul className={`text-xs space-y-1 font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      <li>• 2.697 apotek terdaftar khusus entitas MBI.</li>
                      <li>• Memuat kode customer Oracle (CA-xxxx).</li>
                      <li>• Klasifikasi 2P berdasarkan master MBI.</li>
                    </ul>
                  </div>

                  <div className={`p-3.5 rounded-lg border shadow-xs ${
                    isDark ? "bg-[#0e1628] border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <span className="font-extrabold text-xs text-purple-500 block mb-1.5">🏢 Master Apotek MAI</span>
                    <ul className={`text-xs space-y-1 font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      <li>• 4.520 apotek terdaftar khusus entitas MAI.</li>
                      <li>• Memuat data wilayah (DK / LK) dan alamat izin.</li>
                      <li>• Klasifikasi 2P &amp; 3P mandiri dari tab MASTER MAI.</li>
                    </ul>
                  </div>
                </div>

                <div className={`mt-3.5 p-3 rounded-lg border text-xs font-medium ${
                  isDark ? "bg-blue-950/40 border-blue-800 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-900"
                }`}>
                  <strong className="font-bold">Catatan Kategori 1P:</strong> Kategori 1P berlaku sama di MBI dan MAI untuk transaksi ORA / Konsorsium Helios (HAK, IHC, HELIOS) dan jaringan 1P utama (Halomedika, Medika Prima, SBS, Pasti Hemat, Medika Akses).
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MASTER PRODUK */}
          {activeTab === "produk" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border shadow-xs ${
                isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
              }`}>
                <h3 className={`font-extrabold text-sm mb-2.5 flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  <Pill className="w-4 h-4 text-emerald-500" />
                  Aturan Kategori Produk Dominan (Majority Rule)
                </h3>
                <p className={`text-xs font-medium leading-relaxed mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Kategori produk pada header faktur ditentukan berdasarkan <strong className={isDark ? "text-white" : "text-slate-900"}>kategori mayoritas terbanyak</strong> dari seluruh rincian item barang di dalam faktur tersebut:
                </p>

                <div className="space-y-2.5 text-xs font-medium">
                  <div className={`p-3 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    <strong className={isDark ? "text-emerald-400 font-bold" : "text-emerald-700 font-bold"}>Contoh Kasus:</strong> Jika sebuah faktur memuat 10 item obat FARMA dan 1 item ALKES, faktur tersebut tetap diklasifikasikan sebagai <strong>FARMA</strong> (mayoritas), bukan ALKES sepihak.
                  </div>
                  <div className={`p-3 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    <strong className={isDark ? "text-amber-400 font-bold" : "text-amber-700 font-bold"}>Prioritas Khusus (Tie-Breaker):</strong> Jika jumlah item seimbang, urutan prioritas ketat adalah: <code className={`font-bold px-1.5 py-0.5 rounded border ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-100 border-slate-300 text-slate-800"
                    }`}>CCP &gt; PREKURSOR &gt; OOT &gt; FARMA &gt; ALKES</code>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SHORTCUTS KEYBOARD */}
          {activeTab === "shortcuts" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border shadow-xs ${
                isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
              }`}>
                <h3 className={`font-extrabold text-sm mb-2.5 flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  <Keyboard className="w-4 h-4 text-indigo-500" />
                  Pintasan Tombol Cepat (Keyboard Shortcuts)
                </h3>
                <p className={`text-xs font-medium mb-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Gunakan tombol keyboard untuk mempercepat proses verifikasi dan pencetakan tanpa menyentuh mouse:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    <span className="font-medium">Fokus ke Pencarian</span>
                    <kbd className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                      isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900 shadow-xs"
                    }`}>/</kbd>
                  </div>
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    <span className="font-medium">Beralih Halaman Tabel</span>
                    <span className="flex gap-1">
                      <kbd className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900 shadow-xs"
                      }`}>←</kbd>
                      <kbd className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900 shadow-xs"
                      }`}>→</kbd>
                    </span>
                  </div>
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    <span className="font-medium">Salin No. Faktur Terpilih</span>
                    <kbd className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                      isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900 shadow-xs"
                    }`}>Ctrl + C</kbd>
                  </div>
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    <span className="font-medium">Tutup Modal / Popup</span>
                    <kbd className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                      isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900 shadow-xs"
                    }`}>Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
            isDark ? "bg-[#142038] border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700 font-medium"
          }`}
        >
          <span className="text-[11px] text-zinc-500 dark:text-slate-400">
            Sistem Fantastic Order · PT Medikabina Investama &amp; PT Medika Akses Investama
          </span>
          <div className="flex items-center gap-2">
            {activeTab === "returns" && (
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem("has_seen_shipment_workflow_v2", "true");
                  } catch {}
                  if (onAcknowledgeWorkflow) onAcknowledgeWorkflow();
                  onClose();
                }}
                className="px-4 py-1.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Paham, Mulai Bekerja ✓</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-1.5 rounded-xl font-bold transition-all shadow-xs cursor-pointer ${
                isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700" : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-300"
              }`}
            >
              Tutup Panduan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
