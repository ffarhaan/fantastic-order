"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Lightbulb,
  Calendar,
  CalendarRange,
  Filter,
  RotateCcw,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { ShipmentReturnRecord } from "@/lib/types";
import { parsePersonNames } from "@/lib/personnelUtils";

// 4 Kategori Kendala Fisik Utama Pengiriman (Zero-Assumption & Non-Destructive)
export const PRIMARY_4_PHYSICAL_REASONS = [
  "Fisik yang dikirim kurang",
  "Fisik yang dikirim lebih",
  "Fisik yang dikirim salah",
  "Fisik yang dikirim tidak ada",
] as const;

export type ReasonFilterScope =
  | "ALL"
  | "PRIMARY_4"
  | "Fisik yang dikirim kurang"
  | "Fisik yang dikirim lebih"
  | "Fisik yang dikirim salah"
  | "Fisik yang dikirim tidak ada"
  | "OTHER";

export function parseWeekFilterRange(
  val: string,
  maxWeek: number
): { min: number; max: number; label: string } | null {
  if (!val || val === "ALL") return null;

  if (val === "LAST_3") {
    const start = Math.max(1, maxWeek - 2);
    return {
      min: start,
      max: maxWeek,
      label: `3 Minggu Terakhir (W${start} – W${maxWeek})`,
    };
  }

  if (val.startsWith("3W:") || val.includes("-")) {
    const clean = val.replace(/^3W:/i, "");
    const parts = clean.split("-");
    const n1 = parseInt(parts[0], 10);
    const n2 = parseInt(parts[1], 10);
    if (!isNaN(n1) && !isNaN(n2) && n1 > 0 && n2 > 0) {
      const min = Math.min(n1, n2);
      const max = Math.max(n1, n2);
      return {
        min,
        max,
        label: `Rentang 3 Minggu (W${min} – W${max})`,
      };
    }
  }

  const single = parseInt(val.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(single) && single > 0) {
    return {
      min: single,
      max: single,
      label: `Week W${single}`,
    };
  }

  return null;
}

interface AnalisisViewProps {
  returns: ShipmentReturnRecord[];
  selectedMonth?: string;
  selectedWeek?: string;
  onMonthChange?: (month: string) => void;
  onWeekChange?: (week: string) => void;
  onSelectPerson?: (person: string) => void;
}

const MONTH_NAMES: Record<number, string> = {
  1: "Januari 2026",
  2: "Februari 2026",
  3: "Maret 2026",
  4: "April 2026",
  5: "Mei 2026",
  6: "Juni 2026",
  7: "Juli 2026",
  8: "Agustus 2026",
  9: "September 2026",
  10: "Oktober 2026",
  11: "November 2026",
  12: "Desember 2026",
};

// Consistent semantic colors per error reason + fallback palette
const REASON_COLOR_MAP: Record<string, string> = {
  "Fisik yang dikirim kurang": "#10b981", // Emerald Green
  "Fisik yang dikirim salah": "#f97316", // Orange
  "ED kurang dari 1 tahun": "#3b82f6", // Blue
  "Fisik yang dikirim tidak ada": "#a855f7", // Purple
  "Fisik yang dikirim lebih": "#eab308", // Amber / Yellow
  "Damage On Delivery": "#06b6d4", // Cyan
  "Produk rusak (berubah warna/berbau/kapsul bocor)": "#ec4899", // Pink
  "Recall": "#ef4444", // Red
  "Retur admin salah SKU": "#6366f1", // Indigo
};

const COLOR_PALETTE = [
  "#10b981", // Emerald
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#a855f7", // Purple
  "#eab308", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#ef4444", // Red
  "#6366f1", // Indigo
  "#14b8a6", // Teal
];

function extractMonthFromRecord(r: ShipmentReturnRecord): number {
  const m = r.month ? Number(r.month) : 0;
  if (m >= 1 && m <= 12) return m;
  const dateStr = r.report_date || r.invoice_date || r.created_at || "";
  if (dateStr) {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parsed = parseInt(dateStr.slice(5, 7), 10);
      if (parsed >= 1 && parsed <= 12) return parsed;
    } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(dateStr)) {
      const parts = dateStr.split(/[\/\-]/);
      const parsed = parseInt(parts[1], 10);
      if (parsed >= 1 && parsed <= 12) return parsed;
    }
  }
  return 0;
}

function extractWeekFromRecord(r: ShipmentReturnRecord): number {
  if (r.week) {
    const wNum = Number(String(r.week).replace(/[^0-9]/g, ""));
    if (!isNaN(wNum) && wNum > 0) return wNum;
  }
  return 0;
}

function normalizeReasonName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed === "-" || trimmed === "#N/A") return "Lainnya";
  const lower = trimmed.toLowerCase();
  if (lower === "recall") return "Recall";
  if (lower === "retur admin salah sku") return "Retur admin salah SKU";
  if (lower === "fisik yang dikirim kurang") return "Fisik yang dikirim kurang";
  if (lower === "fisik yang dikirim salah") return "Fisik yang dikirim salah";
  if (lower === "fisik yang dikirim tidak ada") return "Fisik yang dikirim tidak ada";
  if (lower === "fisik yang dikirim lebih") return "Fisik yang dikirim lebih";
  if (lower === "ed kurang dari 1 tahun") return "ED kurang dari 1 tahun";
  if (lower === "damage on delivery") return "Damage On Delivery";
  return trimmed;
}

