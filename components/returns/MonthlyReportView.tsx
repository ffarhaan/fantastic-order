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
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Flame,
  Info,
  Eye,
  ExternalLink,
  Tag,
  AlertTriangle,
} from "lucide-react";

interface MonthlyReportViewProps {
  returns: ShipmentReturnRecord[];
  records?: FakturRecord[];
  onSelectMonth?: (monthNum: number, pbf?: string) => void;
  onSelectReturn?: (r: ShipmentReturnRecord) => void;
}

export type ReturnReasonCategory = "operational" | "ed" | "damage";

/**
 * Mengklasifikasikan alasan shipment return ke dalam 3 kelompok utama:
 * 1. "operational": Kesalahan fisik/picking/packing/pengiriman gudang (salah, kurang, lebih, tertinggal, salah SKU, dll)
 * 2. "ed": Masalah Expired Date / Kadaluarsa (ED < 1 tahun, kadaluarsa pabrik)
 * 3. "damage": Masalah kerusakan fisik produk/kemasan (damage on delivery, pecah, penyok, bocor, kemasan rusak, seal rusak)
 */
export function classifyReasonCategory(reason?: string | null): ReturnReasonCategory {
  const r = (reason || "").trim().toLowerCase();
  if (r.includes("ed") || r.includes("kadaluarsa") || r.includes("expire")) {
    return "ed";
  }
  if (
    r.includes("damage") ||
    r.includes("rusak") ||
    r.includes("bocor") ||
    r.includes("penyok") ||
    r.includes("pecah") ||
    r.includes("seal")
  ) {
    return "damage";
  }
  return "operational";
}

/**
 * Ekstraksi angka bulan (1-12) dari data return dengan presisi
 */
export function extractReturnMonth(r: ShipmentReturnRecord): number {
  if (r.month && Number(r.month) >= 1 && Number(r.month) <= 12) {
    return Number(r.month);
  }
  const dateStr = r.report_date || r.invoice_date || r.created_at;
  if (!dateStr) return 0;
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return parseInt(dateStr.slice(5, 7), 10);
    }
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(dateStr)) {
      const parts = dateStr.split(/[\/\-]/);
      return parseInt(parts[1], 10);
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.getMonth() + 1;
    }
  } catch {}
  return 0;
}

export const MONTH_NAMES = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Historical known total invoice volumes per month (Oracle system level)
export const KNOWN_INVOICE_VOLUMES: Record<number, { mai: number; mbi: number }> = {
  1: { mai: 5150, mbi: 5011 },
  2: { mai: 5475, mbi: 5461 },
  3: { mai: 5620, mbi: 4870 },
  4: { mai: 6320, mbi: 7151 },
  5: { mai: 6441, mbi: 8255 },
  6: { mai: 6566, mbi: 9195 },
  7: { mai: 6591, mbi: 10532 },
  8: { mai: 5832, mbi: 9680 },
  9: { mai: 6380, mbi: 8711 },
  10: { mai: 4101, mbi: 9801 },
  11: { mai: 1978, mbi: 5014 },
  12: { mai: 2500, mbi: 6000 },
};

// Backward-compatibility export
export const MONTHLY_BENCHMARKS = [
  { month: 1, name: "JANUARI", mai_approve: 13, mai_inv: 5150, mai_reject: 1, mbi_approve: 84, mbi_inv: 5011, mbi_reject: 15 },
  { month: 2, name: "FEBRUARI", mai_approve: 8, mai_inv: 5475, mai_reject: 4, mbi_approve: 106, mbi_inv: 5461, mbi_reject: 8 },
  { month: 3, name: "MARET", mai_approve: 9, mai_inv: 5620, mai_reject: 0, mbi_approve: 126, mbi_inv: 4870, mbi_reject: 6 },
  { month: 4, name: "APRIL", mai_approve: 5, mai_inv: 6320, mai_reject: 0, mbi_approve: 168, mbi_inv: 7151, mbi_reject: 17 },
  { month: 5, name: "MEI", mai_approve: 9, mai_inv: 6441, mai_reject: 2, mbi_approve: 119, mbi_inv: 8255, mbi_reject: 13 },
  { month: 6, name: "JUNI", mai_approve: 4, mai_inv: 6566, mai_reject: 0, mbi_approve: 149, mbi_inv: 9195, mbi_reject: 10 },
  { month: 7, name: "JULI", mai_approve: 3, mai_inv: 6591, mai_reject: 0, mbi_approve: 227, mbi_inv: 10532, mbi_reject: 15 },
  { month: 8, name: "AGUSTUS", mai_approve: 8, mai_inv: 5832, mai_reject: 0, mbi_approve: 134, mbi_inv: 9680, mbi_reject: 13 },
  { month: 9, name: "SEPTEMBER", mai_approve: 7, mai_inv: 6380, mai_reject: 0, mbi_approve: 280, mbi_inv: 8711, mbi_reject: 13 },
  { month: 10, name: "OKTOBER", mai_approve: 5, mai_inv: 4101, mai_reject: 0, mbi_approve: 177, mbi_inv: 9801, mbi_reject: 14 },
  { month: 11, name: "NOVEMBER", mai_approve: 40, mai_inv: 1978, mai_reject: 2, mbi_approve: 109, mbi_inv: 5014, mbi_reject: 41 },
  { month: 12, name: "DESEMBER", mai_approve: 0, mai_inv: 2500, mai_reject: 0, mbi_approve: 0, mbi_inv: 6000, mbi_reject: 0 },
];

