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
        if (pbf.includes("MAI")) maiCases++;
        else mbiCases++;

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
    for (const rec of records) {
      const anyRec = rec as any;
      const pbfStr = (anyRec.pbf || anyRec.sourceFile || rec.invoiceNumber || "MBI").toUpperCase();
      if (pbfStr.includes("MAI")) maiInvoices++;
      else mbiInvoices++;
    }

    const totApproved = maiCases + mbiCases;
    const totInvoices = maiInvoices + mbiInvoices;
    const rateMAI = maiInvoices > 0 ? (maiCases / maiInvoices) * 100 : 0;
    const rateMBI = mbiInvoices > 0 ? (mbiCases / mbiInvoices) * 100 : 0;
    const rateTot = totInvoices > 0 ? (totApproved / totInvoices) * 100 : 0;

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
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Cases */}
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              TOTAL LAPORAN
            </span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-zinc-900 dark:text-white block">
              {stats.totCases}
            </span>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
              <span className="text-emerald-600 font-bold">{stats.totApproved} Approve</span>
              <span>·</span>
              <span className="text-rose-600 font-bold">{stats.reject} Reject</span>
            </div>
          </div>
        </div>

        {/* Card 2: MAI Error Rate */}
        <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              ERROR RATE MAI
            </span>
            <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">
              {stats.maiCases} Kasus
            </span>
          </div>
          <div>
            <span className="text-2xl font-black text-red-600 dark:text-red-400 block font-mono">
              {stats.rateMAI}%
            </span>
            <span className="text-[11px] text-red-500/80 block mt-1">
              Dari {stats.maiInvoices.toLocaleString("id-ID")} faktur terbit MAI
            </span>
          </div>
        </div>

        {/* Card 3: MBI Error Rate */}
        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              ERROR RATE MBI
            </span>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {stats.mbiCases} Kasus
            </span>
          </div>
          <div>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block font-mono">
              {stats.rateMBI}%
            </span>
            <span className="text-[11px] text-blue-500/80 block mt-1">
              Dari {stats.mbiInvoices.toLocaleString("id-ID")} faktur terbit MBI
            </span>
          </div>
        </div>

        {/* Card 4: Open vs Resolved */}
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              STATUS PENYELESAIAN
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-zinc-900 dark:text-white block font-mono">
              {stats.totApproved > 0
                ? ((stats.resolved / stats.totApproved) * 100).toFixed(0)
                : 0}%
            </span>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
              <span className="text-emerald-600 font-bold">{stats.resolved} Selesai</span>
              <span>·</span>
              <span className="text-amber-600 font-bold">{stats.inProgress} In Progress</span>
            </div>
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
