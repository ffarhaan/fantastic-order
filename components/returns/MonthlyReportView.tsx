"use client";

import { useMemo, useState } from "react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";
import {
  Calendar,
  TrendingDown,
  TrendingUp,
  Minus,
  Building2,
  Package,
  Layers,
  ArrowRight,
  Filter,
} from "lucide-react";

interface MonthlyReportViewProps {
  returns: ShipmentReturnRecord[];
  records?: FakturRecord[];
  onSelectMonth?: (monthNum: number, pbf?: string) => void;
}

export const MONTHLY_BENCHMARKS = [
  { month: 1, name: "JANUARI", mai_approve: 12, mai_inv: 5150, mai_reject: 1, mbi_approve: 76, mbi_inv: 5011, mbi_reject: 13 },
  { month: 2, name: "FEBRUARI", mai_approve: 8, mai_inv: 5475, mai_reject: 1, mbi_approve: 102, mbi_inv: 5461, mbi_reject: 8 },
  { month: 3, name: "MARET", mai_approve: 8, mai_inv: 5620, mai_reject: 0, mbi_approve: 115, mbi_inv: 4870, mbi_reject: 6 },
  { month: 4, name: "APRIL", mai_approve: 4, mai_inv: 6320, mai_reject: 0, mbi_approve: 145, mbi_inv: 7151, mbi_reject: 17 },
  { month: 5, name: "MEI", mai_approve: 8, mai_inv: 6441, mai_reject: 2, mbi_approve: 104, mbi_inv: 8255, mbi_reject: 11 },
  { month: 6, name: "JUNI", mai_approve: 4, mai_inv: 6566, mai_reject: 0, mbi_approve: 138, mbi_inv: 9195, mbi_reject: 10 },
  { month: 7, name: "JULI", mai_approve: 3, mai_inv: 6591, mai_reject: 0, mbi_approve: 218, mbi_inv: 10532, mbi_reject: 14 },
  { month: 8, name: "AGUSTUS", mai_approve: 8, mai_inv: 5832, mai_reject: 0, mbi_approve: 126, mbi_inv: 9680, mbi_reject: 9 },
  { month: 9, name: "SEPTEMBER", mai_approve: 6, mai_inv: 6380, mai_reject: 0, mbi_approve: 228, mbi_inv: 8161, mbi_reject: 10 },
  { month: 10, name: "OKTOBER", mai_approve: 4, mai_inv: 4101, mai_reject: 0, mbi_approve: 152, mbi_inv: 9917, mbi_reject: 7, isCurrent: true },
];

