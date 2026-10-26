"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  PieChart,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { ShipmentReturnRecord } from "@/lib/types";

interface AnalisisViewProps {
  returns: ShipmentReturnRecord[];
}

// Colors matching Apps Script chart
const COLOR_PALETTE = [
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#a855f7", // Purple
  "#f97316", // Orange
  "#10b981", // Emerald
  "#eab308", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
];

// Helper to calculate SVG donut slice path
function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  startAngle: number,
  endAngle: number
) {
  const angleDiff = Math.min(endAngle - startAngle, 359.99);
  const effectiveEnd = startAngle + angleDiff;
  const largeArcFlag = angleDiff <= 180 ? "0" : "1";

  const p1 = polarToCartesian(cx, cy, rOut, effectiveEnd);
  const p2 = polarToCartesian(cx, cy, rOut, startAngle);
  const p3 = polarToCartesian(cx, cy, rIn, startAngle);
  const p4 = polarToCartesian(cx, cy, rIn, effectiveEnd);

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOut} ${rOut} 0 ${largeArcFlag} 0 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rIn} ${rIn} 0 ${largeArcFlag} 1 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

export default function AnalisisView({ returns = [] }: AnalisisViewProps) {
  // Aggregate data by PBF
  const stats = useMemo(() => {
    const hasLiveReturns = returns && returns.length > 0;

    const defaultMaiReasons: Record<string, number> = {
      "Fisik yang dikirim kurang": 30,
      "Fisik yang dikirim salah": 22,
      "Fisik yang dikirim tidak ada": 8,
      "Fisik yang dikirim lebih": 5,
    };
    const defaultMaiRoots: Record<string, number> = {
      "Human Error": 62,
      "Delivery Issue": 1,
      "Tidak Diketahui": 1,
      "Ops Issue": 1,
    };
    const defaultMbiReasons: Record<string, number> = {
      "Fisik yang dikirim salah": 624,
      "Fisik yang dikirim kurang": 429,
      "Fisik yang dikirim lebih": 195,
      "Fisik yang dikirim tidak ada": 156,
    };
    const defaultMbiRoots: Record<string, number> = {
      "Human Error": 1311,
      "Ops Issue": 47,
      "Oracle Issue": 43,
      "Delivery Issue": 2,
      "System Issue": 1,
    };

    const mai = {
      reasons: (hasLiveReturns ? {} : { ...defaultMaiReasons }) as Record<string, number>,
      roots: (hasLiveReturns ? {} : { ...defaultMaiRoots }) as Record<string, number>,
      totalApproved: hasLiveReturns ? 0 : 65,
    };
    const mbi = {
      reasons: (hasLiveReturns ? {} : { ...defaultMbiReasons }) as Record<string, number>,
      roots: (hasLiveReturns ? {} : { ...defaultMbiRoots }) as Record<string, number>,
      totalApproved: hasLiveReturns ? 0 : 1404,
    };

    if (hasLiveReturns) {
      for (const r of returns) {
        const pbf = (r.pbf || "MBI").toUpperCase();
        const target = pbf.includes("MAI") ? mai : mbi;
        target.totalApproved++;

        // Reason / Jenis Error
        let rz = (r.reason || "Lainnya").trim();
        if (!rz || rz === "-" || rz === "#N/A") rz = "Lainnya";
        target.reasons[rz] = (target.reasons[rz] || 0) + 1;

        // Root Cause
        let rc = (r.root_cause || "Human error").trim();
        if (!rc || rc === "-" || rc === "#N/A") rc = "Tidak Diketahui";
        const normalizedRc = rc.charAt(0).toUpperCase() + rc.slice(1);
        target.roots[normalizedRc] = (target.roots[normalizedRc] || 0) + 1;
      }
    }

    const formatList = (recordMap: Record<string, number>, limit = 6) => {
      const total = Object.values(recordMap).reduce((a, b) => a + b, 0);
      return Object.entries(recordMap)
        .map(([name, count], index) => ({
          name,
          count,
          pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
          color: COLOR_PALETTE[index % COLOR_PALETTE.length],
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    };

    return {
      mai: {
        total: mai.totalApproved,
        reasons: formatList(mai.reasons, 5),
        roots: formatList(mai.roots, 6),
      },
      mbi: {
        total: mbi.totalApproved,
        reasons: formatList(mbi.reasons, 5),
        roots: formatList(mbi.roots, 6),
      },
    };
  }, [returns]);

  // Render SVG Donut
  const renderDonut = (items: { name: string; count: number; pct: number; color: string }[], totalCount: number) => {
    if (items.length === 0 || totalCount === 0) {
      return (
        <div className="h-56 flex items-center justify-center text-xs text-zinc-400">
          Belum ada data distribusi
        </div>
      );
    }

    let currentAngle = 0;
    const slices = items.map((item) => {
      const sliceAngle = (item.count / totalCount) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      // Position for label inside slice
      const midAngle = startAngle + sliceAngle / 2;
      const labelPos = polarToCartesian(120, 120, 78, midAngle);

      return {
        ...item,
        path: describeDonutSlice(120, 120, 95, 55, startAngle, endAngle),
        labelPos,
        showLabel: item.pct >= 4,
      };
    });

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <svg viewBox="0 0 240 240" className="w-full h-full transform -rotate-90">
            {slices.map((s, idx) => (
              <path
                key={idx}
                d={s.path}
                fill={s.color}
                className="transition-all duration-300 hover:opacity-85 cursor-pointer"
              >
                <title>{`${s.name}: ${s.count} (${s.pct}%)`}</title>
              </path>
            ))}
          </svg>

          {/* Slices count labels overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {slices.map((s, idx) =>
              s.showLabel ? (
                <span
                  key={idx}
                  style={{
                    left: `${(s.labelPos.x / 240) * 100}%`,
                    top: `${(s.labelPos.y / 240) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold text-white drop-shadow-md font-mono"
                >
                  {s.count}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-2 px-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
              <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate max-w-[150px]">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Horizontal Bar Chart for Root Causes
  const renderHorizontalBars = (
    items: { name: string; count: number; pct: number }[],
    barColor: string,
    maxScale: number
  ) => {
    return (
      <div className="h-full flex flex-col justify-between py-2">
        <div className="space-y-4">
          {items.map((item, idx) => {
            const barWidth = Math.max(1, (item.count / maxScale) * 100);
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                    {item.name}
                  </span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">
                    {item.count.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                    className="h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis ticks */}
        <div className="pt-4 border-t border-zinc-100 dark:border-slate-800 flex justify-between text-[10px] text-zinc-400 font-mono">
          <span>0</span>
          <span>{Math.round(maxScale * 0.25).toLocaleString("id-ID")}</span>
          <span>{Math.round(maxScale * 0.5).toLocaleString("id-ID")}</span>
          <span>{Math.round(maxScale * 0.75).toLocaleString("id-ID")}</span>
          <span>{maxScale.toLocaleString("id-ID")}</span>
        </div>
      </div>
    );
  };

  const maiMaxRoot = useMemo(() => {
    const maxVal = Math.max(...stats.mai.roots.map((r) => r.count), 10);
    return Math.ceil(maxVal / 10) * 10;
  }, [stats.mai.roots]);

  const mbiMaxRoot = useMemo(() => {
    const maxVal = Math.max(...stats.mbi.roots.map((r) => r.count), 100);
    return Math.ceil(maxVal / 200) * 200;
  }, [stats.mbi.roots]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* =========================================
          SECTION 1: BREAKDOWN MAI
      ========================================= */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-red-500 rounded-full" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
            Breakdown MAI
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold">
            PT Medika Akses Investama
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card: Jenis Error MAI */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Jenis Error
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800">
                    MAI
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Distribusi tipe kesalahan — semua periode
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500">
                Total: {stats.mai.total}
              </span>
            </div>

            {renderDonut(stats.mai.reasons, stats.mai.total)}
          </div>

          {/* Card: Root Cause MAI */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Root Cause
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800">
                    MAI
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Akar penyebab
                </p>
              </div>
            </div>

            {renderHorizontalBars(stats.mai.roots, "#ef4444", maiMaxRoot)}
          </div>
        </div>
      </div>

      {/* =========================================
          SECTION 2: BREAKDOWN MBI
      ========================================= */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
            Breakdown MBI
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
            PT Medika Bina Investama
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card: Jenis Error MBI */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Jenis Error
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800">
                    MBI
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Distribusi tipe kesalahan — semua periode
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500">
                Total: {stats.mbi.total}
              </span>
            </div>

            {renderDonut(stats.mbi.reasons, stats.mbi.total)}
          </div>

          {/* Card: Root Cause MBI */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Root Cause
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800">
                    MBI
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Akar penyebab
                </p>
              </div>
            </div>

            {renderHorizontalBars(stats.mbi.roots, "#3b82f6", mbiMaxRoot)}
          </div>
        </div>
      </div>

      {/* =========================================
          SECTION 3: REKOMENDASI
      ========================================= */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Rekomendasi</span>
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rekomendasi 1 */}
            <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-2">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs">
                <span className="w-5 h-5 rounded-full bg-red-200 dark:bg-red-900/80 flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Prioritas Human Error ({">"}90%)</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Mayoritas shipment error berasal dari faktor kelalaian manusia pada tahap picking dan packing. Wajibkan pemindaian barcode fisik tiap barang pada pos QC2 sebelum barang dimasukkan ke kardus pengiriman.
              </p>
            </div>

            {/* Rekomendasi 2 */}
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs">
                <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-900/80 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Mitigasi Kemasan Serupa (LASA)</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Pada MBI, tipe kesalahan &quot;Fisik yang dikirim salah&quot; dan &quot;Fisik kurang&quot; mendominasi. Berikan pemisah rak khusus untuk obat fast-moving berpenampilan mirip serta stiker penanda dosis kontras.
              </p>
            </div>

            {/* Rekomendasi 3 */}
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-2">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold text-xs">
                <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-900/80 flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Sinkronisasi Oracle & Ops</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Tercatat 90+ insiden terkait sistem dan operasional di MBI. Lakukan sinkronisasi master konversi satuan (strip/box/botol) antara sistem WMS dan Oracle sebelum faktur dicetak.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
