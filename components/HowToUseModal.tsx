"use client";

import { useState } from "react";
import {
  BookOpen,
  ReceiptText,
  RotateCcw,
  Building2,
  Pill,
  Keyboard,
  CheckCircle2,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
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
  isDarkMode,
  initialTab = "quick",
}: HowToUseModalProps) {
  const [activeTab, setActiveTab] = useState<
    "quick" | "workspace" | "returns" | "apotek" | "produk" | "shortcuts"
  >(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors ${
          isDarkMode
            ? "bg-[#0c1222] border-slate-700/80 text-slate-100 shadow-black/70"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                <span>Panduan &amp; How to Use</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  v2.0
                </span>
              </h2>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Panduan praktis operasional sistem Fantastic Order untuk seluruh staf &amp; admin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors ${
              isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200"
            }`}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`px-4 pt-3 border-b flex gap-1.5 overflow-x-auto scrollbar-none ${
            isDarkMode ? "bg-[#090d18] border-slate-800" : "bg-slate-100/70 border-slate-200"
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? isDarkMode
                      ? "bg-[#131d36] text-blue-400 border-blue-500"
                      : "bg-white text-blue-700 border-blue-600 shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40"
                    : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
          {/* TAB 1: ALUR UTAMA (QUICK START) */}
          {activeTab === "quick" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? "bg-blue-950/30 border-blue-800/50 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-900"
              }`}>
                <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  Alur Cepat Operasional Harian
                </h3>
                <p className="text-[11px] leading-relaxed">
                  Fantastic Order dirancang untuk kecepatan operasional tinggi dengan sinkronisasi real-time antar laptop tanpa perlu me-refresh halaman web.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
                }`}>
                  <div>
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">1</span>
                    <h4 className="font-bold text-sm text-slate-100 dark:text-white mb-1">Pilih Gudang &amp; Upload</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Pilih gudang aktif (<strong>MBI</strong> atau <strong>MAI</strong>) di pojok kiri atas. Unggah file <strong>XXCUST</strong> resmi dari Oracle.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] text-blue-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    Auto-deteksi entitas MBI/MAI
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
                }`}>
                  <div>
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs mb-2">2</span>
                    <h4 className="font-bold text-sm text-slate-100 dark:text-white mb-1">Cetak &amp; Tandai Done</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Semua faktur baru otomatis masuk tab <strong>"Belum Terprint"</strong>. Saat fisik faktur selesai dicetak, klik tombol <strong>"Done Print"</strong> (atau tekan spasi).
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Realtime sync &lt;50ms ke rekan
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
                }`}>
                  <div>
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs mb-2">3</span>
                    <h4 className="font-bold text-sm text-slate-100 dark:text-white mb-1">Kelola Shipment Error</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Cek laporan kendala fisik atau retur. Klik nomor faktur untuk langsung mencari di Daftar Faktur secara instan tanpa reload!
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    Keep-alive 0 detik tanpa loading
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DAFTAR FAKTUR */}
          {activeTab === "workspace" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
              }`}>
                <h3 className="font-bold text-sm text-slate-100 dark:text-white mb-2 flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-blue-500" />
                  Fitur Inti Meja Kerja Daftar Faktur
                </h3>
                <ul className="space-y-2 text-[11px] text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">1.</span>
                    <span>
                      <strong>Filter Cepat (Top Bar 9 Metrik):</strong> Klik kotak <em>Belum Terprint</em>, <em>FARMA</em>, <em>ALKES</em>, <em>PREKURSOR</em>, <em>OOT</em>, <em>CCP</em>, <em>Double SO</em>, atau <em>Retur</em> untuk memfilter tabel dalam 1 kali klik.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">2.</span>
                    <span>
                      <strong>Basis Tanggal Dinamis:</strong> Anda bisa memilih basis tanggal antara <strong>Tanggal Transaksi</strong> (kapan barang diproses) atau <strong>Tanggal Order / Faktur</strong> via dropdown filter tanggal.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">3.</span>
                    <span>
                      <strong>Cari Serbaguna:</strong> Ketik nomor invoice, nomor SO, nama apotek, nama obat/item, atau nama checker di kotak pencarian.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">4.</span>
                    <span>
                      <strong>Done Print &amp; Batal Cetak:</strong> Klik tombol hijau <em>Done Print</em> saat faktur sudah keluar dari printer. Jika ada kesalahan, klik ikon batal cetak (hanya admin/operator berwenang).
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
                isDarkMode ? "bg-amber-950/20 border-amber-800/40 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-900"
              }`}>
                <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  Alur &amp; Fitur Khusus Shipment Error
                </h3>
                <p className="text-[11px] leading-relaxed">
                  Modul ini digunakan untuk memantau selisih pengiriman, barang rusak, fisik kurang, dan proses retur barang logistik.
                </p>
              </div>

              <div className="space-y-3">
                <div className={`p-3.5 rounded-xl border ${
                  isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
                }`}>
                  <h4 className="font-bold text-xs text-blue-400 flex items-center gap-1.5 mb-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Loncat ke Faktur Tanpa Loading (Keep-Alive)
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Setiap baris nomor invoice (contoh: <code>16180 ↗</code>) dapat diklik langsung. Sistem akan otomatis membuka <strong>Daftar Faktur</strong> dan mencari invoice tersebut. Saat Anda kembali ke tab <strong>Shipment Error</strong>, data Anda <strong>langsung tampil instan tanpa loading lagi</strong> dan posisi tabel tetap tersimpan.
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
                }`}>
                  <h4 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Filter Minggu (W-Week) &amp; Status
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Gunakan filter Week (contoh: <code>W44</code>, <code>W43</code>) untuk melihat laporan performa mingguan. Status kasus terbagi menjadi:
                    <strong>Pending</strong> (menunggu approval), <strong>In Progress</strong> (sedang diproses tim gudang), <strong>Resolved</strong> (selesai/nota retur keluar), dan <strong>Reject</strong> (ditolak).
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
                }`}>
                  <h4 className="font-bold text-xs text-purple-400 flex items-center gap-1.5 mb-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Freeze Column &amp; Kustom Tampilan
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Gunakan tombol <strong>Pin Kolom</strong> untuk membekukan 1, 2, atau 3 kolom utama agar tetap terlihat saat menggeser tabel ke kanan, mirip fitur Freeze Panes di Microsoft Excel.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MASTER APOTEK */}
          {activeTab === "apotek" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
              }`}>
                <h3 className="font-bold text-sm text-slate-100 dark:text-white mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  Klasifikasi Master Apotek MBI vs MAI (Terpisah 100%)
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                  Sesuai aturan baku, master apotek dan klasifikasi 2P / 3P antara <strong>MBI</strong> dan <strong>MAI</strong> diisolasi secara mandiri:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg border ${
                    isDarkMode ? "bg-[#090d18] border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <span className="font-bold text-xs text-blue-400 block mb-1">🏭 Master Apotek MBI</span>
                    <ul className="text-[11px] text-slate-400 space-y-1">
                      <li>• 2.697 apotek terdaftar khusus entitas MBI.</li>
                      <li>• Memuat kode customer Oracle (CA-xxxx).</li>
                      <li>• Klasifikasi 2P berdasarkan master MBI.</li>
                    </ul>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    isDarkMode ? "bg-[#090d18] border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <span className="font-bold text-xs text-purple-400 block mb-1">🏢 Master Apotek MAI</span>
                    <ul className="text-[11px] text-slate-400 space-y-1">
                      <li>• 4.520 apotek terdaftar khusus entitas MAI.</li>
                      <li>• Memuat data wilayah (DK / LK) dan alamat izin.</li>
                      <li>• Klasifikasi 2P &amp; 3P mandiri dari tab MASTER MAI.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                  <strong>Catatan Kategori 1P:</strong> Kategori 1P berlaku sama di MBI dan MAI untuk transaksi ORA / Konsorsium Helios (HAK, IHC, HELIOS) dan jaringan 1P utama (Halomedika, Medika Prima, SBS, Pasti Hemat, Medika Akses).
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MASTER PRODUK */}
          {activeTab === "produk" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
              }`}>
                <h3 className="font-bold text-sm text-slate-100 dark:text-white mb-2 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-400" />
                  Aturan Kategori Produk Dominan (Majority Rule)
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                  Kategori produk pada header faktur ditentukan berdasarkan <strong>kategori mayoritas terbanyak</strong> dari seluruh rincian item barang di dalam faktur tersebut:
                </p>

                <div className="space-y-2 text-[11px] text-slate-300">
                  <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <strong>Contoh Kasus:</strong> Jika sebuah faktur memuat 10 item obat FARMA dan 1 item ALKES, faktur tersebut tetap diklasifikasikan sebagai <strong>FARMA</strong> (mayoritas), bukan ALKES sepihak.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <strong>Prioritas Khusus (Tie-Breaker):</strong> Jika jumlah item seimbang, urutan prioritas ketat adalah: <code>CCP &gt; PREKURSOR &gt; OOT &gt; FARMA &gt; ALKES</code>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SHORTCUTS KEYBOARD */}
          {activeTab === "shortcuts" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? "bg-[#131d36] border-slate-700/80" : "bg-slate-50 border-slate-200"
              }`}>
                <h3 className="font-bold text-sm text-slate-100 dark:text-white mb-2 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-indigo-400" />
                  Pintasan Tombol Cepat (Keyboard Shortcuts)
                </h3>
                <p className="text-[11px] text-slate-400 mb-3">
                  Gunakan tombol keyboard untuk mempercepat proses verifikasi dan pencetakan tanpa menyentuh mouse:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <span>Fokus ke Pencarian</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-700 font-mono font-bold text-white text-[10px]">/</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <span>Beralih Halaman Tabel</span>
                    <span className="flex gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-700 font-mono font-bold text-white text-[10px]">←</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-700 font-mono font-bold text-white text-[10px]">→</kbd>
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <span>Salin No. Faktur Terpilih</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-700 font-mono font-bold text-white text-[10px]">Ctrl + C</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <span>Tutup Modal / Popup</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-700 font-mono font-bold text-white text-[10px]">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between text-xs ${
            isDarkMode ? "bg-[#131d36] border-slate-700/80 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          <span className="text-[11px]">
            Sistem Fantastic Order · PT Medikabina Investama &amp; PT Medika Akses Investama
          </span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl font-bold text-white transition-all shadow-xs ${
              isDarkMode ? "bg-blue-600 hover:bg-blue-500" : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
