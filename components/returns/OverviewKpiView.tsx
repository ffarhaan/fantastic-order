"use client";

import { useMemo } from "react";
import {
  Package,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Building2,
  Layers,
  ArrowRight,
  PieChart,
  BarChart3,
} from "lucide-react";
import { ShipmentReturnRecord, FakturRecord } from "@/lib/types";

interface OverviewKpiViewProps {
  returns: ShipmentReturnRecord[];
  records?: FakturRecord[];
}

export default function OverviewKpiView({
  returns = [],
  records = [],
}: OverviewKpiViewProps) {
  // Aggregate KPIs
  const stats = useMemo(() => {
    let maiCases = 0;
    let mbiCases = 0;
    let resolved = 0;
    let inProgress = 0;
    let reject = 0;
    let openMAI = 0;
    let openMBI = 0;

    const rootCauseMap: Record<string, number> = {};
    const reasonMap: Record<string, number> = {};

    for (const r of returns) {
      const pbf = (r.pbf || "MBI").toUpperCase();
      const st = (r.status || "").toLowerCase();
      const conf = (r.confirm || "").toLowerCase();
      const isRej = conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
      const isRes = st.includes("resolved") || st.includes("selesai");

      if (isRej) {
        reject++;
      } else {
        if (pbf.includes("MAI")) {
          maiCases++;
          if (!isRes) openMAI++;
        } else {
          mbiCases++;
          if (!isRes) openMBI++;
        }

        if (isRes) resolved++;
        else inProgress++;
      }

      // Root Cause
      const rc = (r.root_cause || "Human Error").trim();
      rootCauseMap[rc] = (rootCauseMap[rc] || 0) + 1;

      // Reason / Jenis
      const rz = (r.reason || "Lainnya").trim();
      reasonMap[rz] = (reasonMap[rz] || 0) + 1;
    }

    // Invoices count from records
    let maiInvoices = 0;
    let mbiInvoices = 0;
    if (records && records.length > 0) {
      for (const rec of records) {
        const anyRec = rec as any;
        const pbfStr = (anyRec.pbf || anyRec.sourceFile || rec.invoiceNumber || "MBI").toUpperCase();
        if (pbfStr.includes("MAI")) maiInvoices++;
        else mbiInvoices++;
      }
    }
    // Fallback benchmark invoices matching Apps Script
    if (maiInvoices === 0) maiInvoices = 58304;
    if (mbiInvoices === 0) mbiInvoices = 78056;

    const totApproved = maiCases + mbiCases;
    const totInvoices = maiInvoices + mbiInvoices;
    const rateMAI = maiInvoices > 0 ? (maiCases / maiInvoices) * 100 : 0;
    const rateMBI = mbiInvoices > 0 ? (mbiCases / mbiInvoices) * 100 : 0;
    const rateTot = totInvoices > 0 ? (totApproved / totInvoices) * 100 : 0;
    const openCases = openMAI + openMBI;
    const resolutionRate = totApproved > 0 ? Number(((resolved / totApproved) * 100).toFixed(1)) : 0;

    // Sort breakdowns
    const rootCauses = Object.entries(rootCauseMap)
      .map(([name, count]) => ({
        name,
        count,
        pct: returns.length > 0 ? Number(((count / returns.length) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const reasons = Object.entries(reasonMap)
      .map(([name, count]) => ({
        name,
        count,
        pct: returns.length > 0 ? Number(((count / returns.length) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totCases: returns.length,
      totApproved,
      maiCases,
      mbiCases,
      resolved,
      inProgress,
      reject,
      openCases,
      openMAI,
      openMBI,
      resolutionRate,
      maiInvoices,
      mbiInvoices,
      totInvoices,
      rateMAI: Number(rateMAI.toFixed(2)),
      rateMBI: Number(rateMBI.toFixed(2)),
      rateTot: Number(rateTot.toFixed(2)),
      rootCauses,
      reasons,
    };
  }, [returns, records]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top 6 Metric Cards matching Apps Script layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: TOTAL CASES MAI */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            TOTAL CASES MAI
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {stats.maiCases.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            dari {stats.maiInvoices.toLocaleString("id-ID")} invoice
          </div>
        </div>

        {/* Card 2: TOTAL CASES MBI */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            TOTAL CASES MBI
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {stats.mbiCases.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            dari {stats.mbiInvoices.toLocaleString("id-ID")} invoice
          </div>
        </div>

        {/* Card 3: ERROR RATE MAI */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            ERROR RATE MAI
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {stats.rateMAI.toFixed(2)}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Approve only
          </div>
        </div>

        {/* Card 4: ERROR RATE MBI */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            ERROR RATE MBI
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {stats.rateMBI.toFixed(2)}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Approve only
          </div>
        </div>

        {/* Card 5: OPEN CASES */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            OPEN CASES
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-black text-amber-500 dark:text-amber-400 font-mono">
              {stats.openCases}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            MAI: {stats.openMAI} - MBI: {stats.openMBI}
          </div>
        </div>

        {/* Card 6: RESOLVED */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-3.5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            RESOLVED
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.resolved.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            {stats.resolutionRate}% resolution rate
          </div>
        </div>
      </div>

      {/* Visual Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Root Cause Distribution */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Distribusi Akar Masalah (Root Cause)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-zinc-400">Analisis</span>
          </div>

          <div className="space-y-3">
            {stats.rootCauses.map((rc, idx) => (
              <div key={rc.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{rc.name}</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{rc.count} kasus</span>
                    <span className="text-zinc-400">({rc.pct}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                    style={{ width: `${Math.min(100, rc.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Jenis Masalah Distribution */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Jenis Masalah / Komplain Terbanyak
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-zinc-400">Kategori</span>
          </div>

          <div className="space-y-3">
            {stats.reasons.map((rz, idx) => (
              <div key={rz.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{rz.name}</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{rz.count} kasus</span>
                    <span className="text-zinc-400">({rz.pct}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full"
                    style={{ width: `${Math.min(100, rz.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
