"use client";

import React from "react";

interface QcAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QcAnnouncementModal({ isOpen, onClose }: QcAnnouncementModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c1222] border-2 border-indigo-500/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-900/40 via-blue-900/30 to-purple-900/30 border-b border-indigo-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚨</span>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>Update Penting Tracker</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                  Wajib Baca
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                Pembaruan Alur Operasional Report QC &amp; DO Checker
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-sm font-bold"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[75vh] text-xs">
          <p className="font-semibold text-zinc-700 dark:text-slate-300">
            Guys, ada update alur baru di sistem untuk Report QC mulai pagi ini:
          </p>

          {/* Point 1: GSheet Dicopot */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-1.5">
            <div className="font-black text-amber-800 dark:text-amber-400 flex items-center gap-1.5 text-xs">
              <span>1.</span>
              <span>SINKRONISASI GSHEET SUDAH DICOPOT TOTAL!</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-amber-950 dark:text-amber-200/90 text-[11px] leading-relaxed font-medium">
              <li>
                Google Sheet sudah <strong>TIDAK DIPAKAI LAGI</strong> dan diputus permanen dari sistem.
              </li>
              <li>
                Jangan tulis, edit, atau cari data di spreadsheet lama karena tidak akan tersinkron ke Fantastic Order.
              </li>
              <li>
                Seluruh antrean Report QC sekarang <strong>100% murni otomatis dari aplikasi DO Checker gudang</strong> (<em>checker-do.vercel.app</em>).
              </li>
            </ul>
          </div>

          {/* Point 2: Instant Real-Time */}
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800/60 space-y-1.5">
            <div className="font-black text-blue-800 dark:text-blue-400 flex items-center gap-1.5 text-xs">
              <span>2.</span>
              <span>DATA MASUK DETIK ITU JUGA (INSTANT REAL-TIME):</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-blue-950 dark:text-blue-200/90 text-[11px] leading-relaxed font-medium">
              <li>
                Begitu checker gudang klik tombol <strong>[ Selesai ]</strong> di aplikasi DO Checker, datanya <strong>LANGSUNG MUNCUL detik itu juga</strong> di Fantastic Order.
              </li>
              <li>
                Gak perlu refresh manual atau reload browser lagi, sistem langsung terhubung via WebSocket live.
              </li>
              <li>
                Tim lengkap otomatis terisi: Waktu Kirim, No DO, No SO, Apotek, Total Qty/Item, Picker, Checker, dan Packer.
              </li>
            </ul>
          </div>

          {/* Point 3: Tanda Seru Merah */}
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60 space-y-1.5">
            <div className="font-black text-rose-800 dark:text-rose-400 flex items-center gap-1.5 text-xs">
              <span>3.</span>
              <span>TANDA SERU MERAH [ ! ] = PRIORITAS CETAK FAKTUR:</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-rose-950 dark:text-rose-200/90 text-[11px] leading-relaxed font-medium">
              <li>
                Baris bertanda seru merah <strong className="text-rose-600 dark:text-rose-400 font-mono">[ ! ]</strong> wajib diprioritaskan: artinya barang sudah selesai dicek gudang tapi Faktur Oracle-nya <strong>BELUM TERBIT</strong>.
              </li>
              <li>
                SO dengan tanda <strong className="text-rose-600 dark:text-rose-400 font-mono">[ ! ]</strong> akan <strong>selalu berada di antrean paling atas</strong> agar tim admin segera memproses/mencetak fakturnya.
              </li>
            </ul>
          </div>

          {/* Point 4: Tindakan Admin (DONE) & Navigasi */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 space-y-1.5">
            <div className="font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
              <span>4.</span>
              <span>TINDAKAN ADMIN (DONE) &amp; NAVIGASI CEPAT:</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-emerald-950 dark:text-emerald-200/90 text-[11px] leading-relaxed font-medium">
              <li>
                Klik tombol hijau <strong className="text-emerald-600 dark:text-emerald-400">[ ✓ DONE ]</strong> (atau tekan <strong>Spasi</strong>) jika admin sudah selesai memproses SO tersebut.
              </li>
              <li>
                Selama invoice Oracle belum terbit, SO yang sudah di-DONE <strong>TIDAK AKAN HILANG</strong> dari antrean (tetap terpantau aman).
              </li>
              <li>
                Begitu file Oracle diupload, SO otomatis berpindah rapi ke arsip tab <strong>"Semua"</strong>.
              </li>
              <li>
                Navigasi super cepat ala Laptop 1: gunakan tombol Panah (<strong>↑ / ↓ / ← / →</strong>) dan tekan huruf <strong>C</strong> untuk salin No SO.
              </li>
            </ul>
          </div>

          <div className="pt-1 text-center text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">
            Langsung terapin mulai pagi ini ya. Semangat &amp; thank you! 🔥
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-zinc-50 dark:bg-[#070b14] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Siap, Mengerti &amp; Terapkan ➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
