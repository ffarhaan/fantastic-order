"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  X,
  RefreshCw,
  HardDrive,
  FileSpreadsheet,
  RotateCcw,
  Building2,
  FileText,
  Activity,
  CheckCircle2,
  Sparkles,
  Layers,
  Shield,
  Zap,
} from "lucide-react";

interface DatabaseStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export default function DatabaseStatsModal({
  isOpen,
  onClose,
  isDarkMode,
}: DatabaseStatsModalProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tidb?action=db_stats");
      const json = await res.json();
      if (json.success && json.stats) {
        setStats(json.stats);
      } else {
        throw new Error(json.error || "Gagal memuat status database.");
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tables = stats?.tables || {};
  const storage = stats?.storage || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isDarkMode ? "bg-[#0b101b] border-slate-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDarkMode ? "border-slate-800 bg-slate-900/50" : "border-zinc-100 bg-zinc-50"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide flex items-center gap-1.5">
                <span>Transparansi Database TiDB Cloud</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                  Online
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400">
                Penggunaan kapasitas, kuota limit, dan rincian data tersimpan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {error}
            </div>
          )}

          {/* Storage Limit Card */}
          <div className={`p-4 rounded-xl border relative overflow-hidden ${
            isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-zinc-50 border-zinc-200"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-zinc-500 dark:text-slate-400">
                <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                <span>Penyimpanan Data (Storage)</span>
              </div>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {storage.used_mb !== undefined ? `${storage.used_mb} MB` : "..."} / 5.120 MB (5 GB)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(1, storage.percentage || 1)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-slate-400">
              <span>Terpakai: <strong>{storage.percentage || 0.05}%</strong></span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Sisa Kuota: <strong>{storage.free_mb || 5117} MB</strong> (99.95% Tersedia)
              </span>
            </div>
          </div>

          {/* Request Units (RU) & Cluster Info */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`p-3 rounded-xl border ${
              isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-slate-400 uppercase">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Batas Kuota RU</span>
              </div>
              <div className="text-sm font-black font-mono mt-1 text-amber-600 dark:text-amber-400">
                50 Juta RU / bln
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-slate-500 mt-0.5">
                Request Units Serverless gratis
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${
              isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-slate-400 uppercase">
                <Shield className="w-3 h-3 text-indigo-500" />
                <span>Replikasi & Keamanan</span>
              </div>
              <div className="text-sm font-black mt-1 text-indigo-600 dark:text-indigo-400">
                Multi-AZ TiKV
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-slate-500 mt-0.5">
                Auto-backup & Enkripsi TLS 1.3
              </p>
            </div>
          </div>

          {/* Table Breakdown */}
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-600 dark:text-slate-300 text-[11px] uppercase tracking-wider">
              Rincian Baris Tersimpan per Tabel:
            </h4>

            <div className={`divide-y rounded-xl border overflow-hidden ${
              isDarkMode ? "divide-slate-800 border-slate-800 bg-slate-900/20" : "divide-zinc-100 border-zinc-200 bg-white"
            }`}>
              {/* Faktur Penjualan */}
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="font-bold block">fakturs_archive</span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-500">Data Faktur Penjualan</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs">
                  {Number(tables.fakturs || 0).toLocaleString("id-ID")} baris
                </span>
              </div>

              {/* Shipment Error */}
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="font-bold block">shipment_returns</span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-500">Kasus Shipment Error & Retur (MAI & MBI)</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                  {Number(tables.returns_count || 0).toLocaleString("id-ID")} baris
                </span>
              </div>

              {/* Customers */}
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-500" />
                  <div>
                    <span className="font-bold block">customers</span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-500">Direktori Mitra / Apotek</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs text-cyan-600 dark:text-cyan-400">
                  {Number(tables.customers || 0).toLocaleString("id-ID")} baris
                </span>
              </div>

              {/* Customer Documents */}
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <div>
                    <span className="font-bold block">customer_documents</span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-500">Berkas Legalitas Apotek (PDF & Drive)</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400">
                  {Number(tables.documents || 0).toLocaleString("id-ID")} berkas
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-3 border-t flex items-center justify-between ${
          isDarkMode ? "border-slate-800 bg-slate-900/50" : "border-zinc-100 bg-zinc-50"
        }`}>
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-500" : ""}`} />
            <span>{loading ? "Menyegarkan..." : "Segarkan Status Realtime"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
