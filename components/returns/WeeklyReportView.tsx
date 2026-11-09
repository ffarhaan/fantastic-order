"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  Filter,
  Package,
  Building2,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  CalendarRange,
  Zap,
} from "lucide-react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";
import { parseWeekFilterRange } from "./AnalisisView";

interface WeeklyReportViewProps {
  returns: ShipmentReturnRecord[];
  records?: FakturRecord[];
  initialWeekFilter?: string;
}

// Milestone config
const MILESTONES: Record<number, { text: string; color: string }> = {
  9: { text: "QC2 MBI-1", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800" },
  10: { text: "QC2 MAI", color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800" },
  14: { text: "Flow Adjustment", color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800" },
  19: { text: "QC2 MBI Baru", color: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800" },
};

// Benchmark Invoices & Cases for 2026 (W1–W43) to match Apps Script
const WEEKLY_BENCHMARKS: Record<number, { maiInv: number; mbiInv: number; maiApprove: number; mbiApprove: number; totReject: number }> = {
  1: { maiInv: 298, mbiInv: 402, maiApprove: 1, mbiApprove: 8, totReject: 1 },
  2: { maiInv: 1115, mbiInv: 1439, maiApprove: 2, mbiApprove: 28, totReject: 6 },
  3: { maiInv: 1067, mbiInv: 1305, maiApprove: 5, mbiApprove: 23, totReject: 7 },
  4: { maiInv: 1247, mbiInv: 1184, maiApprove: 2, mbiApprove: 16, totReject: 0 },
  5: { maiInv: 1423, mbiInv: 681, maiApprove: 2, mbiApprove: 1, totReject: 0 },
  6: { maiInv: 1194, mbiInv: 1720, maiApprove: 0, mbiApprove: 52, totReject: 3 },
  7: { maiInv: 1356, mbiInv: 1448, maiApprove: 3, mbiApprove: 22, totReject: 3 },
  8: { maiInv: 1338, mbiInv: 1448, maiApprove: 4, mbiApprove: 21, totReject: 2 },
  9: { maiInv: 1587, mbiInv: 845, maiApprove: 1, mbiApprove: 7, totReject: 1 },
  10: { maiInv: 1257, mbiInv: 1608, maiApprove: 1, mbiApprove: 43, totReject: 2 },
  11: { maiInv: 1646, mbiInv: 1539, maiApprove: 2, mbiApprove: 45, totReject: 3 },
  12: { maiInv: 1350, mbiInv: 860, maiApprove: 0, mbiApprove: 22, totReject: 1 },
  13: { maiInv: 1367, mbiInv: 863, maiApprove: 1, mbiApprove: 2, totReject: 0 },
  14: { maiInv: 1580, mbiInv: 1788, maiApprove: 5, mbiApprove: 40, totReject: 4 },
  15: { maiInv: 1580, mbiInv: 1788, maiApprove: 0, mbiApprove: 43, totReject: 4 },
  16: { maiInv: 1580, mbiInv: 1788, maiApprove: 0, mbiApprove: 32, totReject: 5 },
  17: { maiInv: 1580, mbiInv: 1787, maiApprove: 0, mbiApprove: 33, totReject: 4 },
  18: { maiInv: 1288, mbiInv: 1651, maiApprove: 1, mbiApprove: 15, totReject: 2 },
  19: { maiInv: 1288, mbiInv: 1651, maiApprove: 1, mbiApprove: 26, totReject: 2 },
  20: { maiInv: 1288, mbiInv: 1651, maiApprove: 1, mbiApprove: 23, totReject: 2 },
  21: { maiInv: 1288, mbiInv: 1651, maiApprove: 3, mbiApprove: 28, totReject: 3 },
  22: { maiInv: 1289, mbiInv: 1651, maiApprove: 0, mbiApprove: 12, totReject: 2 },
  23: { maiInv: 1641, mbiInv: 2299, maiApprove: 0, mbiApprove: 16, totReject: 1 },
  24: { maiInv: 1641, mbiInv: 2299, maiApprove: 1, mbiApprove: 52, totReject: 3 },
  25: { maiInv: 1642, mbiInv: 2298, maiApprove: 3, mbiApprove: 47, totReject: 3 },
  26: { maiInv: 1642, mbiInv: 2299, maiApprove: 0, mbiApprove: 22, totReject: 3 },
  27: { maiInv: 1648, mbiInv: 2633, maiApprove: 0, mbiApprove: 57, totReject: 4 },
  28: { maiInv: 1648, mbiInv: 2633, maiApprove: 1, mbiApprove: 42, totReject: 3 },
  29: { maiInv: 1647, mbiInv: 2633, maiApprove: 2, mbiApprove: 62, totReject: 4 },
  30: { maiInv: 1648, mbiInv: 2633, maiApprove: 0, mbiApprove: 56, totReject: 3 },
  31: { maiInv: 1166, mbiInv: 1936, maiApprove: 0, mbiApprove: 9, totReject: 1 },
  32: { maiInv: 1166, mbiInv: 1936, maiApprove: 0, mbiApprove: 26, totReject: 2 },
  33: { maiInv: 1167, mbiInv: 1936, maiApprove: 1, mbiApprove: 33, totReject: 3 },
  34: { maiInv: 1166, mbiInv: 1936, maiApprove: 3, mbiApprove: 56, totReject: 3 },
  35: { maiInv: 1167, mbiInv: 1936, maiApprove: 2, mbiApprove: 4, totReject: 0 },
  36: { maiInv: 1595, mbiInv: 2040, maiApprove: 4, mbiApprove: 63, totReject: 3 },
  37: { maiInv: 1595, mbiInv: 2040, maiApprove: 1, mbiApprove: 100, totReject: 4 },
  38: { maiInv: 1595, mbiInv: 2041, maiApprove: 1, mbiApprove: 48, totReject: 2 },
  39: { maiInv: 1595, mbiInv: 2040, maiApprove: 2, mbiApprove: 14, totReject: 1 },
  40: { maiInv: 1025, mbiInv: 2479, maiApprove: 1, mbiApprove: 25, totReject: 2 },
  41: { maiInv: 1025, mbiInv: 2479, maiApprove: 1, mbiApprove: 51, totReject: 2 },
  42: { maiInv: 1025, mbiInv: 2480, maiApprove: 2, mbiApprove: 51, totReject: 2 },
  43: { maiInv: 1026, mbiInv: 2479, maiApprove: 0, mbiApprove: 28, totReject: 1 },
};

// Calculate week number strictly from date
function parseDateWeek(dateStr: string | null | undefined): number | null {
  if (!dateStr || dateStr === "-" || dateStr === "#N/A") return null;
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
      const soy = new Date(d.getFullYear(), 0, 1);
      return Math.max(1, Math.min(52, Math.floor((d.getTime() - soy.getTime()) / 604800000) + 1));
    }
  } catch {}
  return null;
}

export default function WeeklyReportView({
  returns = [],
  records = [],
  initialWeekFilter = "all",
}: WeeklyReportViewProps) {
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>(initialWeekFilter);
  const [modalWeek, setModalWeek] = useState<number | null>(null);

  // Group returns and calculate stats per week
  const weeklyData = useMemo(() => {
    const map: Record<
      number,
      {
        week: number;
        maiApprove: number;
        maiReject: number;
        mbiApprove: number;
        mbiReject: number;
        maiInv: number;
        mbiInv: number;
        cases: ShipmentReturnRecord[];
      }
    > = {};

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const currentWeekNumber = Math.max(1, Math.min(52, Math.floor((now.getTime() - startOfYear.getTime()) / 604800000) + 1));
    let maxW = Math.max(43, currentWeekNumber);

    for (const r of returns) {
      const dStr = r.report_date || r.invoice_date || r.created_at;
      const wFromDate = parseDateWeek(dStr);
      if (wFromDate && wFromDate > maxW && wFromDate <= 52) {
        maxW = wFromDate;
      } else if (r.week) {
        const wNum = Number(String(r.week).replace(/\D/g, ""));
        if (wNum > maxW && wNum <= 52) maxW = wNum;
      }
    }

    // Tally actual unique invoices from database records
    const seenMaiInvoices = Array.from({ length: 55 }, () => new Set<string>());
    const seenMbiInvoices = Array.from({ length: 55 }, () => new Set<string>());

    for (const rec of records) {
      const anyRec = rec as any;
      const dateVal = rec.orderDate || rec.transactionDate || anyRec.order_date || anyRec.transaction_date;
      const w = parseDateWeek(dateVal);
      if (w && w >= 1 && w <= 52) {
        if (w > maxW) maxW = w;
        const pbfStr = (anyRec.pbf || anyRec.sourceFile || anyRec.entity || rec.invoiceNumber || anyRec.key || "MBI").toUpperCase();
        const invNo = String(rec.invoiceNumber || anyRec.key || anyRec.no_faktur || anyRec.id || "").trim();
        if (invNo) {
          if (pbfStr.includes("MAI")) {
            seenMaiInvoices[w].add(invNo);
          } else {
            seenMbiInvoices[w].add(invNo);
          }
        }
      }
    }

    const seenMaiApprove = Array.from({ length: 55 }, () => new Set<string>());
    const seenMbiApprove = Array.from({ length: 55 }, () => new Set<string>());
    const seenMaiReject = Array.from({ length: 55 }, () => new Set<string>());
    const seenMbiReject = Array.from({ length: 55 }, () => new Set<string>());

    for (let w = 1; w <= maxW; w++) {
      const bench = WEEKLY_BENCHMARKS[w] || { maiInv: 0, mbiInv: 0, maiApprove: 0, mbiApprove: 0, totReject: 0 };
      map[w] = {
        week: w,
        maiApprove: 0,
        maiReject: 0,
        mbiApprove: 0,
        mbiReject: 0,
        maiInv: bench.maiInv,
        mbiInv: bench.mbiInv,
        cases: [],
      };
    }

    // Tally returns strictly by calendar report_date
    for (const r of returns) {
      let w: number | null = null;
      const dStr = r.report_date || r.invoice_date || r.created_at;
      if (dStr) {
        w = parseDateWeek(dStr);
      }
      if (!w && r.week) {
        w = Number(String(r.week).replace(/\D/g, "")) || null;
      }
      if (!w || w < 1 || w > 52) continue;

      if (map[w]) {
        map[w].cases.push(r);
        const pbf = (r.pbf || "MBI").toUpperCase();
        const conf = (r.confirm || "").toLowerCase();
        const isReject = conf.includes("reject") || conf.includes("tolak") || (r.status || "").toLowerCase().includes("reject");
        const invKey = (r.invoice_no || "").trim().toLowerCase() || `row_${r.id}`;

        if (pbf.includes("MAI")) {
          if (isReject) {
            seenMaiReject[w].add(invKey);
          } else {
            seenMaiApprove[w].add(invKey);
          }
        } else {
          if (isReject) {
            seenMbiReject[w].add(invKey);
          } else {
            seenMbiApprove[w].add(invKey);
          }
        }
      }
    }

    // Compile rows
    const list = [];
    for (let w = 1; w <= maxW; w++) {
      const item = map[w];
      const bench = WEEKLY_BENCHMARKS[w] || { maiInv: 0, mbiInv: 0, maiApprove: 0, mbiApprove: 0, totReject: 0 };
      const liveMaiApprove = seenMaiApprove[w].size;
      const liveMbiApprove = seenMbiApprove[w].size;
      const liveReject = seenMaiReject[w].size + seenMbiReject[w].size;
      const liveMaiInv = seenMaiInvoices[w].size;
      const liveMbiInv = seenMbiInvoices[w].size;

      // 1 unique invoice = 1 case matching Apps Script
      const maiApprove = liveMaiApprove > 0 ? liveMaiApprove : bench.maiApprove;
      const mbiApprove = liveMbiApprove > 0 ? liveMbiApprove : bench.mbiApprove;

      // If database has live invoices for this week, use live count; otherwise fallback to historical benchmark
      const maiInv = liveMaiInv > 0 ? liveMaiInv : (bench.maiInv || 0);
      const mbiInv = liveMbiInv > 0 ? liveMbiInv : (bench.mbiInv || 0);

      const totReject = liveReject > 0 ? liveReject : bench.totReject;
      const maiPct = maiInv > 0 ? (maiApprove / maiInv) * 100 : 0;
      const mbiPct = mbiInv > 0 ? (mbiApprove / mbiInv) * 100 : 0;
      const milestone = MILESTONES[w] || null;

      list.push({
        ...item,
        maiApprove,
        mbiApprove,
        maiInv,
        mbiInv,
        maiPct: Number(maiPct.toFixed(2)),
        mbiPct: Number(mbiPct.toFixed(2)),
        totReject,
        milestone,
      });
    }

    return list;
  }, [returns, records]);

  const maxAvailableWeek = useMemo(() => {
    if (weeklyData.length === 0) return 45;
    return weeklyData[weeklyData.length - 1].week;
  }, [weeklyData]);

  const threeWeekBlocks = useMemo(() => {
    const maxW = maxAvailableWeek;
    const blocks: { id: string; min: number; max: number; label: string }[] = [];
    for (let end = maxW; end >= 1; end -= 3) {
      const start = Math.max(1, end - 2);
      blocks.push({
        id: `3W:${start}-${end}`,
        min: start,
        max: end,
        label: `W${start} – W${end} (3 Minggu)`,
      });
    }
    return blocks;
  }, [maxAvailableWeek]);

  const activeRange = useMemo(() => {
    return parseWeekFilterRange(selectedWeekFilter, maxAvailableWeek);
  }, [selectedWeekFilter, maxAvailableWeek]);

  // Filtered rows for table & chart
  const displayedWeeks = useMemo(() => {
    if (!activeRange) return weeklyData;
    return weeklyData.filter((d) => d.week >= activeRange.min && d.week <= activeRange.max);
  }, [weeklyData, activeRange]);

  // Summary stats for displayed weeks (Total cases, Invoices, Rates)
  const summaryStats = useMemo(() => {
    let totMaiApprove = 0;
    let totMbiApprove = 0;
    let totMaiInv = 0;
    let totMbiInv = 0;
    let totReject = 0;

    for (const d of displayedWeeks) {
      totMaiApprove += d.maiApprove;
      totMbiApprove += d.mbiApprove;
      totMaiInv += d.maiInv;
      totMbiInv += d.mbiInv;
      totReject += d.totReject;
    }

    const totCases = totMaiApprove + totMbiApprove;
    const totInv = totMaiInv + totMbiInv;
    const maiRate = totMaiInv > 0 ? (totMaiApprove / totMaiInv) * 100 : 0;
    const mbiRate = totMbiInv > 0 ? (totMbiApprove / totMbiInv) * 100 : 0;
    const totRate = totInv > 0 ? (totCases / totInv) * 100 : 0;

    return {
      totMaiApprove,
      totMbiApprove,
      totCases,
      totMaiInv,
      totMbiInv,
      totInv,
      totReject,
      maiRate: Number(maiRate.toFixed(2)),
      mbiRate: Number(mbiRate.toFixed(2)),
      totRate: Number(totRate.toFixed(2)),
    };
  }, [displayedWeeks]);

  // Max case count for chart scaling (adaptive to displayed data)
  const maxCasesInChart = useMemo(() => {
    let m = 20;
    for (const d of displayedWeeks) {
      if (d.maiApprove > m) m = d.maiApprove;
      if (d.mbiApprove > m) m = d.mbiApprove;
    }
    return Math.max(20, Math.ceil(m / 10) * 10);
  }, [displayedWeeks]);

  // Dynamic Y-Axis steps
  const yAxisSteps = useMemo(() => {
    const step = Math.max(5, Math.ceil(maxCasesInChart / 5));
    const steps: number[] = [];
    for (let val = maxCasesInChart; val >= 0; val -= step) {
      steps.push(val);
    }
    if (!steps.includes(0)) steps.push(0);
    return steps;
  }, [maxCasesInChart]);

  // Modal cases
  const modalWeekData = useMemo(() => {
    if (!modalWeek) return null;
    return weeklyData.find((w) => w.week === modalWeek) || null;
  }, [modalWeek, weeklyData]);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            Filter Minggu:
          </label>
          <div className="relative">
            <select
              value={selectedWeekFilter}
              onChange={(e) => {
                setSelectedWeekFilter(e.target.value);
              }}
              className="appearance-none bg-zinc-100 dark:bg-slate-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold px-3 py-1.5 pr-8 rounded-xl border border-zinc-200 dark:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[270px] truncate"
            >
              <option value="all">Semua Minggu (W1 – W{maxAvailableWeek})</option>
              <option value="LAST_3" className="font-bold text-emerald-600 dark:text-emerald-400">
                ⚡ 3 Minggu Terakhir (W{Math.max(1, maxAvailableWeek - 2)} – W{maxAvailableWeek})
              </option>

              <optgroup label="── Rentang 3 Mingguan (3 Weeks) ──" className="font-bold text-zinc-500">
                {threeWeekBlocks.map((blk) => (
                  <option key={blk.id} value={blk.id} className="text-zinc-900 dark:text-white">
                    {blk.label}
                  </option>
                ))}
              </optgroup>

              <optgroup label="── Minggu Tunggal (Single Week) ──" className="font-bold text-zinc-500">
                {weeklyData.slice().reverse().map((d) => (
                  <option key={d.week} value={String(d.week)} className="text-zinc-900 dark:text-white">
                    W{d.week} {MILESTONES[d.week] ? `(${MILESTONES[d.week].text})` : ""}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Toggle Button: 3 Minggu Terakhir */}
          <button
            type="button"
            onClick={() => {
              setSelectedWeekFilter(selectedWeekFilter === "LAST_3" ? "all" : "LAST_3");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
              selectedWeekFilter === "LAST_3" || (selectedWeekFilter.startsWith("3W:") && selectedWeekFilter === `3W:${Math.max(1, maxAvailableWeek - 2)}-${maxAvailableWeek}`)
                ? "bg-emerald-600 text-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/30"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-slate-700"
            }`}
            title="Tampilkan data 3 minggu terakhir"
          >
            <Zap className={`w-3.5 h-3.5 ${selectedWeekFilter === "LAST_3" ? "text-amber-300 fill-amber-300" : "text-amber-500"}`} />
            <span>3 Minggu Terakhir</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span className="font-bold text-zinc-900 dark:text-white">{displayedWeeks.length}</span> minggu ditampilkan
          </div>
        </div>
      </div>

      {/* Summary KPI Cards for Displayed Weeks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
            TOTAL KASUS ({displayedWeeks.length} MINGGU)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
              {summaryStats.totCases}
            </span>
            <span className="text-xs text-zinc-500">
              kasus
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Reject Outlet:</span>
            <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
              {summaryStats.totReject}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block mb-1">
            MAI CASERATE
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-red-600 dark:text-red-400">
              {summaryStats.maiRate}%
            </span>
            <span className="text-xs text-zinc-500">
              ({summaryStats.totMaiApprove}/{summaryStats.totMaiInv.toLocaleString("id-ID")})
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Total Faktur MAI:</span>
            <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
              {summaryStats.totMaiInv.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
            MBI CASERATE
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {summaryStats.mbiRate}%
            </span>
            <span className="text-xs text-zinc-500">
              ({summaryStats.totMbiApprove}/{summaryStats.totMbiInv.toLocaleString("id-ID")})
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Total Faktur MBI:</span>
            <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
              {summaryStats.totMbiInv.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
            TOTAL ERROR RATE (COMBINED)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {summaryStats.totRate}%
            </span>
            <span className="text-xs text-zinc-500">
              tingkat kendala
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Total Faktur:</span>
            <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
              {summaryStats.totInv.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* Card 1: Cases per Minggu (Grouped Bar Chart) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="mb-4">
          <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
            Cases per Minggu
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Cases per minggu — {activeRange ? activeRange.label : `Semua Minggu (W1 – W${maxAvailableWeek})`}
          </p>
        </div>

        {/* Grouped Bar Chart */}
        <div className="overflow-x-auto pb-4 pt-8">
          <div className={`${displayedWeeks.length > 8 ? "min-w-[900px]" : "max-w-2xl mx-auto w-full"} h-64 relative flex items-end`}>
            {/* Y-Axis Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none border-b border-zinc-200 dark:border-slate-800">
              {yAxisSteps.map((y) => (
                <div key={y} className="flex items-center w-full">
                  <span className="text-[10px] text-zinc-400 font-mono w-6 text-right pr-2 select-none">
                    {y}
                  </span>
                  <div className="flex-1 border-t border-zinc-100 dark:border-slate-800/80" />
                </div>
              ))}
            </div>

            {/* Bars container */}
            <div className="relative z-10 flex-1 ml-7 flex items-end justify-between gap-1.5 h-full pb-0.5">
              {displayedWeeks.map((d) => {
                const maiH = (d.maiApprove / maxCasesInChart) * 100;
                const mbiH = (d.mbiApprove / maxCasesInChart) * 100;
                const hasMilestone = Boolean(d.milestone);
                const barMaxWidth = displayedWeeks.length <= 5 ? "max-w-[36px]" : "max-w-[12px]";

                return (
                  <div
                    key={d.week}
                    onClick={() => setModalWeek(d.week)}
                    className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                  >
                    {/* Pair of bars: MAI (red) and MBI (blue) */}
                    <div className="w-full flex items-end justify-center gap-1 h-[90%]">
                      {/* MAI Bar */}
                      <div className={`flex-1 flex flex-col items-center justify-end h-full ${barMaxWidth}`}>
                        <span className="text-[9px] font-bold text-red-500 leading-none mb-1 opacity-90 group-hover:opacity-100 font-mono">
                          {d.maiApprove}
                        </span>
                        <div
                          style={{ height: `${Math.max(maiH, d.maiApprove > 0 ? 3 : 1)}%` }}
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            d.maiApprove > 0
                              ? "bg-red-500 group-hover:bg-red-600"
                              : "bg-red-200 dark:bg-red-950/40"
                          }`}
                        />
                      </div>

                      {/* MBI Bar */}
                      <div className={`flex-1 flex flex-col items-center justify-end h-full ${barMaxWidth}`}>
                        <span className="text-[9px] font-bold text-blue-500 leading-none mb-1 opacity-90 group-hover:opacity-100 font-mono">
                          {d.mbiApprove}
                        </span>
                        <div
                          style={{ height: `${Math.max(mbiH, d.mbiApprove > 0 ? 3 : 1)}%` }}
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            d.mbiApprove > 0
                              ? "bg-blue-500 group-hover:bg-blue-600"
                              : "bg-blue-200 dark:bg-blue-950/40"
                          }`}
                        />
                      </div>
                    </div>

                    {/* X-axis Week Label */}
                    <span
                      className={`text-[10px] font-mono mt-1.5 transition-colors ${
                        hasMilestone
                          ? "font-black text-amber-600 dark:text-amber-400"
                          : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white"
                      }`}
                    >
                      W{d.week}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-slate-800 flex items-center justify-center gap-6 text-xs font-bold">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <span className="w-3.5 h-3.5 rounded-sm bg-red-500 inline-block" />
            <span>MAI Cases</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <span className="w-3.5 h-3.5 rounded-sm bg-blue-500 inline-block" />
            <span>MBI Cases</span>
          </div>
        </div>
      </div>

      {/* Card 2: Tabel Weekly */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="mb-4">
          <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Tabel Weekly</span>
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              👆 Klik baris untuk detail
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Filter: {activeRange ? activeRange.label : "Semua Minggu"} · klik baris untuk detail
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-slate-800 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">WEEK ↗</th>
                <th className="py-3 px-3 text-red-600 dark:text-red-400 font-bold">MAI APPROVE</th>
                <th className="py-3 px-3">MAI INV</th>
                <th className="py-3 px-3 text-red-600 dark:text-red-400 font-bold">MAI %</th>
                <th className="py-3 px-3 text-blue-600 dark:text-blue-400 font-bold">MBI APPROVE</th>
                <th className="py-3 px-3">MBI INV</th>
                <th className="py-3 px-3 text-blue-600 dark:text-blue-400 font-bold">MBI %</th>
                <th className="py-3 px-3 text-rose-600 dark:text-rose-400 font-bold">REJECT</th>
                <th className="py-3 px-3">EVENT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-slate-800 font-medium">
              {displayedWeeks.map((row) => (
                <tr
                  key={row.week}
                  onClick={() => setModalWeek(row.week)}
                  className="hover:bg-zinc-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                    W{row.week} ↗
                  </td>
                  <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                    {row.maiApprove}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-700 dark:text-zinc-300">
                    {row.maiInv.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-red-600 dark:text-red-400 font-bold">
                    {row.maiPct}%
                  </td>
                  <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                    {row.mbiApprove}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-700 dark:text-zinc-300">
                    {row.mbiInv.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 font-bold">
                    {row.mbiPct}%
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold">
                    {row.totReject > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{row.totReject}</span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.milestone ? (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${row.milestone.color}`}
                      >
                        {row.milestone.text}
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {displayedWeeks.length > 1 && (
              <tfoot className="border-t-2 border-zinc-300 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/80 font-bold text-xs">
                <tr>
                  <td className="py-2.5 px-3 uppercase tracking-wider font-extrabold text-zinc-800 dark:text-zinc-200">
                    TOTAL ({displayedWeeks.length} W)
                  </td>
                  <td className="py-2.5 px-3 font-mono font-black text-red-600 dark:text-red-400">
                    {summaryStats.totMaiApprove}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-700 dark:text-zinc-300">
                    {summaryStats.totMaiInv.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-black text-red-600 dark:text-red-400">
                    {summaryStats.maiRate}%
                  </td>
                  <td className="py-2.5 px-3 font-mono font-black text-blue-600 dark:text-blue-400">
                    {summaryStats.totMbiApprove}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-700 dark:text-zinc-300">
                    {summaryStats.totMbiInv.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-black text-blue-600 dark:text-blue-400">
                    {summaryStats.mbiRate}%
                  </td>
                  <td className="py-2.5 px-3 font-mono font-black text-rose-600 dark:text-rose-400">
                    {summaryStats.totReject > 0 ? summaryStats.totReject : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-500 text-[10px]">
                    Avg: {summaryStats.totRate}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Week Detail Modal */}
      {modalWeekData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-slate-800 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Detail Kasus Minggu W{modalWeekData.week}</span>
                  {modalWeekData.milestone && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${modalWeekData.milestone.color}`}
                    >
                      {modalWeekData.milestone.text}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Daftar laporan komplain dan shipment error pada minggu W{modalWeekData.week}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalWeek(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-slate-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick KPI stats in Modal */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 p-4 bg-zinc-50 dark:bg-slate-900/50 border-b border-zinc-200 dark:border-slate-800">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700">
                <span className="text-[10px] text-zinc-500 font-bold block">TOTAL KASUS</span>
                <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                  {modalWeekData.cases.length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                <span className="text-[10px] text-red-600 font-bold block">MAI APPROVE</span>
                <span className="text-lg font-bold font-mono text-red-600">
                  {modalWeekData.maiApprove}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                <span className="text-[10px] text-blue-600 font-bold block">MBI APPROVE</span>
                <span className="text-lg font-bold font-mono text-blue-600">
                  {modalWeekData.mbiApprove}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                <span className="text-[10px] text-rose-600 font-bold block">REJECT (OUTLET)</span>
                <span className="text-lg font-bold font-mono text-rose-600">
                  {modalWeekData.totReject}
                </span>
              </div>
            </div>

            {/* Modal Body Table */}
            <div className="overflow-y-auto flex-1 p-4">
              {modalWeekData.cases.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Tidak ada catatan kasus shipment error pada minggu ini.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-zinc-300 font-bold">
                      <th className="py-2.5 px-3">PBF</th>
                      <th className="py-2.5 px-3">No. Faktur</th>
                      <th className="py-2.5 px-3">Apotek / Outlet</th>
                      <th className="py-2.5 px-3">Nama Produk</th>
                      <th className="py-2.5 px-3">Jenis Masalah</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-slate-800 font-medium">
                    {modalWeekData.cases.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
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

            {/* Modal Footer */}
            <div className="p-3 border-t border-zinc-200 dark:border-slate-800 flex justify-end bg-zinc-50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setModalWeek(null)}
                className="px-4 py-1.5 rounded-xl border border-zinc-200 dark:border-slate-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