export default function MonthlyReportView({
  returns = [],
  records = [],
  onSelectMonth,
  onSelectReturn,
}: MonthlyReportViewProps) {
  const [selectedPbfFilter, setSelectedPbfFilter] = useState<"ALL" | "MBI" | "MAI">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "OPERATIONAL" | "ED" | "DAMAGE">("ALL");

  // State untuk modal inspeksi transparan detail kasus per bulan
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    month: number;
    pbf: "MAI" | "MBI" | "ALL";
    name: string;
  } | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalFilterCat, setModalFilterCat] = useState<"ALL" | "OPERATIONAL" | "ED" | "DAMAGE" | "REJECT">("ALL");

  // State untuk Tren Progres Shipment Error (Murni Operasional)
  const [chartPbf, setChartPbf] = useState<"ALL" | "MBI" | "MAI">("ALL");
  const [chartMetric, setChartMetric] = useState<"count" | "rate">("count");
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  // ─── HITUNG DATA BULANAN 100% DINAMIS DARI DATA KASUS RIIL ───
  const { monthlyData, monthCasesMap, overallStats } = useMemo(() => {
    // Inisialisasi struktur data bulan 1..12
    const casesMap: Record<number, { MAI: ShipmentReturnRecord[]; MBI: ShipmentReturnRecord[] }> = {};
    for (let m = 1; m <= 12; m++) {
      casesMap[m] = { MAI: [], MBI: [] };
    }

    // Kelompokkan setiap kasus riil ke bulan dan PBF yang sesuai
    for (const r of returns) {
      const m = extractReturnMonth(r);
      if (m >= 1 && m <= 12) {
        const pbfStr = (r.pbf || "MBI").toUpperCase();
        const pbfKey = pbfStr.includes("MAI") ? "MAI" : "MBI";
        casesMap[m][pbfKey].push(r);
      }
    }

    // Hitung total invoice riil dari records yang aktif di memori
    const liveInvoicesByMonth: Record<number, { mai: Set<string>; mbi: Set<string> }> = {};
    for (let m = 1; m <= 12; m++) {
      liveInvoicesByMonth[m] = { mai: new Set<string>(), mbi: new Set<string>() };
    }

    if (records && records.length > 0) {
      for (const rec of records) {
        const anyRec = rec as any;
        const dateVal = rec.orderDate || rec.transactionDate || anyRec.order_date || anyRec.transaction_date;
        if (!dateVal || dateVal === "-" || dateVal === "#N/A") continue;
        let m = 0;
        if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
          m = parseInt(dateVal.slice(5, 7), 10);
        } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(dateVal)) {
          const parts = dateVal.split(/[\/\-]/);
          m = parseInt(parts[1], 10);
        } else {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) m = d.getMonth() + 1;
        }
        if (m >= 1 && m <= 12) {
          const pbfStr = (anyRec.pbf || anyRec.sourceFile || anyRec.entity || rec.invoiceNumber || anyRec.key || "MBI").toUpperCase();
          const invNo = String(rec.invoiceNumber || anyRec.key || anyRec.no_faktur || anyRec.id || "").trim();
          if (invNo) {
            if (pbfStr.includes("MAI")) {
              liveInvoicesByMonth[m].mai.add(invNo);
            } else {
              liveInvoicesByMonth[m].mbi.add(invNo);
            }
          }
        }
      }
    }

    // Bangun rekap per bulan
    const currentMonthNum = new Date().getMonth() + 1;
    let prevMaiRate: number | null = null;
    let prevMbiRate: number | null = null;

    let totAllCases = 0;
    let totOpCases = 0;
    let totEdCases = 0;
    let totDamageCases = 0;
    let totRejectCases = 0;

    const list = Array.from({ length: 12 }, (_, idx) => {
      const monthNum = idx + 1;
      const name = MONTH_NAMES[monthNum].toUpperCase();
      const isCur = monthNum === currentMonthNum;

      const maiCases = casesMap[monthNum].MAI;
      const mbiCases = casesMap[monthNum].MBI;

      // MAI Breakdown
      let maiOp = 0;
      let maiEd = 0;
      let maiDamage = 0;
      let maiReject = 0;
      let maiApprove = 0;

      for (const r of maiCases) {
        const conf = (r.confirm || "").toLowerCase();
        const stat = (r.status || "").toLowerCase();
        const isRej = conf.includes("reject") || conf.includes("tolak") || stat.includes("reject");
        const reasonCat = classifyReasonCategory(r.reason);

        if (isRej) {
          maiReject++;
        } else {
          maiApprove++;
          if (reasonCat === "ed") maiEd++;
          else if (reasonCat === "damage") maiDamage++;
          else maiOp++;
        }
      }

      // MBI Breakdown
      let mbiOp = 0;
      let mbiEd = 0;
      let mbiDamage = 0;
      let mbiReject = 0;
      let mbiApprove = 0;

      for (const r of mbiCases) {
        const conf = (r.confirm || "").toLowerCase();
        const stat = (r.status || "").toLowerCase();
        const isRej = conf.includes("reject") || conf.includes("tolak") || stat.includes("reject");
        const reasonCat = classifyReasonCategory(r.reason);

        if (isRej) {
          mbiReject++;
        } else {
          mbiApprove++;
          if (reasonCat === "ed") mbiEd++;
          else if (reasonCat === "damage") mbiDamage++;
          else mbiOp++;
        }
      }

      totAllCases += maiCases.length + mbiCases.length;
      totOpCases += maiOp + mbiOp;
      totEdCases += maiEd + mbiEd;
      totDamageCases += maiDamage + mbiDamage;
      totRejectCases += maiReject + mbiReject;

      // Invoice volume (Live or Known)
      const liveMaiInv = liveInvoicesByMonth[monthNum].mai.size;
      const liveMbiInv = liveInvoicesByMonth[monthNum].mbi.size;
      const fallbackMai = KNOWN_INVOICE_VOLUMES[monthNum]?.mai || 5000;
      const fallbackMbi = KNOWN_INVOICE_VOLUMES[monthNum]?.mbi || 7000;

      const maiInv = liveMaiInv > 0 ? liveMaiInv : fallbackMai;
      const mbiInv = liveMbiInv > 0 ? liveMbiInv : fallbackMbi;

      // Rates berdasarkan filter kategori aktif
      const getTargetCount = (op: number, ed: number, dmg: number, app: number) => {
        if (categoryFilter === "OPERATIONAL") return op;
        if (categoryFilter === "ED") return ed;
        if (categoryFilter === "DAMAGE") return dmg;
        return app;
      };

      const maiTargetCount = getTargetCount(maiOp, maiEd, maiDamage, maiApprove);
      const mbiTargetCount = getTargetCount(mbiOp, mbiEd, mbiDamage, mbiApprove);

      const maiRate = maiInv > 0 ? (maiTargetCount / maiInv) * 100 : 0;
      const mbiRate = mbiInv > 0 ? (mbiTargetCount / mbiInv) * 100 : 0;

      // Total approved rates (untuk perbandingan)
      const maiTotalRate = maiInv > 0 ? (maiApprove / maiInv) * 100 : 0;
      const mbiTotalRate = mbiInv > 0 ? (mbiApprove / mbiInv) * 100 : 0;

      const maiTrend = prevMaiRate !== null ? maiRate - prevMaiRate : null;
      const mbiTrend = prevMbiRate !== null ? mbiRate - prevMbiRate : null;

      prevMaiRate = maiRate;
      prevMbiRate = mbiRate;

      return {
        month: monthNum,
        name,
        isCurrent: isCur,
        // MAI
        mai_total_cases: maiCases.length,
        mai_approve: maiApprove,
        mai_operational: maiOp,
        mai_ed: maiEd,
        mai_damage: maiDamage,
        mai_reject: maiReject,
        mai_inv: maiInv,
        mai_rate: Number(maiRate.toFixed(2)),
        mai_total_rate: Number(maiTotalRate.toFixed(2)),
        mai_trend: maiTrend !== null ? Number(maiTrend.toFixed(2)) : null,
        mai_target_count: maiTargetCount,
        // MBI
        mbi_total_cases: mbiCases.length,
        mbi_approve: mbiApprove,
        mbi_operational: mbiOp,
        mbi_ed: mbiEd,
        mbi_damage: mbiDamage,
        mbi_reject: mbiReject,
        mbi_inv: mbiInv,
        mbi_rate: Number(mbiRate.toFixed(2)),
        mbi_total_rate: Number(mbiTotalRate.toFixed(2)),
        mbi_trend: mbiTrend !== null ? Number(mbiTrend.toFixed(2)) : null,
        mbi_target_count: mbiTargetCount,
      };
    });

    return {
      monthlyData: list,
      monthCasesMap: casesMap,
      overallStats: {
        totAllCases,
        totOpCases,
        totEdCases,
        totDamageCases,
        totRejectCases,
      },
    };
  }, [returns, records, categoryFilter]);

  // Data kasus untuk modal inspeksi aktif
  const inspectCases = useMemo(() => {
    if (!inspectModal) return [];
    const { month, pbf } = inspectModal;
    let list: ShipmentReturnRecord[] = [];
    if (pbf === "ALL") {
      list = [...(monthCasesMap[month]?.MAI || []), ...(monthCasesMap[month]?.MBI || [])];
    } else if (pbf === "MAI") {
      list = monthCasesMap[month]?.MAI || [];
    } else {
      list = monthCasesMap[month]?.MBI || [];
    }

    return list.filter((r) => {
      // Filter kategori di modal
      const cat = classifyReasonCategory(r.reason);
      const conf = (r.confirm || "").toLowerCase();
      const stat = (r.status || "").toLowerCase();
      const isRej = conf.includes("reject") || conf.includes("tolak") || stat.includes("reject");

      if (modalFilterCat === "OPERATIONAL" && (cat !== "operational" || isRej)) return false;
      if (modalFilterCat === "ED" && (cat !== "ed" || isRej)) return false;
      if (modalFilterCat === "DAMAGE" && (cat !== "damage" || isRej)) return false;
      if (modalFilterCat === "REJECT" && !isRej) return false;

      // Filter pencarian
      if (!modalSearch.trim()) return true;
      const q = modalSearch.toLowerCase().trim();
      const inv = (r.invoice_no || "").toLowerCase();
      const so = (r.so_no || "").toLowerCase();
      const cust = (r.customer_name || "").toLowerCase();
      const prod = (r.product_name || "").toLowerCase();
      const rz = (r.reason || "").toLowerCase();
      const rc = (r.root_cause || "").toLowerCase();
      const person = (r.person || "").toLowerCase();

      return (
        inv.includes(q) ||
        so.includes(q) ||
        cust.includes(q) ||
        prod.includes(q) ||
        rz.includes(q) ||
        rc.includes(q) ||
        person.includes(q)
      );
    });
  }, [inspectModal, monthCasesMap, modalFilterCat, modalSearch]);

  const currentMonthData = useMemo(() => {
    const curMonthNum = new Date().getMonth() + 1;
    return monthlyData.find((m) => m.month === curMonthNum) || monthlyData[10]; // November fallback
  }, [monthlyData]);

  // Perhitungan Data Grafik SVG Murni Operasional (Non-ED & Non-Damage)
  const chartData = useMemo(() => {
    const points = monthlyData.map((d) => {
      const mbiVal = chartMetric === "count" ? d.mbi_operational : (d.mbi_inv > 0 ? (d.mbi_operational / d.mbi_inv) * 100 : 0);
      const maiVal = chartMetric === "count" ? d.mai_operational : (d.mai_inv > 0 ? (d.mai_operational / d.mai_inv) * 100 : 0);
      const totVal = chartMetric === "count"
        ? (d.mbi_operational + d.mai_operational)
        : ((d.mbi_inv + d.mai_inv > 0) ? ((d.mbi_operational + d.mai_operational) / (d.mbi_inv + d.mai_inv)) * 100 : 0);

      const activeVal = chartPbf === "ALL" ? totVal : (chartPbf === "MBI" ? mbiVal : maiVal);
      return {
        month: d.month,
        name: d.name.slice(0, 3),
        fullName: d.name,
        mbiVal,
        maiVal,
        totVal,
        activeVal,
        mbiOp: d.mbi_operational,
        maiOp: d.mai_operational,
        totOp: d.mbi_operational + d.mai_operational,
        mbiRate: d.mbi_inv > 0 ? (d.mbi_operational / d.mbi_inv) * 100 : 0,
        maiRate: d.mai_inv > 0 ? (d.mai_operational / d.mai_inv) * 100 : 0,
        totRate: (d.mbi_inv + d.mai_inv > 0) ? ((d.mbi_operational + d.mai_operational) / (d.mbi_inv + d.mai_inv)) * 100 : 0,
      };
    });

    const activeMax = Math.max(...points.map((p) => p.activeVal), chartMetric === "count" ? 20 : 1);
    const yMax = Math.ceil(activeMax * 1.15) || (chartMetric === "count" ? 200 : 3);

    const activeMonths = points.filter((p) => p.month <= 11 && p.activeVal > 0);
    const lastM = activeMonths[activeMonths.length - 1];
    const prevM = activeMonths[activeMonths.length - 2];
    let trendPct = 0;
    let isBetter = true;
    if (lastM && prevM && prevM.activeVal > 0) {
      trendPct = ((lastM.activeVal - prevM.activeVal) / prevM.activeVal) * 100;
      isBetter = trendPct <= 0;
    }

    return { points, yMax, trendPct, isBetter, lastM, prevM };
  }, [monthlyData, chartPbf, chartMetric]);

  return (
    <div className="space-y-6">
      {/* ─── 1. HEADER & FILTER KENDALA (PEMISAHAN ED & DAMAGE) ─── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-zinc-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-sm">
                📊
              </span>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                Monthly Shipment Error &amp; Retur Bulanan
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
              Sinkronisasi 100% data kasus riil — kini kendala dipisahkan transparan antara{" "}
              <strong>Murni Operasional</strong>, <strong>ED</strong>, dan <strong>Damage</strong>.
            </p>
          </div>

          {/* Quick PBF Switcher */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs font-bold">
            {[
              { id: "ALL", label: "🏢 Semua PBF" },
              { id: "MBI", label: "🔵 MBI Saja" },
              { id: "MAI", label: "🔴 MAI Saja" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPbfFilter(p.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedPbfFilter === p.id
                    ? "bg-white text-black dark:bg-slate-800 dark:text-white shadow-xs font-black"
                    : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── SEGMENT FILTER KATEGORI ALASAN (REASON) ─── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-zinc-600 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-500" />
              Klasifikasi Kendala:
            </span>

            <button
              type="button"
              onClick={() => setCategoryFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === "ALL"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs font-black"
                  : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-200"
              }`}
              title="Tampilkan seluruh kasus gabungan (Operasional + ED + Damage)"
            >
              <span>🌟 Semua Kasus</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20 dark:bg-black/10">
                {overallStats.totAllCases}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("OPERATIONAL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === "OPERATIONAL"
                  ? "bg-blue-600 text-white shadow-sm font-black ring-2 ring-blue-400/50"
                  : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100"
              }`}
              title="Hanya kesalahan picking/packing/operasional gudang (eksklusi ED & Damage)"
            >
              <Package className="w-3.5 h-3.5 text-blue-400" />
              <span>📦 Murni Operasional (Gudang)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-700 text-white">
                {overallStats.totOpCases}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("ED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === "ED"
                  ? "bg-amber-600 text-white shadow-sm font-black ring-2 ring-amber-400/50"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100"
              }`}
              title="Kasus kendala Expired Date dekat (ED < 1 tahun)"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>⏳ Kasus ED (Kadaluarsa)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-700 text-white">
                {overallStats.totEdCases}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("DAMAGE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === "DAMAGE"
                  ? "bg-rose-600 text-white shadow-sm font-black ring-2 ring-rose-400/50"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100"
              }`}
              title="Kasus kerusakan fisik dalam pengiriman / kemasan rusak / pecah / penyok"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>💥 Kasus Damage (Rusak/Penyok)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-700 text-white">
                {overallStats.totDamageCases}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-500 dark:text-slate-400 font-medium">
            💡 Klik pada kartu/baris bulan untuk membuka <strong>rincian transparan per faktur</strong>
          </div>
        </div>
      </div>

      {/* ─── 2. ACTIVE MONTH HIGHLIGHT BANNER (CURRENT / NOVEMBER) ─── */}
      {currentMonthData && (
        <div className="p-4 sm:p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white dark:from-[#0b1528] dark:via-[#0e1b33] dark:to-[#0a1120] shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-blue-200/60 dark:border-blue-900/40">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <div>
                <h3 className="text-sm font-black text-blue-950 dark:text-blue-100 uppercase tracking-wide">
                  Sorotan Bulan Berjalan: {currentMonthData.name} 2026
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Perbandingan kendala operasional vs kendala produk (ED &amp; Damage)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setInspectModal({
                  isOpen: true,
                  month: currentMonthData.month,
                  pbf: selectedPbfFilter === "ALL" ? "ALL" : selectedPbfFilter,
                  name: currentMonthData.name,
                })
              }
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Buka Seluruh Kasus {currentMonthData.name}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {/* MBI OP */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-blue-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                MBI Murni Operasional
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-0.5">
                {currentMonthData.mbi_operational}{" "}
                <span className="text-xs text-zinc-500 font-medium">kasus</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Rate: {((currentMonthData.mbi_operational / currentMonthData.mbi_inv) * 100).toFixed(2)}%
              </div>
            </div>

            {/* MBI ED & DAMAGE */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                MBI Kasus ED &amp; Damage
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {currentMonthData.mbi_ed + currentMonthData.mbi_damage}{" "}
                <span className="text-xs text-zinc-500 font-medium">kasus</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {currentMonthData.mbi_ed} ED · {currentMonthData.mbi_damage} Damage
              </div>
            </div>

            {/* MBI REJECT */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-zinc-500 uppercase">
                MBI Reject (Apotek)
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-600 dark:text-slate-300 mt-0.5">
                {currentMonthData.mbi_reject}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Ditolak / Batal Outlet</div>
            </div>

            {/* MAI OP */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-red-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">
                MAI Murni Operasional
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-0.5">
                {currentMonthData.mai_operational}{" "}
                <span className="text-xs text-zinc-500 font-medium">kasus</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Rate: {((currentMonthData.mai_operational / currentMonthData.mai_inv) * 100).toFixed(2)}%
              </div>
            </div>

            {/* MAI ED & DAMAGE */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                MAI Kasus ED &amp; Damage
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {currentMonthData.mai_ed + currentMonthData.mai_damage}{" "}
                <span className="text-xs text-zinc-500 font-medium">kasus</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {currentMonthData.mai_ed} ED · {currentMonthData.mai_damage} Damage
              </div>
            </div>

            {/* MAI REJECT */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-zinc-200 dark:border-slate-800">
              <div className="text-[10px] font-bold text-zinc-500 uppercase">
                MAI Reject (Apotek)
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-600 dark:text-slate-300 mt-0.5">
                {currentMonthData.mai_reject}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Ditolak / Batal Outlet</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2.5. TREN PROGRES SHIPMENT ERROR BULANAN (MURNI OPERASIONAL GUDANG) ─── */}
      <div className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs space-y-4">
        {/* Chart Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                <span>Tren Progres Shipment Error: Murni Operasional Gudang (Jan–Des)</span>
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
              Khusus evaluasi kesalahan fisik picking, packing, salah SKU &amp; kuantitas — <strong className="text-amber-600 dark:text-amber-400">Kasus ED &amp; Damage 100% tidak dimasukkan</strong>
            </p>
          </div>

          {/* Toggle PBF & Metric Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* PBF Filter */}
            <div className="flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-slate-950 border border-zinc-200 dark:border-slate-800 text-[11px] font-bold">
              {(["ALL", "MBI", "MAI"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChartPbf(p)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    chartPbf === p
                      ? "bg-indigo-600 text-white shadow-xs font-black"
                      : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {p === "ALL" ? "Semua PBF" : p === "MBI" ? "MBI (Biru)" : "MAI (Merah)"}
                </button>
              ))}
            </div>

            {/* Metric Switcher: Count vs Rate */}
            <div className="flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-slate-950 border border-zinc-200 dark:border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setChartMetric("count")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === "count"
                    ? "bg-slate-900 text-white dark:bg-slate-700 shadow-xs font-black"
                    : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                }`}
              >
                Jml Kasus
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("rate")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === "rate"
                    ? "bg-slate-900 text-white dark:bg-slate-700 shadow-xs font-black"
                    : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
                }`}
              >
                Error Rate %
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Insight Banner */}
        <div className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border text-xs ${
          chartData.isBetter
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-200"
            : "bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200"
        }`}>
          <div className="flex items-center gap-2">
            <span className="font-black text-sm flex items-center gap-1">
              {chartData.isBetter ? "↓ PROGRES MEMBAIK:" : "↑ PERLU PERHATIAN:"}
            </span>
            <span>
              Kesalahan murni operasional gudang {chartData.prevM?.fullName || "bulan lalu"} ({chartData.prevM ? Math.round(chartData.prevM.activeVal) : 0}) ke {chartData.lastM?.fullName || "bulan ini"} ({chartData.lastM ? Math.round(chartData.lastM.activeVal) : 0}) mengalami perubahan:
            </span>
          </div>
          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-full bg-white/40 dark:bg-black/20">
            {chartData.trendPct > 0 ? `+${chartData.trendPct.toFixed(1)}%` : `${chartData.trendPct.toFixed(1)}%`} Kasus Operasional
          </span>
        </div>

        {/* SVG Interactive Line Chart */}
        <div className="relative w-full h-56 pt-2 select-none">
          <svg viewBox="0 0 600 180" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="opGradMbi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="opGradMai" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="opGradAll" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio, gIdx) => {
              const yPos = 145 - ratio * 125;
              const yVal = Math.round(ratio * chartData.yMax * 10) / 10;
              return (
                <g key={gIdx}>
                  <line
                    x1="45"
                    y1={yPos}
                    x2="575"
                    y2={yPos}
                    stroke="currentColor"
                    className="text-zinc-200 dark:text-slate-800"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x="40"
                    y={yPos + 3}
                    textAnchor="end"
                    fontSize="9"
                    className="fill-zinc-400 dark:fill-slate-500 font-mono"
                  >
                    {chartMetric === "rate" ? `${yVal}%` : yVal}
                  </text>
                </g>
              );
            })}
            <text x="40" y="148" textAnchor="end" fontSize="9" className="fill-zinc-400 dark:fill-slate-500 font-mono">
              0
            </text>

            {/* Compute SVG Path */}
            {(() => {
              const pts = chartData.points;
              const coords = pts.map((p, i) => {
                const x = 45 + i * (530 / 11);
                const y = 145 - (p.activeVal / (chartData.yMax || 1)) * 125;
                return { x, y, p, i };
              });

              const lineD = coords.reduce((acc, c, i) => (i === 0 ? `M ${c.x},${c.y}` : `${acc} L ${c.x},${c.y}`), "");
              const areaD = `${lineD} L ${coords[coords.length - 1].x},145 L ${coords[0].x},145 Z`;
              const colorStroke = chartPbf === "MBI" ? "#3b82f6" : chartPbf === "MAI" ? "#ef4444" : "#6366f1";
              const gradId = chartPbf === "MBI" ? "url(#opGradMbi)" : chartPbf === "MAI" ? "url(#opGradMai)" : "url(#opGradAll)";

              return (
                <>
                  <path d={areaD} fill={gradId} className="transition-all duration-300" />
                  <path
                    d={lineD}
                    fill="none"
                    stroke={colorStroke}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />

                  {/* Month Points & Click Target */}
                  {coords.map((c) => {
                    const isHovered = hoveredMonth === c.i;
                    return (
                      <g key={c.i} className="cursor-pointer" onClick={() => setInspectModal({
                        isOpen: true,
                        month: c.p.month,
                        pbf: chartPbf,
                        name: c.p.fullName,
                      })}>
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={isHovered ? 6 : 4}
                          fill={colorStroke}
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-all duration-200"
                          onMouseEnter={() => setHoveredMonth(c.i)}
                          onMouseLeave={() => setHoveredMonth(null)}
                        />
                        {/* Month Label on X axis */}
                        <text
                          x={c.x}
                          y="162"
                          textAnchor="middle"
                          fontSize="9"
                          className={`font-mono transition-colors ${
                            isHovered
                              ? "fill-indigo-600 dark:fill-indigo-400 font-bold"
                              : "fill-zinc-500 dark:fill-slate-400"
                          }`}
                        >
                          {c.p.name}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>

          {/* Floating Hover Tooltip */}
          {hoveredMonth !== null && chartData.points[hoveredMonth] && (
            <div
              className="absolute z-20 top-2 left-1/2 -translate-x-1/2 p-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl text-xs font-mono pointer-events-none flex items-center gap-3 backdrop-blur-md"
            >
              <div>
                <span className="font-bold text-indigo-300 uppercase">
                  {chartData.points[hoveredMonth].fullName}
                </span>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  <span className={chartPbf === "MBI" ? "text-blue-400 font-bold" : ""}>
                    MBI: <strong>{chartData.points[hoveredMonth].mbiOp} kasus</strong> ({chartData.points[hoveredMonth].mbiRate.toFixed(2)}%)
                  </span>
                  {" · "}
                  <span className={chartPbf === "MAI" ? "text-red-400 font-bold" : ""}>
                    MAI: <strong>{chartData.points[hoveredMonth].maiOp} kasus</strong> ({chartData.points[hoveredMonth].maiRate.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <div className="pl-2.5 border-l border-slate-700 text-right">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  {chartPbf === "MBI"
                    ? "MBI Operasional:"
                    : chartPbf === "MAI"
                    ? "MAI Operasional:"
                    : "Total Operasional:"}
                </div>
                <div className="text-sm font-black text-emerald-400">
                  {chartMetric === "count"
                    ? `${
                        chartPbf === "MBI"
                          ? chartData.points[hoveredMonth].mbiOp
                          : chartPbf === "MAI"
                          ? chartData.points[hoveredMonth].maiOp
                          : chartData.points[hoveredMonth].totOp
                      } kasus`
                    : `${(
                        chartPbf === "MBI"
                          ? chartData.points[hoveredMonth].mbiRate
                          : chartPbf === "MAI"
                          ? chartData.points[hoveredMonth].maiRate
                          : chartData.points[hoveredMonth].totRate
                      ).toFixed(2)}%`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-indigo-500 rounded-full" />
              <span className="font-bold text-zinc-800 dark:text-zinc-200">Semua PBF</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-blue-500 rounded-full" />
              <span className="text-zinc-600 dark:text-slate-400">MBI Saja</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-rose-500 rounded-full" />
              <span className="text-zinc-600 dark:text-slate-400">MAI Saja</span>
            </div>
          </div>
          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>100% Murni Evaluasi Performa Gudang (ED &amp; Damage Dieksklusi)</span>
          </div>
        </div>
      </div>

      {/* ─── 3. GRID MONTHLY CARDS (MAI RED & MBI BLUE) ─── */}
      <div className="space-y-5">
        {/* MAI ROW */}
        {(selectedPbfFilter === "ALL" || selectedPbfFilter === "MAI") && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <h3 className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                  Ringkasan Bulanan MAI (PT Medika Akses Investama)
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500 font-medium">
                Target Tampilan:{" "}
                <strong className="text-red-600 dark:text-red-400">
                  {categoryFilter === "ALL"
                    ? "Semua Kasus Diterima"
                    : categoryFilter === "OPERATIONAL"
                    ? "Murni Operasional"
                    : categoryFilter === "ED"
                    ? "Kasus ED"
                    : "Kasus Damage"}
                </strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2.5">
              {monthlyData.map((m) => {
                const isCurrent = m.isCurrent;
                return (
                  <div
                    key={`mai-${m.month}`}
                    onClick={() => {
                      setInspectModal({
                        isOpen: true,
                        month: m.month,
                        pbf: "MAI",
                        name: m.name,
                      });
                      if (onSelectMonth) onSelectMonth(m.month, "MAI");
                    }}
                    className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 group ${
                      isCurrent
                        ? "border-red-400 dark:border-red-500 border-dashed ring-2 ring-red-400/20 shadow-xs"
                        : "border-zinc-200 dark:border-slate-800 border-t-4 border-t-red-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-black text-zinc-500 dark:text-slate-400 uppercase tracking-wider truncate">
                        {m.name} {isCurrent ? "▲" : ""}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition">
                        Detail →
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-1">
                      <div className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">
                        {m.mai_target_count}
                      </div>
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-slate-300 font-mono">
                        {m.mai_rate}%
                      </span>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="flex items-center gap-1 flex-wrap mt-2 pt-2 border-t border-zinc-100 dark:border-slate-800/80 text-[9px] font-bold">
                      <span
                        className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                        title="Kasus Murni Operasional"
                      >
                        {m.mai_operational} Op
                      </span>
                      {m.mai_ed > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                          title="Kasus Expired Date"
                        >
                          {m.mai_ed} ED
                        </span>
                      )}
                      {m.mai_damage > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                          title="Kasus Damage / Rusak"
                        >
                          {m.mai_damage} Dmg
                        </span>
                      )}
                      {m.mai_reject > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-400"
                          title="Kasus Reject Apotek"
                        >
                          {m.mai_reject} Rej
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-zinc-400 dark:text-slate-500 font-mono truncate mt-1">
                      {m.mai_inv.toLocaleString("id-ID")} inv
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
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Ringkasan Bulanan MBI (PT Medika Bina Investama)
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500 font-medium">
                Target Tampilan:{" "}
                <strong className="text-blue-600 dark:text-blue-400">
                  {categoryFilter === "ALL"
                    ? "Semua Kasus Diterima"
                    : categoryFilter === "OPERATIONAL"
                    ? "Murni Operasional"
                    : categoryFilter === "ED"
                    ? "Kasus ED"
                    : "Kasus Damage"}
                </strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2.5">
              {monthlyData.map((m) => {
                const isCurrent = m.isCurrent;
                return (
                  <div
                    key={`mbi-${m.month}`}
                    onClick={() => {
                      setInspectModal({
                        isOpen: true,
                        month: m.month,
                        pbf: "MBI",
                        name: m.name,
                      });
                      if (onSelectMonth) onSelectMonth(m.month, "MBI");
                    }}
                    className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 group ${
                      isCurrent
                        ? "border-blue-400 dark:border-blue-500 border-dashed ring-2 ring-blue-400/20 shadow-xs"
                        : "border-zinc-200 dark:border-slate-800 border-t-4 border-t-blue-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-black text-zinc-500 dark:text-slate-400 uppercase tracking-wider truncate">
                        {m.name} {isCurrent ? "▲" : ""}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition">
                        Detail →
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-1">
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                        {m.mbi_target_count}
                      </div>
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-slate-300 font-mono">
                        {m.mbi_rate}%
                      </span>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="flex items-center gap-1 flex-wrap mt-2 pt-2 border-t border-zinc-100 dark:border-slate-800/80 text-[9px] font-bold">
                      <span
                        className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                        title="Kasus Murni Operasional"
                      >
                        {m.mbi_operational} Op
                      </span>
                      {m.mbi_ed > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                          title="Kasus Expired Date"
                        >
                          {m.mbi_ed} ED
                        </span>
                      )}
                      {m.mbi_damage > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                          title="Kasus Damage / Rusak"
                        >
                          {m.mbi_damage} Dmg
                        </span>
                      )}
                      {m.mbi_reject > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-400"
                          title="Kasus Reject Apotek"
                        >
                          {m.mbi_reject} Rej
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-zinc-400 dark:text-slate-500 font-mono truncate mt-1">
                      {m.mbi_inv.toLocaleString("id-ID")} inv
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. TABEL DETAIL MONTHLY DENGAN KOLOM KHUSUS ED & DAMAGE ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50 dark:bg-slate-950/40">
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Tabel Detail Bulanan Transparan</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                100% Sinkron Kasus
              </span>
            </h4>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
              Rincian komparasi MAI vs MBI per bulan — kolom <strong>Operasional</strong>, <strong>ED</strong>, dan{" "}
              <strong>Damage</strong> terisolasi mandiri.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-medium">
              Mode Rate: <strong>{categoryFilter}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-100/80 dark:bg-slate-950 text-zinc-700 dark:text-slate-300 font-black border-b border-zinc-200 dark:border-slate-800 text-[11px] uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-4">Bulan</th>
                <th className="py-3 px-3">PBF</th>
                <th className="py-3 px-3 text-right text-blue-600 dark:text-blue-400">
                  🔵 Operasional
                </th>
                <th className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">
                  🟡 Kasus ED
                </th>
                <th className="py-3 px-3 text-right text-rose-600 dark:text-rose-400">
                  🔴 Damage
                </th>
                <th className="py-3 px-3 text-right font-black">
                  Total Approve
                </th>
                <th className="py-3 px-3 text-right text-zinc-500">
                  Reject
                </th>
                <th className="py-3 px-3 text-right">Invoice</th>
                <th className="py-3 px-3 text-right">Error %</th>
                <th className="py-3 px-4">Visualisasi</th>
                <th className="py-3 px-3 text-right">Trend</th>
                <th className="py-3 px-3 text-center">Aksi Transparan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-slate-800/60 font-medium">
              {monthlyData.map((m) => {
                const monthName = m.name.charAt(0) + m.name.slice(1).toLowerCase();

                // Rows for MAI and MBI
                const rowsToShow = [];
                if (selectedPbfFilter === "ALL" || selectedPbfFilter === "MAI") {
                  rowsToShow.push({
                    pbf: "MAI" as const,
                    totalCases: m.mai_total_cases,
                    op: m.mai_operational,
                    ed: m.mai_ed,
                    dmg: m.mai_damage,
                    approve: m.mai_approve,
                    reject: m.mai_reject,
                    inv: m.mai_inv,
                    rate: m.mai_rate,
                    totalRate: m.mai_total_rate,
                    trend: m.mai_trend,
                    barColor: "bg-red-500",
                    badgeColor:
                      "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60",
                  });
                }
                if (selectedPbfFilter === "ALL" || selectedPbfFilter === "MBI") {
                  rowsToShow.push({
                    pbf: "MBI" as const,
                    totalCases: m.mbi_total_cases,
                    op: m.mbi_operational,
                    ed: m.mbi_ed,
                    dmg: m.mbi_damage,
                    approve: m.mbi_approve,
                    reject: m.mbi_reject,
                    inv: m.mbi_inv,
                    rate: m.mbi_rate,
                    totalRate: m.mbi_total_rate,
                    trend: m.mbi_trend,
                    barColor: "bg-blue-600",
                    badgeColor:
                      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60",
                  });
                }

                return rowsToShow.map((row, rIdx) => {
                  const maxRate = 3.5;
                  const barWidth = Math.min(100, (row.rate / maxRate) * 100);

                  return (
                    <tr
                      key={`${m.month}-${row.pbf}`}
                      className="hover:bg-zinc-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {rIdx === 0 ? (
                        <td
                          rowSpan={rowsToShow.length}
                          className="py-3 px-4 font-bold text-zinc-900 dark:text-white border-r border-zinc-100 dark:border-slate-800/40 align-middle bg-zinc-50/30 dark:bg-slate-950/20"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{monthName}</span>
                            {m.isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500 text-white font-black">
                                Kini
                              </span>
                            )}
                          </div>
                        </td>
                      ) : null}

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${row.badgeColor}`}
                        >
                          {row.pbf}
                        </span>
                      </td>

                      {/* 🔵 Operasional */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                        {row.op}
                      </td>

                      {/* 🟡 ED */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-300">
                        {row.ed}
                      </td>

                      {/* 🔴 Damage */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 dark:text-rose-300">
                        {row.dmg}
                      </td>

                      {/* Total Approve */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-zinc-900 dark:text-white">
                        {row.approve}
                      </td>

                      {/* Reject */}
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-500 dark:text-slate-400">
                        {row.reject || 0}
                      </td>

                      {/* Invoices */}
                      <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-slate-400 font-mono">
                        {row.inv.toLocaleString("id-ID")}
                      </td>

                      {/* Error Rate */}
                      <td className="py-2.5 px-3 text-right font-bold text-zinc-900 dark:text-white font-mono">
                        {row.rate.toFixed(2)}%
                      </td>

                      {/* Visual Bar */}
                      <td className="py-2.5 px-4">
                        <div className="w-full bg-zinc-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className={`h-full ${row.barColor} rounded-full transition-all`}
                            style={{ width: `${Math.max(4, barWidth)}%` }}
                          />
                        </div>
                      </td>

                      {/* Trend */}
                      <td className="py-2.5 px-3 text-right font-mono text-[11px]">
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

                      {/* Tombol Lihat Detail Transparan */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setInspectModal({
                              isOpen: true,
                              month: m.month,
                              pbf: row.pbf,
                              name: m.name,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 hover:bg-blue-50 text-zinc-700 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition border border-zinc-200 dark:border-slate-700 flex items-center gap-1 mx-auto cursor-pointer"
                          title={`Buka ${row.totalCases} kasus riil ${monthName} ${row.pbf}`}
                        >
                          <Eye className="w-3 h-3 text-blue-500" />
                          <span>{row.totalCases} Kasus</span>
                        </button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 5. MODAL INSPEKSI TRANSPARAN KASUS BULANAN ─── */}
      {inspectModal && inspectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs select-text">
          <div className="bg-white dark:bg-[#0c1222] border border-zinc-300 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
                  🔍
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>
                      Data Kasus Transparan: {inspectModal.name} {inspectModal.pbf !== "ALL" ? inspectModal.pbf : "Semua PBF"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                      {inspectCases.length} Kasus Terfilter
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                    Data 100% riil dari database — dapat diaudit sampai ke nomor faktur, produk, dan alasan spesifik.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Tutup (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar: Search & Sub-category Filter */}
            <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Cari No Invoice, No SO, Apotek, Produk, PIC, atau Alasan..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {modalSearch && (
                  <button
                    type="button"
                    onClick={() => setModalSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sub-Category Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {[
                  { id: "ALL", label: "Semua" },
                  { id: "OPERATIONAL", label: "🔵 Operasional" },
                  { id: "ED", label: "🟡 ED" },
                  { id: "DAMAGE", label: "🔴 Damage" },
                  { id: "REJECT", label: "⚪ Reject" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setModalFilterCat(f.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      modalFilterCat === f.id
                        ? "bg-blue-600 text-white font-black shadow-2xs"
                        : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body: Table of Cases */}
            <div className="overflow-auto flex-1 p-2 sm:p-4">
              {inspectCases.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">
                  <div className="text-3xl mb-2">📭</div>
                  <div className="text-sm font-bold">Tidak ada kasus yang sesuai dengan filter</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Coba ganti kata kunci pencarian atau ubah filter kategori di atas.
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-100 dark:bg-slate-950 text-zinc-700 dark:text-slate-300 font-black text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-zinc-200 dark:border-slate-800 select-none">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Tgl Lapor</th>
                      <th className="py-2.5 px-3">No Invoice / SO</th>
                      <th className="py-2.5 px-3">Pelanggan (Apotek)</th>
                      <th className="py-2.5 px-3">Produk &amp; Qty</th>
                      <th className="py-2.5 px-3">Klasifikasi &amp; Alasan</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Konfirmasi</th>
                      <th className="py-2.5 px-3">Root Cause / PIC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-slate-800/60 font-medium">
                    {inspectCases.map((r, idx) => {
                      const cat = classifyReasonCategory(r.reason);
                      const conf = (r.confirm || "").toLowerCase();
                      const stat = (r.status || "").toLowerCase();
                      const isRej = conf.includes("reject") || conf.includes("tolak") || stat.includes("reject");

                      let catBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 inline-flex items-center gap-1">
                          <span>🔵</span>
                          <span>OPERASIONAL</span>
                        </span>
                      );

                      if (cat === "ed") {
                        catBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1">
                            <span>🟡</span>
                            <span>ED (KADALUARSA)</span>
                          </span>
                        );
                      } else if (cat === "damage") {
                        catBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 inline-flex items-center gap-1">
                            <span>🔴</span>
                            <span>DAMAGE (RUSAK)</span>
                          </span>
                        );
                      }

                      return (
                        <tr
                          key={r.id || idx}
                          onClick={() => {
                            if (onSelectReturn) onSelectReturn(r);
                          }}
                          className="hover:bg-blue-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-3 text-zinc-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Tgl Lapor */}
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-zinc-600 dark:text-slate-400">
                            {r.report_date || r.invoice_date || "-"}
                          </td>

                          {/* No Inv / SO */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="font-bold font-mono text-zinc-900 dark:text-white">
                              {r.invoice_no || `ID #${r.id}`}
                            </div>
                            {r.so_no && (
                              <div className="text-[10px] text-zinc-500 font-mono">
                                SO: {r.so_no}
                              </div>
                            )}
                          </td>

                          {/* Pelanggan */}
                          <td className="py-2 px-3 font-bold text-zinc-800 dark:text-slate-200 max-w-[200px] truncate">
                            {r.customer_name || "-"}
                          </td>

                          {/* Produk & Qty */}
                          <td className="py-2 px-3 max-w-[240px]">
                            <div className="font-medium text-zinc-900 dark:text-slate-100 truncate">
                              {r.product_name || "-"}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              Qty: <strong>{r.qty || 0}</strong> {r.batch_no ? `· Batch: ${r.batch_no}` : ""}
                            </div>
                          </td>

                          {/* Klasifikasi & Reason */}
                          <td className="py-2 px-3">
                            <div className="mb-0.5">{catBadge}</div>
                            <div className="text-[11px] text-zinc-700 dark:text-slate-300 font-medium leading-tight">
                              {r.reason || "-"}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                stat.includes("resolved")
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : stat.includes("in progress")
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              {r.status || "Pending"}
                            </span>
                          </td>

                          {/* Konfirmasi */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isRej
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              }`}
                            >
                              {isRej ? "Reject" : "Approve"}
                            </span>
                          </td>

                          {/* Root Cause / PIC */}
                          <td className="py-2 px-3 text-[11px] text-zinc-600 dark:text-slate-400">
                            <div>{r.root_cause || "-"}</div>
                            {r.person && (
                              <div className="text-[10px] font-bold text-zinc-500 mt-0.5">
                                PIC: {r.person}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-950 flex items-center justify-between gap-3 text-xs shrink-0">
              <span className="text-zinc-500 dark:text-slate-400 font-medium">
                Menampilkan <strong>{inspectCases.length}</strong> kasus riil untuk periode{" "}
                <strong>
                  {inspectModal.name} {inspectModal.pbf}
                </strong>
              </span>

              <button
                type="button"
                onClick={() => setInspectModal(null)}
                className="px-4 py-1.5 rounded-xl border border-zinc-300 dark:border-slate-700 font-bold hover:bg-zinc-200 dark:hover:bg-slate-800 transition cursor-pointer"
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
