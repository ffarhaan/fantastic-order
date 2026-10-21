"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Filter,
  Package,
  Building2,
  Eye,
  X,
} from "lucide-react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";

interface WeeklyQc2ViewProps {
  returns: ShipmentReturnRecord[];
  records?: FakturRecord[];
}

const CFG = {
  W_QC2_MBI_1: 9,
  W_QC2_MAI: 10,
  W_FLOW_ADJ: 14,
  W_QC2_MBI_NEW: 19,
  YEAR: 2026,
};

// Calculate week number from date string
const getWeekNumber = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 1;
  try {
    let d: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      d = new Date(dateStr);
    } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(dateStr)) {
      const parts = dateStr.split(/[\/\-]/);
      d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else {
      d = new Date(dateStr);
    }
    if (d && !isNaN(d.getTime())) {
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const diff = d.getTime() - startOfYear.getTime();
      const oneWeek = 604800000;
      return Math.max(1, Math.min(52, Math.floor(diff / oneWeek) + 1));
    }
  } catch {}
  return 1;
};

export default function WeeklyQc2View({
  returns = [],
  records = [],
}: WeeklyQc2ViewProps) {
  const [filterRange, setFilterRange] = useState<"all" | "3" | "5" | "10">("all");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Group records (fakturs) and returns by week
  const weeklyData = useMemo(() => {
    const map: Record<
      number,
      {
        week: number;
        mai_cases: number;
        mbi_cases: number;
        mai_invoices: number;
        mbi_invoices: number;
        cases: ShipmentReturnRecord[];
      }
    > = {};

    for (let w = 1; w <= 52; w++) {
      map[w] = {
        week: w,
        mai_cases: 0,
        mbi_cases: 0,
        mai_invoices: 0,
        mbi_invoices: 0,
        cases: [],
      };
    }

    // Tally returns
    for (const r of returns) {
      const w = r.week ? Number(r.week) : getWeekNumber(r.invoice_date || r.report_date || r.created_at);
      if (map[w]) {
        map[w].cases.push(r);
        const pbf = (r.pbf || "MBI").toUpperCase();
        if (pbf.includes("MAI")) {
          map[w].mai_cases++;
        } else {
          map[w].mbi_cases++;
        }
      }
    }

    // Tally invoices from records
    for (const rec of records) {
      const anyRec = rec as any;
      const dateVal = rec.orderDate || rec.transactionDate || anyRec.order_date || anyRec.transaction_date;
      const w = getWeekNumber(dateVal);
      if (map[w]) {
        const pbfStr = (anyRec.pbf || anyRec.sourceFile || rec.invoiceNumber || "MBI").toUpperCase();
        if (pbfStr.includes("MAI")) {
          map[w].mai_invoices++;
        } else {
          map[w].mbi_invoices++;
        }
      }
    }

    // Determine current max active week
    let maxW = 1;
    for (let w = 1; w <= 52; w++) {
      if (
        map[w].mai_cases > 0 ||
        map[w].mbi_cases > 0 ||
        map[w].mai_invoices > 0 ||
        map[w].mbi_invoices > 0
      ) {
        maxW = Math.max(maxW, w);
      }
    }

    const list = [];
    for (let w = 1; w <= maxW; w++) {
      const item = map[w];
      const totCases = item.mai_cases + item.mbi_cases;
      const totInv = item.mai_invoices + item.mbi_invoices;
      const rateMAI = item.mai_invoices > 0 ? (item.mai_cases / item.mai_invoices) * 100 : 0;
      const rateMBI = item.mbi_invoices > 0 ? (item.mbi_cases / item.mbi_invoices) * 100 : 0;
      const rateTot = totInv > 0 ? (totCases / totInv) * 100 : 0;

      // Milestones
      let milestone: string | null = null;
      let milestoneColor = "";
      if (w === CFG.W_QC2_MBI_1) {
        milestone = "QC2 MBI-1";
        milestoneColor = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      } else if (w === CFG.W_QC2_MAI) {
        milestone = "QC2 MAI";
        milestoneColor = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
      } else if (w === CFG.W_FLOW_ADJ) {
        milestone = "Flow Adj";
        milestoneColor = "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      } else if (w === CFG.W_QC2_MBI_NEW) {
        milestone = "QC2 MBI Baru";
        milestoneColor = "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300";
      }

      list.push({
        ...item,
        totCases,
        totInv,
        rateMAI: Number(rateMAI.toFixed(2)),
        rateMBI: Number(rateMBI.toFixed(2)),
        rateTot: Number(rateTot.toFixed(2)),
        milestone,
        milestoneColor,
      });
    }

    return { list, maxW };
  }, [returns, records]);

  // QC2 Impact Calculations
  const qc2Impact = useMemo(() => {
    const { list, maxW } = weeklyData;
    const calcSeg = (from: number, to: number, pbf: "MAI" | "MBI") => {
      let c = 0;
      let inv = 0;
      for (let w = from; w <= Math.min(to, maxW); w++) {
        const row = list[w - 1];
        if (row) {
          if (pbf === "MAI") {
            c += row.mai_cases;
            inv += row.mai_invoices;
          } else {
            c += row.mbi_cases;
            inv += row.mbi_invoices;
          }
        }
      }
      const pct = inv > 0 ? Number(((c / inv) * 100).toFixed(2)) : 0;
      return { cases: c, inv, pct };
    };

    const maiPre = calcSeg(1, CFG.W_QC2_MAI - 1, "MAI");
    const maiPost1 = calcSeg(CFG.W_QC2_MAI, CFG.W_FLOW_ADJ - 1, "MAI");
    const maiPost2 = calcSeg(CFG.W_FLOW_ADJ, maxW, "MAI");

    const mbiPre = calcSeg(1, CFG.W_QC2_MBI_1 - 1, "MBI");
    const mbiPost1 = calcSeg(CFG.W_QC2_MBI_1, CFG.W_QC2_MBI_NEW - 1, "MBI");
    const mbiPost2 = calcSeg(CFG.W_QC2_MBI_NEW, maxW, "MBI");

    return {
      mai: { pre: maiPre, post1: maiPost1, post2: maiPost2 },
      mbi: { pre: mbiPre, post1: mbiPost1, post2: mbiPost2 },
    };
  }, [weeklyData]);

  // Filtered rows for table
  const filteredRows = useMemo(() => {
    const list = weeklyData.list;
    if (filterRange === "all") return list;
    const count = Number(filterRange);
    return list.slice(-count);
  }, [weeklyData, filterRange]);

  // Cases for selected week modal
  const selectedWeekCases = useMemo(() => {
    if (selectedWeek === null) return [];
    const item = weeklyData.list.find((w) => w.week === selectedWeek);
    return item ? item.cases : [];
  }, [weeklyData, selectedWeek]);

  // Quick stats for selected week modal
  const weekStats = useMemo(() => {
    let resolved = 0;
    let pending = 0;
    let reject = 0;
    let mai = 0;
    let mbi = 0;

    for (const c of selectedWeekCases) {
      const st = (c.status || "").toLowerCase();
      const conf = (c.confirm || "").toLowerCase();
      const isRej = conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
      const isRes = st.includes("resolved") || st.includes("selesai");

      if (isRej) reject++;
      else if (isRes) resolved++;
      else pending++;

      const pbf = (c.pbf || "MBI").toUpperCase();
      if (pbf.includes("MAI")) mai++;
      else mbi++;
    }

    return {
      total: selectedWeekCases.length,
      resolved,
      pending,
      reject,
      mai,
      mbi,
    };
  }, [selectedWeekCases]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header Cards: QC2 Milestones Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              MILESTONE 1
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Week 9
            </span>
          </div>
          <h4 className="text-sm font-black text-zinc-900 dark:text-white">QC2 MBI-1</h4>
          <p className="text-[11px] text-zinc-500">Penerapan Quality Control tahap 2 pertama untuk PBF MBI.</p>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              MILESTONE 2
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              Week 10
            </span>
          </div>
          <h4 className="text-sm font-black text-zinc-900 dark:text-white">QC2 MAI</h4>
          <p className="text-[11px] text-zinc-500">Penerapan Quality Control tahap 2 untuk seluruh pengiriman PBF MAI.</p>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              MILESTONE 3
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              Week 14
            </span>
          </div>
          <h4 className="text-sm font-black text-zinc-900 dark:text-white">Flow Adjustment</h4>
          <p className="text-[11px] text-zinc-500">Penyesuaian alur kerja operasional gudang dan picking-checking.</p>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              MILESTONE 4
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              Week 19
            </span>
          </div>
          <h4 className="text-sm font-black text-zinc-900 dark:text-white">QC2 MBI Baru</h4>
          <p className="text-[11px] text-zinc-500">Upgrade sistem QC2 MBI dengan standar verifikasi barcode baru.</p>
        </div>
      </div>

      {/* QC2 Impact Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MAI Impact */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Dampak QC2 — PBF MAI</h3>
            </div>
            <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">Medika Akses</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Sebelum QC2</span>
              <span className="text-xs text-zinc-500 font-mono">W1–W9</span>
              <span className="text-lg font-black text-zinc-800 dark:text-zinc-200 block">
                {qc2Impact.mai.pre.pct}%
              </span>
              <span className="text-[10px] text-zinc-400 block">{qc2Impact.mai.pre.cases} kasus</span>
            </div>

            <div className="p-3 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-1">
              <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block">Post QC2</span>
              <span className="text-xs text-red-500 font-mono">W10–W13</span>
              <span className="text-lg font-black text-red-600 dark:text-red-400 block">
                {qc2Impact.mai.post1.pct}%
              </span>
              <span className="text-[10px] text-red-500/80 block">{qc2Impact.mai.post1.cases} kasus</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-1">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Flow Adj</span>
              <span className="text-xs text-emerald-500 font-mono">W14+</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block">
                {qc2Impact.mai.post2.pct}%
              </span>
              <span className="text-[10px] text-emerald-500/80 block">{qc2Impact.mai.post2.cases} kasus</span>
            </div>
          </div>
        </div>

        {/* MBI Impact */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Dampak QC2 — PBF MBI</h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">Medika Bina</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Sebelum QC2</span>
              <span className="text-xs text-zinc-500 font-mono">W1–W8</span>
              <span className="text-lg font-black text-zinc-800 dark:text-zinc-200 block">
                {qc2Impact.mbi.pre.pct}%
              </span>
              <span className="text-[10px] text-zinc-400 block">{qc2Impact.mbi.pre.cases} kasus</span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-1">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">QC2 MBI-1</span>
              <span className="text-xs text-blue-500 font-mono">W9–W18</span>
              <span className="text-lg font-black text-blue-600 dark:text-blue-400 block">
                {qc2Impact.mbi.post1.pct}%
              </span>
              <span className="text-[10px] text-blue-500/80 block">{qc2Impact.mbi.post1.cases} kasus</span>
            </div>

            <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 space-y-1">
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider block">MBI Baru</span>
              <span className="text-xs text-teal-500 font-mono">W19+</span>
              <span className="text-lg font-black text-teal-600 dark:text-teal-400 block">
                {qc2Impact.mbi.post2.pct}%
              </span>
              <span className="text-[10px] text-teal-500/80 block">{qc2Impact.mbi.post2.cases} kasus</span>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          {[
            { id: "all", label: "Semua Minggu" },
            { id: "10", label: "10 Minggu Terakhir" },
            { id: "5", label: "5 Minggu Terakhir" },
            { id: "3", label: "3 Minggu Terakhir" },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilterRange(btn.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterRange === btn.id
                  ? "bg-white text-black dark:bg-zinc-800 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-500 font-medium">
          Klik baris minggu untuk melihat rincian seluruh kasus di minggu tersebut.
        </span>
      </div>

      {/* Weekly Data Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 backdrop-blur-sm text-zinc-700 dark:text-zinc-300 font-bold">
                <th className="py-3 px-3">Minggu</th>
                <th className="py-3 px-3">Total Faktur</th>
                <th className="py-3 px-3 text-red-600 dark:text-red-400">Kasus MAI</th>
                <th className="py-3 px-3 text-blue-600 dark:text-blue-400">Kasus MBI</th>
                <th className="py-3 px-3">Total Kasus</th>
                <th className="py-3 px-3">Error Rate (%)</th>
                <th className="py-3 px-3">Milestone QC2</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Belum ada data kasus mingguan.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.week}
                    onClick={() => setSelectedWeek(row.week)}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-3 font-mono font-black text-zinc-900 dark:text-white">
                      W{row.week}
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-600 dark:text-zinc-400">
                      {row.totInv.toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-red-600 dark:text-red-400">
                      {row.mai_cases}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {row.mbi_cases}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {row.totCases}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span
                          className={`font-bold ${
                            row.rateTot > 1.0
                              ? "text-red-500"
                              : row.rateTot > 0.5
                              ? "text-amber-500"
                              : "text-emerald-500"
                          }`}
                        >
                          {row.rateTot}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {row.milestone ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${row.milestoneColor}`}
                        >
                          ★ {row.milestone}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWeek(row.week);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-black dark:hover:text-white text-[11px] font-semibold flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3 h-3 text-blue-500" />
                        <span>Rincian</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Week Detail Modal */}
      {selectedWeek !== null && (
        <div
          onClick={() => setSelectedWeek(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="text-base font-black text-zinc-900 dark:text-white">
                  Rincian Kasus Shipment Error — Week {selectedWeek}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWeek(null)}
                className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Counters */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-6 gap-2 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800 text-center">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400 font-bold block">TOTAL KASUS</span>
                <span className="text-base font-black text-zinc-900 dark:text-white">{weekStats.total}</span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">IN PROGRESS</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400">{weekStats.pending}</span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">RESOLVED</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{weekStats.resolved}</span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block">REJECT</span>
                <span className="text-base font-black text-rose-600 dark:text-rose-400">{weekStats.reject}</span>
              </div>
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                <span className="text-[10px] text-red-700 dark:text-red-400 font-bold block">MAI</span>
                <span className="text-base font-black text-red-600 dark:text-red-400">{weekStats.mai}</span>
              </div>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold block">MBI</span>
                <span className="text-base font-black text-blue-600 dark:text-blue-400">{weekStats.mbi}</span>
              </div>
            </div>

            {/* Modal Body Table */}
            <div className="overflow-y-auto flex-1 p-4">
              {selectedWeekCases.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Tidak ada catatan kasus shipment error pada minggu ini.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                      <th className="py-2.5 px-3">PBF</th>
                      <th className="py-2.5 px-3">No. Faktur</th>
                      <th className="py-2.5 px-3">Apotek / Outlet</th>
                      <th className="py-2.5 px-3">Nama Produk</th>
                      <th className="py-2.5 px-3">Jenis Masalah</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                    {selectedWeekCases.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              c.pbf === "MAI"
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {c.pbf || "MBI"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900 dark:text-white">
                          {c.invoice_no || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-800 dark:text-zinc-200">
                          {c.customer_name || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate">
                          {c.product_name || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                          {c.reason || "-"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              (c.status || "").includes("Resolved")
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : (c.confirm || "").toLowerCase().includes("reject")
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {c.status || "In Progress"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50 dark:bg-zinc-950/50">
              <button
                type="button"
                onClick={() => setSelectedWeek(null)}
                className="px-4 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
