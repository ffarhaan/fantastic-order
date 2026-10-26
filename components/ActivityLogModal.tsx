"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  X,
  User,
  Shield,
  FileText,
  RotateCcw,
  Building2,
  Calendar,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface ActivityLogItem {
  id: number;
  user_name: string;
  user_email?: string;
  action_type: string;
  module: string;
  target_id?: string;
  details: string;
  metadata?: any;
  created_at: string;
}

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  isSuperAdmin?: boolean;
}

export default function ActivityLogModal({
  isOpen,
  onClose,
  isDarkMode,
}: ActivityLogModalProps) {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "activity_logs",
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (moduleFilter !== "ALL") params.set("module", moduleFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/tidb?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.warn("Failed to fetch activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, page, moduleFilter]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      setPage(0);
      fetchLogs();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  if (!isOpen) return null;

  const formatTimestamp = (ts: string) => {
    if (!ts) return "-";
    try {
      const d = new Date(ts);
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d);
    } catch {
      return ts;
    }
  };

  const getModuleBadge = (mod: string) => {
    switch (mod?.toUpperCase()) {
      case "FAKTUR":
        return { label: "Faktur", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800" };
      case "SHIPMENT_ERROR":
        return { label: "Shipment Error", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800" };
      case "CUSTOMERS":
        return { label: "Pelanggan", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800" };
      case "AUTH":
      case "SETTINGS":
        return { label: "Hak Akses / Akun", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800" };
      default:
        return { label: mod || "Sistem", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700" };
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0c121e] border border-zinc-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-slate-800 flex items-center justify-between bg-zinc-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                  Log Aktivitas & Audit Trail
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {total.toLocaleString("id-ID")} Catatan
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                Riwayat lengkap perubahan data, status faktur, komplain, dan hak akses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 text-zinc-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition cursor-pointer"
              title="Refresh Data Log"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-slate-800/80 bg-white dark:bg-[#0c121e] flex flex-wrap gap-2.5 items-center justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari user, nomor faktur, atau rincian tindakan..."
              className="w-full bg-zinc-50 dark:bg-slate-900/80 border border-zinc-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Module Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-zinc-100 dark:bg-slate-900/90 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
            {[
              { id: "ALL", label: "Semua Modul" },
              { id: "FAKTUR", label: "Faktur" },
              { id: "SHIPMENT_ERROR", label: "Shipment Error" },
              { id: "CUSTOMERS", label: "Pelanggan" },
              { id: "AUTH", label: "Hak Akses" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setModuleFilter(m.id);
                  setPage(0);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                  moduleFilter === m.id
                    ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                    : "text-zinc-500 dark:text-slate-400 hover:text-black dark:hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 bg-zinc-50/30 dark:bg-[#070b13]">
          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Memuat data log aktivitas...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
              <History className="w-8 h-8 text-zinc-300 dark:text-slate-700" />
              <span>Belum ada log aktivitas yang cocok dengan filter.</span>
            </div>
          ) : (
            logs.map((log) => {
              const badge = getModuleBadge(log.module);
              return (
                <div
                  key={log.id}
                  className="p-3 sm:p-3.5 rounded-xl border border-zinc-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 shadow-2xs hover:border-zinc-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-black text-zinc-900 dark:text-white">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{log.user_name}</span>
                      </div>
                      {log.target_id && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-100 dark:bg-slate-800 rounded text-zinc-600 dark:text-slate-300">
                          #{log.target_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-slate-200 font-medium">
                      {log.details}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-slate-500 shrink-0 self-end sm:self-center font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTimestamp(log.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Pagination */}
        <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-slate-800 flex items-center justify-between bg-zinc-50/50 dark:bg-slate-900/50 text-xs">
          <span className="text-zinc-500 dark:text-slate-400">
            Halaman <strong>{page + 1}</strong> dari <strong>{totalPages}</strong>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
