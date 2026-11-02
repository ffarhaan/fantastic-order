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
} from "lucide-react";

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  initialTab?: "quick" | "workspace" | "returns" | "apotek" | "produk" | "shortcuts";
}

export default function HowToUseModal({
  isOpen,
  onClose,
  isDarkMode: propIsDarkMode,
  initialTab = "quick",
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
              <div className={`p-4 rounded-xl border shadow-xs ${
                isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
              }`}>
                <h3 className={`font-extrabold text-sm mb-2.5 flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  <ReceiptText className="w-4 h-4 text-blue-500" />
                  Fitur Inti Meja Kerja Daftar Faktur
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li className={`flex items-start gap-2.5 p-2 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}>
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                    <span className="leading-relaxed">
                      <strong className={isDark ? "text-white" : "text-slate-900"}>Filter Cepat (Top Bar 9 Metrik):</strong> Klik kotak <em>Belum Terprint</em>, <em>FARMA</em>, <em>ALKES</em>, <em>PREKURSOR</em>, <em>OOT</em>, <em>CCP</em>, <em>Double SO</em>, atau <em>Retur</em> untuk memfilter tabel dalam 1 kali klik.
                    </span>
                  </li>
                  <li className={`flex items-start gap-2.5 p-2 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}>
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                    <span className="leading-relaxed">
                      <strong className={isDark ? "text-white" : "text-slate-900"}>Basis Tanggal Dinamis:</strong> Anda bisa memilih basis tanggal antara <strong>Tanggal Transaksi</strong> (kapan barang diproses) atau <strong>Tanggal Order / Faktur</strong> via dropdown filter tanggal.
                    </span>
                  </li>
                  <li className={`flex items-start gap-2.5 p-2 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}>
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                    <span className="leading-relaxed">
                      <strong className={isDark ? "text-white" : "text-slate-900"}>Cari Serbaguna:</strong> Ketik nomor invoice, nomor SO, nama apotek, nama obat/item, atau nama checker di kotak pencarian.
                    </span>
                  </li>
                  <li className={`flex items-start gap-2.5 p-2 rounded-lg border ${
                    isDark ? "bg-[#0e1628] border-slate-800 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}>
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
                    <span className="leading-relaxed">
                      <strong className={isDark ? "text-white" : "text-slate-900"}>Done Print &amp; Batal Cetak:</strong> Klik tombol hijau <em>Done Print</em> saat faktur sudah keluar dari printer. Jika ada kesalahan, klik ikon batal cetak (hanya staf yang memiliki hak akses).
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: SHIPMENT ERROR */}
          {activeTab === "returns" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-amber-950/30 border-amber-800/80 text-amber-200"
                  : "bg-amber-50 border-amber-200 text-amber-950"
              }`}>
                <h3 className={`font-extrabold text-sm mb-1 flex items-center gap-2 ${isDark ? "text-amber-300" : "text-amber-900"}`}>
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  Alur &amp; Fitur Khusus Shipment Error
                </h3>
                <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-amber-200/90" : "text-amber-900"}`}>
                  Modul ini digunakan untuk memantau selisih pengiriman, barang rusak, fisik kurang, dan proses retur barang logistik.
                </p>
              </div>

              <div className="space-y-3">
                <div className={`p-3.5 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <h4 className={`font-bold text-xs flex items-center gap-1.5 mb-1.5 ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                    <ExternalLink className="w-4 h-4" />
                    Loncat ke Faktur Tanpa Loading (Keep-Alive)
                  </h4>
                  <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Setiap baris nomor invoice (contoh: <code className={`font-bold px-1.5 py-0.5 rounded border ${
                      isDark ? "bg-blue-950 border-blue-800 text-blue-300" : "bg-blue-100 border-blue-200 text-blue-800"
                    }`}>16180 ↗</code>) dapat diklik langsung. Sistem akan otomatis membuka <strong className={isDark ? "text-white" : "text-slate-900"}>Daftar Faktur</strong> dan mencari invoice tersebut. Saat Anda kembali ke tab <strong className={isDark ? "text-white" : "text-slate-900"}>Shipment Error</strong>, data Anda <strong className={isDark ? "text-emerald-400" : "text-emerald-700"}>langsung tampil instan tanpa loading lagi</strong> dan posisi tabel tetap tersimpan.
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <h4 className={`font-bold text-xs flex items-center gap-1.5 mb-1.5 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    Filter Minggu (W-Week) &amp; Status
                  </h4>
                  <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Gunakan filter Week (contoh: <code className={`font-bold px-1.5 py-0.5 rounded border ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-100 border-slate-300 text-slate-800"
                    }`}>W44</code>, <code className={`font-bold px-1.5 py-0.5 rounded border ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-100 border-slate-300 text-slate-800"
                    }`}>W43</code>) untuk melihat laporan performa mingguan. Status kasus terbagi menjadi:
                    <strong className={isDark ? "text-amber-400 font-bold" : "text-amber-700 font-bold"}> Pending</strong> (menunggu approval), <strong className={isDark ? "text-blue-400 font-bold" : "text-blue-700 font-bold"}> In Progress</strong> (sedang diproses tim gudang), <strong className={isDark ? "text-emerald-400 font-bold" : "text-emerald-700 font-bold"}> Resolved</strong> (selesai/nota retur keluar), dan <strong className={isDark ? "text-rose-400 font-bold" : "text-rose-700 font-bold"}> Reject</strong> (ditolak).
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-xs ${
                  isDark ? "bg-[#142038] border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <h4 className={`font-bold text-xs flex items-center gap-1.5 mb-1.5 ${isDark ? "text-purple-300" : "text-purple-700"}`}>
                    <Layers className="w-4 h-4" />
                    Freeze Column &amp; Kustom Tampilan
                  </h4>
                  <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    Gunakan tombol <strong className={isDark ? "text-white" : "text-slate-900"}>Pin Kolom</strong> untuk membekukan 1, 2, atau 3 kolom utama agar tetap terlihat saat menggeser tabel ke kanan, mirip fitur Freeze Panes di Microsoft Excel.
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
          className={`px-5 py-3 border-t flex items-center justify-between text-xs ${
            isDark ? "bg-[#142038] border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700 font-medium"
          }`}
        >
          <span className="text-[11px]">
            Sistem Fantastic Order · PT Medikabina Investama &amp; PT Medika Akses Investama
          </span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl font-bold text-white transition-all shadow-xs cursor-pointer ${
              isDark ? "bg-blue-600 hover:bg-blue-500" : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
