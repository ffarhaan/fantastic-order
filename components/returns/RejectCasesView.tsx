"use client";

import { useState, useMemo } from "react";
import {
  XCircle,
  AlertTriangle,
  Building2,
  Search,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { ShipmentReturnRecord } from "@/lib/types";

interface RejectCasesViewProps {
  returns: ShipmentReturnRecord[];
}

export default function RejectCasesView({ returns = [] }: RejectCasesViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter rejected cases
  const rejectCases = useMemo(() => {
    return returns.filter((r) => {
      const st = (r.status || "").toLowerCase();
      const conf = (r.confirm || "").toLowerCase();
      return conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
    });
  }, [returns]);

  // Offending Outlets Ranking
  const outletRanking = useMemo(() => {
    const map: Record<string, { count: number; mai: number; mbi: number }> = {};
    for (const c of rejectCases) {
      const name = (c.customer_name || "Apotek Tidak Diketahui").trim();
      if (!map[name]) {
        map[name] = { count: 0, mai: 0, mbi: 0 };
      }
      map[name].count++;
      const pbf = (c.pbf || "MBI").toUpperCase();
      if (pbf.includes("MAI")) map[name].mai++;
      else map[name].mbi++;
    }

    const list = Object.entries(map).map(([name, stat]) => ({
      name,
      ...stat,
      pct: rejectCases.length > 0 ? Number(((stat.count / rejectCases.length) * 100).toFixed(1)) : 0,
    }));

    return list.sort((a, b) => b.count - a.count).slice(0, 10);
  }, [rejectCases]);

  // Filtered cases for table
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return rejectCases;
    const q = searchQuery.toLowerCase();
    return rejectCases.filter((c) => {
      return (
        (c.invoice_no && c.invoice_no.toLowerCase().includes(q)) ||
        (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
        (c.product_name && c.product_name.toLowerCase().includes(q)) ||
        (c.reason && c.reason.toLowerCase().includes(q))
      );
    });
  }, [rejectCases, searchQuery]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              TOTAL KASUS REJECT
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 block">
            {rejectCases.length}
          </span>
          <span className="text-[11px] text-rose-500/80 block">
            Komplain ditolak karena kekeliruan di sisi outlet / pemesan.
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
            OUTLET TERINDIKASI
          </span>
          <span className="text-2xl font-black text-zinc-900 dark:text-white block">
            {outletRanking.length}
          </span>
          <span className="text-[11px] text-zinc-500 block">
            Apotek yang pernah mengajukan komplain tidak valid.
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
            RASIO PENOLAKAN
          </span>
          <span className="text-2xl font-black text-zinc-900 dark:text-white block">
            {returns.length > 0 ? ((rejectCases.length / returns.length) * 100).toFixed(1) : 0}%
          </span>
          <span className="text-[11px] text-zinc-500 block">
            Dari keseluruhan total laporan masuk di Shipment Error.
          </span>
        </div>
      </div>

      {/* Offending Outlets Ranking Section */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Peringkat Outlet Paling Sering Salah Komplain (Top 10)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-zinc-500">Kesalahan Outlet</span>
        </div>

        {outletRanking.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Belum ada komplain yang tercatat ditolak.</p>
        ) : (
          <div className="space-y-3">
            {outletRanking.map((ot, idx) => (
              <div key={ot.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold flex items-center justify-center text-[10px]">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">{ot.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{ot.count} kasus</span>
                    <span className="text-zinc-400">({ot.pct}%)</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, ot.pct * 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table of Rejected Cases */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            Daftar Seluruh Kasus Ditolak ({filteredCases.length})
          </h4>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari no faktur, apotek, produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 backdrop-blur-sm text-zinc-700 dark:text-zinc-300 font-bold">
                  <th className="py-3 px-3">PBF</th>
                  <th className="py-3 px-3">No. Faktur</th>
                  <th className="py-3 px-3">Apotek / Outlet</th>
                  <th className="py-3 px-3">Nama Produk</th>
                  <th className="py-3 px-3">Alasan Komplain</th>
                  <th className="py-3 px-3">Catatan / Alasan Ditolak</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      Tidak ada data kasus yang ditolak.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            row.pbf === "MAI"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {row.pbf || "MBI"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                        {row.invoice_no || "-"}
                      </td>
                      <td className="py-3 px-3 font-semibold text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate">
                        {row.customer_name || "-"}
                      </td>
                      <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate">
                        {row.product_name || "-"}
                      </td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                        {row.reason || "-"}
                      </td>
                      <td className="py-3 px-3 text-zinc-500 max-w-[240px] truncate">
                        {row.note || "Kesalahan cek di apotek"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Reject
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