export default function MonthlyReportView({
  returns = [],
  onSelectMonth,
}: MonthlyReportViewProps) {
  const [selectedPbfFilter, setSelectedPbfFilter] = useState<"ALL" | "MBI" | "MAI">("ALL");

  // Calculate monthly stats from returns
  const monthlyData = useMemo(() => {
    // Map month (1-12) -> counts
    const counts: Record<
      number,
      {
        mai_approve: number;
        mbi_approve: number;
        mai_reject: number;
        mbi_reject: number;
      }
    > = {};

    for (let m = 1; m <= 12; m++) {
      counts[m] = { mai_approve: 0, mbi_approve: 0, mai_reject: 0, mbi_reject: 0 };
    }

    for (const r of returns) {
      // Determine month
      let m = r.month ? Number(r.month) : 0;
      if (!m || m < 1 || m > 12) {
        const dateStr = r.report_date || r.invoice_date || r.created_at;
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              m = d.getMonth() + 1;
            }
          } catch {}
        }
      }

      if (m >= 1 && m <= 12) {
        const pbf = (r.pbf || "MBI").toUpperCase();
        const conf = (r.confirm || "").toLowerCase();
        const stat = (r.status || "").toLowerCase();
        const isRej = conf.includes("reject") || conf.includes("tolak") || stat.includes("reject");

        if (pbf.includes("MAI")) {
          if (isRej) counts[m].mai_reject++;
          else counts[m].mai_approve++;
        } else {
          if (isRej) counts[m].mbi_reject++;
          else counts[m].mbi_approve++;
        }
      }
    }

    // Build list of months with rate & trend
    let prevMaiRate: number | null = null;
    let prevMbiRate: number | null = null;

    return MONTHLY_BENCHMARKS.map((bm) => {
      const c = counts[bm.month];
      // Seamlessly combine live counts with complete historical Apps Script benchmarks
      const maiApprove = c.mai_approve > 0 ? c.mai_approve : bm.mai_approve;
      const mbiApprove = c.mbi_approve > 0 ? c.mbi_approve : bm.mbi_approve;
      const maiReject = c.mai_reject > 0 ? c.mai_reject : bm.mai_reject;
      const mbiReject = c.mbi_reject > 0 ? c.mbi_reject : bm.mbi_reject;

      const maiRate = bm.mai_inv > 0 ? (maiApprove / bm.mai_inv) * 100 : 0;
      const mbiRate = bm.mbi_inv > 0 ? (mbiApprove / bm.mbi_inv) * 100 : 0;

      const maiTrend = prevMaiRate !== null ? maiRate - prevMaiRate : null;
      const mbiTrend = prevMbiRate !== null ? mbiRate - prevMbiRate : null;

      prevMaiRate = maiRate;
      prevMbiRate = mbiRate;

      return {
        ...bm,
        mai_approve: maiApprove,
        mbi_approve: mbiApprove,
        mai_reject: maiReject,
        mbi_reject: mbiReject,
        mai_rate: Number(maiRate.toFixed(2)),
        mbi_rate: Number(mbiRate.toFixed(2)),
        mai_trend: maiTrend !== null ? Number(maiTrend.toFixed(2)) : null,
        mbi_trend: mbiTrend !== null ? Number(mbiTrend.toFixed(2)) : null,
      };
    });
  }, [returns]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─── 1. GRID MONTHLY CARDS (MAI RED & MBI BLUE) ─── */}
      <div className="space-y-4">
        {/* MAI ROW */}
        {(selectedPbfFilter === "ALL" || selectedPbfFilter === "MAI") && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <h3 className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                Ringkasan Bulanan MAI (PT Medika Akses Investama)
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
              {monthlyData.map((m) => {
                const isCurrent = m.isCurrent;
                return (
                  <div
                    key={`mai-${m.month}`}
                    onClick={() => onSelectMonth && onSelectMonth(m.month, "MAI")}
                    className={`p-3 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:shadow-md ${
                      isCurrent
                        ? "border-red-400 dark:border-red-500 border-dashed ring-2 ring-red-400/20 shadow-xs"
                        : "border-zinc-200 dark:border-slate-800 border-t-4 border-t-red-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-black text-zinc-500 dark:text-slate-400 uppercase tracking-wider truncate">
                        {m.name} MAI {isCurrent ? "▲" : ""}
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">
                      {m.mai_approve}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      {m.mai_rate}% · {m.mai_inv.toLocaleString("id-ID")} inv
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MBI ROW */}
        {(selectedPbfFilter === "ALL" || selectedPbfFilter === "MBI") && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Ringkasan Bulanan MBI (PT Medika Bina Investama)
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
              {monthlyData.map((m) => {
                const isCurrent = m.isCurrent;
                return (
                  <div
                    key={`mbi-${m.month}`}
                    onClick={() => onSelectMonth && onSelectMonth(m.month, "MBI")}
                    className={`p-3 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:shadow-md ${
                      isCurrent
                        ? "border-blue-400 dark:border-blue-500 border-dashed ring-2 ring-blue-400/20 shadow-xs"
                        : "border-zinc-200 dark:border-slate-800 border-t-4 border-t-blue-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-black text-zinc-500 dark:text-slate-400 uppercase tracking-wider truncate">
                        {m.name} MBI {isCurrent ? "▲" : ""}
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                      {m.mbi_approve}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      {m.mbi_rate}% · {m.mbi_inv.toLocaleString("id-ID")} inv
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. TABEL DETAIL MONTHLY ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50 dark:bg-slate-950/40">
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white">
              Tabel Detail Monthly
            </h4>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
              Perbandingan MAI vs MBI — kolom Reject = kesalahan outlet / apotek
            </p>
          </div>

          {/* Filter PBF Selector */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
            {[
              { id: "ALL", label: "Semua PBF" },
              { id: "MBI", label: "MBI Saja" },
              { id: "MAI", label: "MAI Saja" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPbfFilter(p.id as any)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedPbfFilter === p.id
                    ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                    : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-100/80 dark:bg-slate-950 text-zinc-700 dark:text-slate-300 font-black border-b border-zinc-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Bulan</th>
                <th className="py-3 px-3">PBF</th>
                <th className="py-3 px-3 text-right">Approve</th>
                <th className="py-3 px-3 text-right">Invoice</th>
                <th className="py-3 px-3 text-right">Error %</th>
                <th className="py-3 px-3 text-right text-red-600 dark:text-red-400">Reject</th>
                <th className="py-3 px-6">Visualisasi</th>
                <th className="py-3 px-4 text-right">VS Bln Lalu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-slate-800/60 font-medium">
              {monthlyData.map((m) => {
                const monthName = m.name.charAt(0) + m.name.slice(1).toLowerCase();

                // Rows for MAI and MBI
                const rowsToShow = [];
                if (selectedPbfFilter === "ALL" || selectedPbfFilter === "MAI") {
                  rowsToShow.push({
                    pbf: "MAI",
                    approve: m.mai_approve,
                    inv: m.mai_inv,
                    rate: m.mai_rate,
                    reject: m.mai_reject,
                    trend: m.mai_trend,
                    barColor: "bg-red-500",
                    badgeColor: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60",
                  });
                }
                if (selectedPbfFilter === "ALL" || selectedPbfFilter === "MBI") {
                  rowsToShow.push({
                    pbf: "MBI",
                    approve: m.mbi_approve,
                    inv: m.mbi_inv,
                    rate: m.mbi_rate,
                    reject: m.mbi_reject,
                    trend: m.mbi_trend,
                    barColor: "bg-blue-600",
                    badgeColor: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60",
                  });
                }

                return rowsToShow.map((row, rIdx) => {
                  const maxRate = 3.5; // Scale for visual bar
                  const barWidth = Math.min(100, (row.rate / maxRate) * 100);

                  return (
                    <tr
                      key={`${m.month}-${row.pbf}`}
                      onClick={() => onSelectMonth && onSelectMonth(m.month, row.pbf)}
                      className="hover:bg-zinc-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      {rIdx === 0 ? (
                        <td
                          rowSpan={rowsToShow.length}
                          className="py-3 px-4 font-bold text-zinc-900 dark:text-white border-r border-zinc-100 dark:border-slate-800/40 align-middle bg-zinc-50/30 dark:bg-slate-950/20"
                        >
                          {monthName}
                        </td>
                      ) : null}

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${row.badgeColor}`}
                        >
                          {row.pbf}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-zinc-900 dark:text-white">
                        {row.approve}
                      </td>

                      <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-slate-400 font-mono">
                        {row.inv.toLocaleString("id-ID")}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-zinc-900 dark:text-white font-mono">
                        {row.rate.toFixed(2)}%
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400 font-mono">
                        {row.reject || 0}
                      </td>

                      <td className="py-2.5 px-6">
                        <div className="w-full bg-zinc-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden max-w-[140px]">
                          <div
                            className={`h-full ${row.barColor} rounded-full transition-all`}
                            style={{ width: `${Math.max(4, barWidth)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-[11px]">
                        {row.trend === null ? (
                          <span className="text-zinc-400">—</span>
                        ) : row.trend > 0 ? (
                          <span className="text-red-600 dark:text-red-400 font-bold flex items-center justify-end gap-0.5">
                            <TrendingUp className="w-3 h-3" />
                            +{row.trend.toFixed(2)}%
                          </span>
                        ) : row.trend < 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-0.5">
                            <TrendingDown className="w-3 h-3" />
                            {row.trend.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-500">0.00%</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
