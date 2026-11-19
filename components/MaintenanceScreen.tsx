"use client";

import React, { useEffect, useState } from "react";
import { Clock, ShieldAlert, RefreshCw, AlertTriangle } from "lucide-react";

interface MaintenanceScreenProps {
  pageName?: string;
  targetTime?: string;
}

export default function MaintenanceScreen({
  pageName = "Fantastic Order & Layanan Komplain",
  targetTime = "03.15 WIB",
}: MaintenanceScreenProps) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jakarta",
        }) + " WIB"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-hidden font-sans">
      {/* Background glowing effects */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center relative z-10 flex flex-col items-center">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          Maintenance Mode
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center mb-6 shadow-inner text-amber-400">
          <ShieldAlert className="w-10 h-10 animate-pulse" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Pemeliharaan Sistem
        </h1>
        <p className="text-sm font-medium text-slate-400 mb-6">
          {pageName}
        </p>

        {/* Target Time Box */}
        <div className="w-full bg-slate-950/80 border border-amber-500/30 rounded-xl p-4 mb-6 shadow-lg">
          <div className="flex items-center justify-center gap-2 text-amber-300 font-semibold text-sm mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Estimasi Selesai:</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-wider">
            {targetTime}
          </div>
          {timeStr && (
            <div className="text-xs text-slate-500 mt-2 font-mono">
              Waktu Server Saat Ini: <span className="text-slate-300">{timeStr}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
          Sistem saat ini sedang dalam peningkatan performa dan sinkronisasi data berkala. Seluruh aktivitas transaksi dan pelaporan komplain sementara ditutup dan akan dibuka kembali segera setelah pemeliharaan selesai.
        </p>

        {/* Refresh Action */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition active:scale-95 cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Muat Ulang Halaman
        </button>

        <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80" />
          <span>Mohon tidak melakukan transaksi hingga waktu pemeliharaan selesai.</span>
        </div>
      </div>
    </div>
  );
}