function normalizeRootCauseName(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed === "-" || trimmed === "#N/A" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "none") {
    return "Belum Diisi";
  }
  const lower = trimmed.toLowerCase();
  if (lower === "human error") return "Human Error";
  if (lower === "oracle issue") return "Oracle Issue";
  if (lower === "ops issue") return "Ops Issue";
  if (lower === "delivery issue") return "Delivery Issue";
  if (lower === "vendor issue") return "Vendor Issue";
  if (lower === "system issue") return "System Issue";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Helper to calculate SVG donut slice path (0 degrees = 12 o'clock top)
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

export default function AnalisisView({
  returns = [],
  selectedMonth: propMonth,
  selectedWeek: propWeek,
  onMonthChange,
  onWeekChange,
  onSelectPerson,
}: AnalisisViewProps) {
  const [localMonth, setLocalMonth] = useState<string>("ALL");
  const [localWeek, setLocalWeek] = useState<string>("ALL");
  const [statusScope, setStatusScope] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECT">("ALL");
  const [reasonScope, setReasonScope] = useState<ReasonFilterScope>("ALL");

  const activeMonth = propMonth !== undefined ? propMonth : localMonth;
  const activeWeek = propWeek !== undefined ? propWeek : localWeek;

  const handleMonthSelect = (val: string) => {
    setLocalMonth(val);
    if (onMonthChange) onMonthChange(val);
  };

  const handleWeekSelect = (val: string) => {
    setLocalWeek(val);
    if (onWeekChange) onWeekChange(val);
  };

  // Compute counts per month and available weeks from real returns data
  const { monthCounts, weekCounts, availableWeeksList } = useMemo(() => {
    const mCounts: Record<number, number> = {};
    const wCounts: Record<number, number> = {};
    const weeksSet = new Set<number>();

    const filterM = activeMonth !== "ALL" ? Number(activeMonth) : 0;

    for (const r of returns) {
      const m = extractMonthFromRecord(r);
      const w = extractWeekFromRecord(r);

      if (m >= 1 && m <= 12) {
        mCounts[m] = (mCounts[m] || 0) + 1;
      }
      if (w > 0) {
        weeksSet.add(w);
        if (!filterM || m === filterM) {
          wCounts[w] = (wCounts[w] || 0) + 1;
        }
      }
    }

    const maxWeek = Math.max(45, ...Array.from(weeksSet));
    const list: number[] = [];
    for (let w = maxWeek; w >= 1; w--) {
      if (weeksSet.has(w) || w <= 45) {
        list.push(w);
      }
    }

    return {
      monthCounts: mCounts,
      weekCounts: wCounts,
      availableWeeksList: list,
    };
  }, [returns, activeMonth]);

  // Compute 3-Week Blocks (Windows) from available weeks with accurate case counts
  const threeWeekBlocks = useMemo(() => {
    const maxW = availableWeeksList[0] || 45;
    const filterM = activeMonth !== "ALL" ? Number(activeMonth) : 0;
    const blocks: { id: string; min: number; max: number; label: string; count: number }[] = [];

    for (let end = maxW; end >= 1; end -= 3) {
      const start = Math.max(1, end - 2);
      let count = 0;
      for (const r of returns) {
        if (filterM > 0 && extractMonthFromRecord(r) !== filterM) continue;
        const w = extractWeekFromRecord(r);
        if (w >= start && w <= end) count++;
      }
      blocks.push({
        id: `3W:${start}-${end}`,
        min: start,
        max: end,
        label: `W${start} – W${end} (3 Minggu)`,
        count,
      });
    }
    return blocks;
  }, [availableWeeksList, returns, activeMonth]);

  // Real-time live counts for 4 Primary Physical Error pills under active Month, Week & Status
  const reasonCounts = useMemo(() => {
    const filterM = activeMonth !== "ALL" ? Number(activeMonth) : 0;
    const weekRange = parseWeekFilterRange(activeWeek, availableWeeksList[0] || 45);

    let all = 0;
    let primary4 = 0;
    let kurang = 0;
    let lebih = 0;
    let salah = 0;
    let tidakAda = 0;
    let other = 0;

    for (const r of returns) {
      if (filterM > 0 && extractMonthFromRecord(r) !== filterM) continue;
      if (weekRange) {
        const w = extractWeekFromRecord(r);
        if (w < weekRange.min || w > weekRange.max) continue;
      }

      const st = (r.status || "").toLowerCase().trim();
      const conf = (r.confirm || "").toLowerCase().trim();
      const isRej = conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
      const isRes = st.includes("resolved") || st.includes("selesai");
      const isInProg = st.includes("in progress");
      const isPending = !isRej && !isRes && !isInProg;

      if (statusScope === "PENDING" && !isPending) continue;
      if (statusScope === "IN_PROGRESS" && !isInProg) continue;
      if (statusScope === "RESOLVED" && !isRes) continue;
      if (statusScope === "REJECT" && !isRej) continue;

      all++;
      const rz = normalizeReasonName(r.reason);
      if (rz === "Fisik yang dikirim kurang") {
        kurang++;
        primary4++;
      } else if (rz === "Fisik yang dikirim lebih") {
        lebih++;
        primary4++;
      } else if (rz === "Fisik yang dikirim salah") {
        salah++;
        primary4++;
      } else if (rz === "Fisik yang dikirim tidak ada") {
        tidakAda++;
        primary4++;
      } else {
        other++;
      }
    }

    return {
      all,
      primary4,
      "Fisik yang dikirim kurang": kurang,
      "Fisik yang dikirim lebih": lebih,
      "Fisik yang dikirim salah": salah,
      "Fisik yang dikirim tidak ada": tidakAda,
      other,
    };
  }, [returns, activeMonth, activeWeek, statusScope, availableWeeksList]);

  // Single source of truth: rows matching active Month, Week (including 3-week range), Status, and Reason filters
  const filteredReturns = useMemo(() => {
    const filterM = activeMonth !== "ALL" ? Number(activeMonth) : 0;
    const weekRange = parseWeekFilterRange(activeWeek, availableWeeksList[0] || 45);

    return returns.filter((r) => {
      // 1. Month filter
      if (filterM > 0 && extractMonthFromRecord(r) !== filterM) return false;

      // 2. Week filter (supporting Single Week, Rolling 3 Weeks, or 3-Week Windows)
      if (weekRange) {
        const w = extractWeekFromRecord(r);
        if (w < weekRange.min || w > weekRange.max) return false;
      }

      // 3. Status filter
      const st = (r.status || "").toLowerCase().trim();
      const conf = (r.confirm || "").toLowerCase().trim();
      const isRej = conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
      const isRes = st.includes("resolved") || st.includes("selesai");
      const isInProg = st.includes("in progress");
      const isPending = !isRej && !isRes && !isInProg;

      if (statusScope === "PENDING" && !isPending) return false;
      if (statusScope === "IN_PROGRESS" && !isInProg) return false;
      if (statusScope === "RESOLVED" && !isRes) return false;
      if (statusScope === "REJECT" && !isRej) return false;

      // 4. Reason filter (4 Kendala Fisik Utama: Kurang, Lebih, Salah, Tidak Ada)
      const rz = normalizeReasonName(r.reason);
      if (reasonScope === "PRIMARY_4") {
        if (!PRIMARY_4_PHYSICAL_REASONS.includes(rz as any)) return false;
      } else if (reasonScope === "OTHER") {
        if (PRIMARY_4_PHYSICAL_REASONS.includes(rz as any)) return false;
      } else if (reasonScope !== "ALL") {
        if (rz !== reasonScope) return false;
      }

      return true;
    });
  }, [returns, activeMonth, activeWeek, statusScope, reasonScope, availableWeeksList]);

  // Aggregate real data by PBF according to active Month, Week, and Status filters
  const stats = useMemo(() => {
    const mai = {
      reasons: {} as Record<string, number>,
      roots: {} as Record<string, number>,
      total: 0,
      resolvedCount: 0,
      inProgressCount: 0,
      pendingCount: 0,
      rejectCount: 0,
    };
    const mbi = {
      reasons: {} as Record<string, number>,
      roots: {} as Record<string, number>,
      total: 0,
      resolvedCount: 0,
      inProgressCount: 0,
      pendingCount: 0,
      rejectCount: 0,
    };

    for (const r of filteredReturns) {
      const st = (r.status || "").toLowerCase().trim();
      const conf = (r.confirm || "").toLowerCase().trim();
      const isRej = conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
      const isRes = st.includes("resolved") || st.includes("selesai");
      const isInProg = st.includes("in progress");

      const pbf = (r.pbf || "MBI").toUpperCase();
      const target = pbf.includes("MAI") ? mai : mbi;
      target.total++;
      if (isRej) {
        target.rejectCount++;
      } else if (isRes) {
        target.resolvedCount++;
      } else if (isInProg) {
        target.inProgressCount++;
      } else {
        target.pendingCount++;
      }

      // 1. Reason / Jenis Error (100% Real Data)
      const rz = normalizeReasonName(r.reason);
      target.reasons[rz] = (target.reasons[rz] || 0) + 1;

      // 2. Root Cause (100% Real Data — empty root_cause is labeled Belum Diisi)
      const rc = normalizeRootCauseName(r.root_cause);
      target.roots[rc] = (target.roots[rc] || 0) + 1;
    }

    const formatReasons = (recordMap: Record<string, number>) => {
      const total = Object.values(recordMap).reduce((a, b) => a + b, 0);
      return Object.entries(recordMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], index) => ({
          name,
          count,
          pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
          color: REASON_COLOR_MAP[name] || COLOR_PALETTE[index % COLOR_PALETTE.length],
        }));
    };

    const formatRoots = (recordMap: Record<string, number>) => {
      const total = Object.values(recordMap).reduce((a, b) => a + b, 0);
      return Object.entries(recordMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          count,
          pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
        }));
    };

    return {
      mai: {
        total: mai.total,
        resolvedCount: mai.resolvedCount,
        inProgressCount: mai.inProgressCount,
        pendingCount: mai.pendingCount,
        rejectCount: mai.rejectCount,
        reasons: formatReasons(mai.reasons),
        roots: formatRoots(mai.roots),
      },
      mbi: {
        total: mbi.total,
        resolvedCount: mbi.resolvedCount,
        inProgressCount: mbi.inProgressCount,
        pendingCount: mbi.pendingCount,
        rejectCount: mbi.rejectCount,
        reasons: formatReasons(mbi.reasons),
        roots: formatRoots(mbi.roots),
      },
    };
  }, [filteredReturns]);

  // Personnel breakdown (full names, same parser as Personil tab) on the filtered rows
  const personnel = useMemo(() => {
    type Entry = {
      person: string;
      total: number;
      mai: number;
      mbi: number;
      resolved: number;
      open: number;
      reject: number;
      variants: Map<string, number>;
    };
    const map = new Map<string, Entry>();
    let unassigned = 0;
    let unassignedMai = 0;
    let unassignedMbi = 0;

    for (const r of filteredReturns) {
      const pbf = (r.pbf || "MBI").toUpperCase();
      const isMai = pbf.includes("MAI");
      const st = (r.status || "").toLowerCase();
      const conf = (r.confirm || "").toLowerCase();
      const isRej = conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
      const isRes = st.includes("resolved") || st.includes("selesai");

      const rawPerson = String(r.person || "").trim();
      const names = parsePersonNames(rawPerson);
      if (names.length === 0) {
        unassigned++;
        if (isMai) unassignedMai++;
        else unassignedMbi++;
        continue;
      }

      for (const name of names) {
        let e = map.get(name);
        if (!e) {
          e = { person: name, total: 0, mai: 0, mbi: 0, resolved: 0, open: 0, reject: 0, variants: new Map() };
          map.set(name, e);
        }
        e.total++;
        if (isMai) e.mai++;
        else e.mbi++;
        if (isRej) e.reject++;
        else if (isRes) e.resolved++;
        else e.open++;
        e.variants.set(rawPerson, (e.variants.get(rawPerson) || 0) + 1);
      }
    }

    const list = Array.from(map.values())
      .sort((a, b) => b.total - a.total || a.person.localeCompare(b.person))
      .map((e) => ({
        ...e,
        variantList: Array.from(e.variants.entries()).sort((a, b) => b[1] - a[1]),
      }));

    return { list, unassigned, unassignedMai, unassignedMbi };
  }, [filteredReturns]);

  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelPbf, setPersonnelPbf] = useState<"ALL" | "MBI" | "MAI">("ALL");
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const visiblePersonnel = useMemo(() => {
    const q = personnelSearch.trim().toUpperCase();
    return personnel.list
      .filter((p) => (personnelPbf === "MAI" ? p.mai > 0 : personnelPbf === "MBI" ? p.mbi > 0 : true))
      .filter((p) => !q || p.person.includes(q) || p.variantList.some(([v]) => v.toUpperCase().includes(q)))
      .map((p) => ({
        ...p,
        shown: personnelPbf === "MAI" ? p.mai : personnelPbf === "MBI" ? p.mbi : p.total,
      }))
      .sort((a, b) => b.shown - a.shown || a.person.localeCompare(b.person));
  }, [personnel.list, personnelSearch, personnelPbf]);

  const maxPersonCases = Math.max(1, ...visiblePersonnel.map((p) => p.shown));

  const activePeriodLabel = useMemo(() => {
    const parts: string[] = [];
    if (activeMonth !== "ALL") {
      parts.push(MONTH_NAMES[Number(activeMonth)] || `Bulan ${activeMonth}`);
    }
    if (activeWeek !== "ALL") {
      const rng = parseWeekFilterRange(activeWeek, availableWeeksList[0] || 45);
      if (rng) {
        parts.push(rng.label);
      }
    }
    if (reasonScope !== "ALL") {
      if (reasonScope === "PRIMARY_4") {
        parts.push("⭐ 4 Kendala Fisik Utama");
      } else if (reasonScope === "OTHER") {
        parts.push("Kendala Lainnya");
      } else {
        parts.push(reasonScope);
      }
    }
    if (statusScope !== "ALL") {
      const scopeLabels: Record<string, string> = {
        PENDING: "Status Pending",
        IN_PROGRESS: "Status In Progress",
        RESOLVED: "Status Resolved",
        REJECT: "Status Reject",
      };
      parts.push(scopeLabels[statusScope] || statusScope);
    }
    return parts.length > 0 ? parts.join(" • ") : "Semua periode (Real-Time Database)";
  }, [activeMonth, activeWeek, statusScope, reasonScope, availableWeeksList]);

  // Render SVG Donut (100% aligned between SVG slices and label positions)
  const renderDonut = (
    items: { name: string; count: number; pct: number; color: string }[],
    totalCount: number
  ) => {
    if (items.length === 0 || totalCount === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-xs text-zinc-400 gap-1">
          <span>Tidak ada data kasus pada filter periode ini</span>
        </div>
      );
    }

    let currentAngle = 0;
    const slices = items.map((item) => {
      const sliceAngle = (item.count / totalCount) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      // Midpoint angle for label inside slice (polarToCartesian already uses 0 deg = 12 o'clock)
      const midAngle = startAngle + sliceAngle / 2;
      const labelPos = polarToCartesian(120, 120, 75, midAngle);

      return {
        ...item,
        path: describeDonutSlice(120, 120, 96, 54, startAngle, endAngle),
        labelPos,
        showLabel: sliceAngle >= 12, // Only show inside donut when slice is wide enough not to overlap
      };
    });

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* DO NOT add -rotate-90 here because polarToCartesian already sets 0 deg at 12 o'clock! */}
          <svg viewBox="0 0 240 240" className="w-full h-full">
            {slices.map((s, idx) => {
              const isSelected = reasonScope === s.name;
              return (
                <path
                  key={idx}
                  d={s.path}
                  fill={s.color}
                  stroke={isSelected ? "#ffffff" : "rgba(15, 23, 42, 0.35)"}
                  strokeWidth={isSelected ? "2.5" : "1"}
                  onClick={() => setReasonScope(reasonScope === s.name ? "ALL" : (s.name as any))}
                  className="transition-all duration-300 hover:opacity-85 cursor-pointer"
                >
                  <title>{`${s.name}: ${s.count.toLocaleString("id-ID")} kasus (${s.pct}%) — Klik untuk filter`}</title>
                </path>
              );
            })}
          </svg>

          {/* Center total label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-slate-400">
              Total
            </span>
            <span className="text-lg font-black font-mono text-zinc-900 dark:text-white leading-tight">
              {totalCount.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Slices count labels overlay (100% aligned with SVG coordinates) */}
          <div className="absolute inset-0 pointer-events-none">
            {slices.map((s, idx) =>
              s.showLabel ? (
                <span
                  key={idx}
                  style={{
                    left: `${(s.labelPos.x / 240) * 100}%`,
                    top: `${(s.labelPos.y / 240) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] font-mono px-1 rounded"
                >
                  {s.count.toLocaleString("id-ID")}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Legend with Real Counts & Percentages */}
        <div className="w-full mt-3 pt-3 border-t border-zinc-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 px-1">
          {items.map((item, idx) => {
            const isSelected = reasonScope === item.name;
            return (
              <div
                key={idx}
                onClick={() => setReasonScope(reasonScope === item.name ? "ALL" : (item.name as any))}
                className={`flex items-center justify-between gap-2 text-xs py-0.5 px-1.5 rounded-lg transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-zinc-200 dark:bg-slate-700 font-bold"
                    : "hover:bg-zinc-50 dark:hover:bg-slate-800/50"
                }`}
                title="Klik untuk filter kendala ini"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0 shadow-2xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className={`truncate font-medium ${
                      isSelected ? "text-zinc-950 dark:text-white font-bold" : "text-zinc-700 dark:text-zinc-300"
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {item.count.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-slate-400">
                    ({item.pct}%)
                  </span>
                </div>
              </div>
            );
          })}
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
    if (items.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-xs text-zinc-400">
          Tidak ada data root cause pada filter periode ini
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col justify-between py-2">
        <div className="space-y-3.5">
          {items.map((item, idx) => {
            const isPendingRoot = item.name.includes("Belum Diisi");
            const barWidth = Math.max(1.5, Math.min(100, (item.count / maxScale) * 100));
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold truncate max-w-[230px] ${
                      isPendingRoot
                        ? "text-amber-600 dark:text-amber-400 italic"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {item.count.toLocaleString("id-ID")}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-400">
                      ({item.pct}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: isPendingRoot ? "#f59e0b" : barColor,
                    }}
                    className="h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis ticks */}
        <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-slate-800 flex justify-between text-[10px] text-zinc-400 font-mono">
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
    const maxVal = Math.max(...stats.mbi.roots.map((r) => r.count), 10);
    if (maxVal <= 50) return Math.ceil(maxVal / 10) * 10;
    if (maxVal <= 200) return Math.ceil(maxVal / 50) * 50;
    return Math.ceil(maxVal / 200) * 200;
  }, [stats.mbi.roots]);

  const hasActiveFilter =
    activeMonth !== "ALL" ||
    activeWeek !== "ALL" ||
    statusScope !== "ALL" ||
    reasonScope !== "ALL";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* =========================================
          FILTER BAR: PER BULAN, PER WEEK (3 MINGGU), STATUS & 4 KENDALA FISIK UTAMA
      ========================================= */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
        {/* ROW 1: FILTER WAKTU (BULAN & WEEK / 3 MINGGU), STATUS & SUMMARY */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-slate-200 mr-1">
              <Filter className="w-4 h-4 text-purple-500" />
              <span>Filter Analisis:</span>
            </div>

            {/* Filter Bulan */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                Bulan:
              </span>
              <select
                value={activeMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white dark:bg-slate-950 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
                  Semua Bulan ({returns.length.toLocaleString("id-ID")} Kasus)
                </option>
                {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((m) => {
                  const cnt = monthCounts[m] || 0;
                  return (
                    <option
                      key={m}
                      value={String(m)}
                      className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
                    >
                      {MONTH_NAMES[m]} ({cnt.toLocaleString("id-ID")} Kasus)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filter Week (Mendukung Rentang 3 Minggu, Rolling 3 Weeks, dan Single Week) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
              <CalendarRange className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                Week:
              </span>
              <select
                value={activeWeek}
                onChange={(e) => handleWeekSelect(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white dark:bg-slate-950 focus:outline-none cursor-pointer pr-1 max-w-[210px] truncate"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
                  Semua Week (W1 – W{availableWeeksList[0] || 45})
                </option>

                {/* Preset Cepat: 3 Minggu Terakhir */}
                <option
                  value="LAST_3"
                  className="bg-emerald-50 text-emerald-800 dark:bg-slate-900 dark:text-emerald-400 font-bold"
                >
                  ⚡ 3 Minggu Terakhir (W{Math.max(1, (availableWeeksList[0] || 45) - 2)} – W{availableWeeksList[0] || 45})
                </option>

                {/* Optgroup: Rentang 3 Mingguan (Window 3 Minggu) */}
                <optgroup
                  label="── Rentang 3 Mingguan (3 Weeks) ──"
                  className="bg-zinc-100 dark:bg-slate-900 text-zinc-500 font-bold"
                >
                  {threeWeekBlocks.map((blk) => (
                    <option
                      key={blk.id}
                      value={blk.id}
                      className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
                    >
                      {blk.label} ({blk.count.toLocaleString("id-ID")} Kasus)
                    </option>
                  ))}
                </optgroup>

                {/* Optgroup: Minggu Tunggal */}
                <optgroup
                  label="── Minggu Tunggal (Single Week) ──"
                  className="bg-zinc-100 dark:bg-slate-900 text-zinc-500 font-bold"
                >
                  {availableWeeksList.map((w) => {
                    const cnt = weekCounts[w] || 0;
                    if (activeMonth !== "ALL" && cnt === 0) return null;
                    return (
                      <option
                        key={w}
                        value={String(w)}
                        className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white"
                      >
                        Week W{w} ({cnt.toLocaleString("id-ID")} Kasus)
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>

            {/* Quick Toggle Button: 3 Minggu Terakhir */}
            <button
              type="button"
              onClick={() => handleWeekSelect(activeWeek === "LAST_3" ? "ALL" : "LAST_3")}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border shrink-0 ${
                activeWeek === "LAST_3" || (activeWeek.startsWith("3W:") && activeWeek === `3W:${Math.max(1, (availableWeeksList[0] || 45) - 2)}-${availableWeeksList[0] || 45}`)
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                  : "bg-zinc-50 dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              }`}
              title="Filter cepat 3 minggu terakhir"
            >
              <span>⚡ 3 Minggu Terakhir</span>
            </button>

            {/* Filter Status Kasus */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
              {[
                { id: "ALL", label: "Semua Status" },
                { id: "PENDING", label: "🟡 Pending" },
                { id: "IN_PROGRESS", label: "🔵 In Progress" },
                { id: "RESOLVED", label: "🟢 Resolved" },
                { id: "REJECT", label: "🔴 Reject" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusScope(s.id as typeof statusScope)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-[11px] ${
                    statusScope === s.id
                      ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                      : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  handleMonthSelect("ALL");
                  handleWeekSelect("ALL");
                  setStatusScope("ALL");
                  setReasonScope("ALL");
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Summary Pill */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800/60 font-bold">
              MAI: {stats.mai.total.toLocaleString("id-ID")}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold">
              MBI: {stats.mbi.total.toLocaleString("id-ID")}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-200 font-bold">
              Total: {(stats.mai.total + stats.mbi.total).toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        {/* =========================================
            ROW 2: QUICK FILTER 4 KENDALA FISIK UTAMA (REASON FILTER PILLS)
        ========================================= */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-zinc-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-slate-200 mr-0.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] uppercase tracking-wider font-extrabold">Fokus Kendala Fisik:</span>
            </div>

            {/* Pill: Semua Kendala */}
            <button
              type="button"
              onClick={() => setReasonScope("ALL")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                reasonScope === "ALL"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-xs"
                  : "bg-zinc-50 dark:bg-slate-950 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-800 hover:border-zinc-300 dark:hover:border-slate-700"
              }`}
            >
              <span>Semua Kendala</span>
              <span className="text-[10px] opacity-75 font-mono">
                ({reasonCounts.all.toLocaleString("id-ID")})
              </span>
            </button>

            {/* Pill: ⭐ 4 Kendala Fisik Utama (Gabungan) */}
            <button
              type="button"
              onClick={() => setReasonScope("PRIMARY_4")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                reasonScope === "PRIMARY_4"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-md shadow-emerald-500/25"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              }`}
              title="Filter otomatis gabungan 4 Kendala Fisik Utama: Kurang, Lebih, Salah, Tidak Ada"
            >
              <span>⭐ 4 Kendala Fisik Utama</span>
              <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full bg-emerald-800 text-emerald-100 dark:bg-emerald-900 dark:text-emerald-200">
                {reasonCounts.primary4.toLocaleString("id-ID")}
              </span>
            </button>

            {/* 4 Individual Physical Reasons */}
            {PRIMARY_4_PHYSICAL_REASONS.map((rz) => {
              const isSelected = reasonScope === rz;
              const color = REASON_COLOR_MAP[rz] || "#10b981";
              const cnt = reasonCounts[rz] || 0;
              return (
                <button
                  key={rz}
                  type="button"
                  onClick={() => setReasonScope(isSelected ? "ALL" : rz)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? "text-white shadow-xs font-black ring-2 ring-offset-1 ring-white/50"
                      : "bg-zinc-50 dark:bg-slate-950 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-800 hover:border-zinc-400 dark:hover:border-slate-600"
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: color, borderColor: color }
                      : {}
                  }
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>{rz}</span>
                  <span className="text-[10px] opacity-80 font-mono">
                    ({cnt.toLocaleString("id-ID")})
                  </span>
                </button>
              );
            })}

            {/* Pill: Kendala Lainnya */}
            <button
              type="button"
              onClick={() => setReasonScope(reasonScope === "OTHER" ? "ALL" : "OTHER")}
              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                reasonScope === "OTHER"
                  ? "bg-zinc-700 text-white border-zinc-600"
                  : "bg-zinc-50 dark:bg-slate-950 text-zinc-500 dark:text-slate-400 border-zinc-200 dark:border-slate-800 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Kasus selain 4 kendala fisik utama (Recall, Damage, ED, dll)"
            >
              <span>Lainnya</span>
              <span className="text-[10px] opacity-75 font-mono">
                ({reasonCounts.other.toLocaleString("id-ID")})
              </span>
            </button>
          </div>

          {/* Active Filter Indicator Badge */}
          {reasonScope !== "ALL" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold font-mono text-[11px]">
                Fokus aktif: {reasonScope === "PRIMARY_4" ? "4 Kendala Fisik Utama" : reasonScope}
              </span>
              <button
                type="button"
                onClick={() => setReasonScope("ALL")}
                className="text-xs text-zinc-400 hover:text-rose-500 font-bold"
                title="Hapus filter kendala"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =========================================
          SECTION 1: BREAKDOWN MAI
      ========================================= */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-red-500 rounded-full" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
              Breakdown MAI
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold">
              PT Medika Akses Investama
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-slate-400">
            <span>Resolved: <strong className="text-emerald-600 dark:text-emerald-400">{stats.mai.resolvedCount.toLocaleString("id-ID")}</strong></span>
            <span>•</span>
            <span>In Progress: <strong className="text-blue-500">{stats.mai.inProgressCount.toLocaleString("id-ID")}</strong></span>
            <span>•</span>
            <span>Pending: <strong className="text-amber-500">{stats.mai.pendingCount.toLocaleString("id-ID")}</strong></span>
            <span>•</span>
            <span>Reject: <strong className="text-rose-500">{stats.mai.rejectCount.toLocaleString("id-ID")}</strong></span>
          </div>
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
                  Distribusi tipe kesalahan — {activePeriodLabel}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500">
                Total: {stats.mai.total.toLocaleString("id-ID")}
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
                  Akar penyebab — {activePeriodLabel}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500">
                Total: {stats.mai.total.toLocaleString("id-ID")}
              </span>
            </div>

            {renderHorizontalBars(stats.mai.roots, "#ef4444", maiMaxRoot)}
          </div>
        </div>
      </div>

      {/* =========================================
          SECTION 2: BREAKDOWN MBI
      ========================================= */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
              Breakdown MBI
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
              PT Medika Bina Investama
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-slate-400">
            <span>Resolved: <strong className="text-emerald-600 dark:text-emerald-400">{stats.mbi.resolvedCount.toLocaleString("id-ID")}</strong></span>
            <span>•</span>
            <span>In Progress: <strong className="text-blue-500">{stats.mbi.inProgressCount.toLocaleString("id-ID")}</strong></span>
            <span>•</span>
            <span>Pending: <strong className="text-amber-500">{stats.mbi.pendingCount.toLocaleString("id-ID")}</strong></span>
            <span>•</span>
            <span>Reject: <strong className="text-rose-500">{stats.mbi.rejectCount.toLocaleString("id-ID")}</strong></span>
          </div>
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
                  Distribusi tipe kesalahan — {activePeriodLabel}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500">
                Total: {stats.mbi.total.toLocaleString("id-ID")}
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
                  Akar penyebab — {activePeriodLabel}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500">
                Total: {stats.mbi.total.toLocaleString("id-ID")}
              </span>
            </div>

            {renderHorizontalBars(stats.mbi.roots, "#3b82f6", mbiMaxRoot)}
          </div>
        </div>
      </div>

      {/* =========================================
          SECTION 2.5: PERSONIL (NAMA LENGKAP)
      ========================================= */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span>Personil Terlibat</span>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold">
              {personnel.list.length} orang
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-slate-400">
            {activePeriodLabel}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-3 border-b border-zinc-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={personnelSearch}
                onChange={(e) => setPersonnelSearch(e.target.value)}
                placeholder="Cari nama personil..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-slate-950 border border-zinc-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
              {(["ALL", "MBI", "MAI"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPersonnelPbf(p)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-[11px] ${
                    personnelPbf === p
                      ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs"
                      : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {p === "ALL" ? "Semua PBF" : `${p} Saja`}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-slate-950 text-zinc-600 dark:text-slate-400 font-bold border-b border-zinc-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">No</th>
                  <th className="py-2.5 px-3">Nama Personil</th>
                  <th className="py-2.5 px-3">Jumlah Kasus</th>
                  <th className="py-2.5 px-2 text-center">MBI</th>
                  <th className="py-2.5 px-2 text-center">MAI</th>
                  <th className="py-2.5 px-2 text-center">Resolved</th>
                  <th className="py-2.5 px-2 text-center">In Progress</th>
                  <th className="py-2.5 px-2 text-center">Reject</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                {visiblePersonnel.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-zinc-400">
                      Tidak ada personil pada filter ini
                    </td>
                  </tr>
                ) : (
                  visiblePersonnel.map((p, idx) => {
                    const isOpen = expandedPerson === p.person;
                    const pct = Math.round((p.shown / maxPersonCases) * 100);
                    return (
                      <Fragment key={p.person}>
                        <tr
                          onClick={() => setExpandedPerson(isOpen ? null : p.person)}
                          className="hover:bg-zinc-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                          title="Klik untuk melihat penulisan nama asli di Data Kasus"
                        >
                          <td className="py-2 px-3 text-center font-mono text-zinc-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-zinc-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              {isOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              )}
                              <span>{p.person}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="w-8 font-black font-mono text-rose-600 dark:text-rose-400">{p.shown}</span>
                              <div className="flex-1 max-w-[180px] h-2 bg-zinc-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-blue-600 dark:text-blue-400">{p.mbi}</td>
                          <td className="py-2 px-2 text-center font-bold text-purple-600 dark:text-purple-400">{p.mai}</td>
                          <td className="py-2 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{p.resolved}</td>
                          <td className="py-2 px-2 text-center font-bold text-amber-600 dark:text-amber-400">{p.open}</td>
                          <td className="py-2 px-2 text-center font-bold text-rose-600 dark:text-rose-400">{p.reject}</td>
                          <td className="py-2 px-3 text-center">
                            {onSelectPerson && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPerson(p.person);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-800 dark:text-slate-200 font-bold text-[11px] transition-colors cursor-pointer"
                                title={`Buka Data Kasus untuk ${p.person}`}
                              >
                                Lihat Kasus
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-zinc-50/80 dark:bg-slate-950/60">
                            <td />
                            <td colSpan={8} className="py-2 px-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 mb-1.5">
                                Penulisan asli di Data Kasus (klik untuk buka di Data Kasus)
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {p.variantList.map(([variant, cnt]) => (
                                  <button
                                    key={variant}
                                    type="button"
                                    onClick={() => onSelectPerson && onSelectPerson(variant)}
                                    className="px-2 py-0.5 rounded-md bg-white hover:bg-zinc-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-zinc-200 dark:border-slate-700 text-[11px] font-mono text-zinc-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                                    title={`Klik untuk filter Data Kasus dengan kata kunci "${variant}"`}
                                  >
                                    <span>{variant}</span>
                                    <strong className="text-rose-600 dark:text-rose-400">×{cnt}</strong>
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: cases without personnel */}
          <div className="px-3 py-2.5 border-t border-zinc-200 dark:border-slate-800 bg-zinc-50/60 dark:bg-slate-950/40 text-[11px] text-zinc-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Kasus tanpa nama personil:{" "}
              <strong className="text-amber-600 dark:text-amber-400">
                {(personnelPbf === "MAI"
                  ? personnel.unassignedMai
                  : personnelPbf === "MBI"
                  ? personnel.unassignedMbi
                  : personnel.unassigned
                ).toLocaleString("id-ID")}
              </strong>
            </span>
            <span className="text-zinc-400">•</span>
            <span>Kasus dengan 2 personil (mis. &quot;RIPAL / ZAID&quot;) dihitung ke masing-masing orang.</span>
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
                Tercatat 100+ insiden terkait sistem dan operasional di MBI. Lakukan sinkronisasi master konversi satuan (strip/box/botol) antara sistem WMS dan Oracle sebelum faktur dicetak.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
