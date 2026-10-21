"use client";

import { useState, useMemo } from "react";
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Check,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { ShipmentReturnRecord } from "@/lib/types";

interface OpenCasesViewProps {
  returns: ShipmentReturnRecord[];
  onRefreshParentReturns?: () => void;
}

export default function OpenCasesView({
  returns = [],
  onRefreshParentReturns,
}: OpenCasesViewProps) {
  const [filterTier, setFilterTier] = useState<"ALL" | "kritis" | "tinggi" | "sedang" | "normal">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Parse days open
  const openCases = useMemo(() => {
    const today = new Date().getTime();

    const list = returns.filter((r) => {
      const st = (r.status || "").toLowerCase();
      const conf = (r.confirm || "").toLowerCase();
      // Not resolved and not rejected
      const isResolved = st.includes("resolved") || st.includes("selesai");
      const isReject = conf.includes("reject") || conf.includes("tolak") || st.includes("reject");
      return !isResolved && !isReject;
    });

    return list.map((item) => {
      let days = 0;
      const rawDate = item.report_date || item.invoice_date || item.created_at;
      if (rawDate) {
        try {
          let d: Date | null = null;
          if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
            d = new Date(rawDate);
          } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(rawDate)) {
            const parts = rawDate.split(/[\/\-]/);
            d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          } else {
            d = new Date(rawDate);
          }
          if (d && !isNaN(d.getTime())) {
            days = Math.max(0, Math.floor((today - d.getTime()) / 86400000));
          }
        } catch {}
      }

      let tier: "kritis" | "tinggi" | "sedang" | "normal" = "normal";
      let tierLabel = "Normal (1-2 hari)";
      let tierBadge = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300";

      if (days >= 15) {
        tier = "kritis";
        tierLabel = "🔴 Kritis (≥ 15 hari)";
        tierBadge = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300";
      } else if (days >= 6) {
        tier = "tinggi";
        tierLabel = "🟠 Tinggi (6-14 hari)";
        tierBadge = "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300";
      } else if (days >= 3) {
        tier = "sedang";
        tierLabel = "🟡 Sedang (3-5 hari)";
        tierBadge = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300";
      }

      return {
        ...item,
        days,
        tier,
        tierLabel,
        tierBadge,
      };
    }).sort((a, b) => b.days - a.days);
  }, [returns]);

  // Counts by tier
  const tierCounts = useMemo(() => {
    let kritis = 0;
    let tinggi = 0;
    let sedang = 0;
    let normal = 0;

    for (const c of openCases) {
      if (c.tier === "kritis") kritis++;
      else if (c.tier === "tinggi") tinggi++;
      else if (c.tier === "sedang") sedang++;
      else normal++;
    }

    return { total: openCases.length, kritis, tinggi, sedang, normal };
  }, [openCases]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return openCases.filter((c) => {
      if (filterTier !== "ALL" && c.tier !== filterTier) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (c.invoice_no && c.invoice_no.toLowerCase().includes(q)) ||
          (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
          (c.product_name && c.product_name.toLowerCase().includes(q)) ||
          (c.reason && c.reason.toLowerCase().includes(q)) ||
          (c.person && c.person.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [openCases, filterTier, searchQuery]);

  // One-click mark resolved
  const handleMarkResolved = async (id: number) => {
    if (!confirm("Tandai kasus ini sebagai Selesai / Resolved?")) return;
    setUpdatingId(id);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/tidb?action=update_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "Resolved",
          resolved_date: today,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (onRefreshParentReturns) onRefreshParentReturns();
      } else {
        alert(json.error || "Gagal memperbarui status.");
      }
    } catch (e: any) {
      alert("Error: " + e?.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Tier Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setFilterTier("ALL")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTier === "ALL"
              ? "bg-white dark:bg-zinc-800 border-zinc-900 dark:border-white shadow-sm"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
          }`}
        >
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Semua Open
          </span>
          <span className="text-xl font-black text-zinc-900 dark:text-white mt-0.5 block">
            {tierCounts.total}
          </span>
        </div>

        <div
          onClick={() => setFilterTier("kritis")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTier === "kritis"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-sm"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-rose-400"
          }`}
        >
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            🔴 Kritis (≥ 15 hari)
          </span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
            {tierCounts.kritis}
          </span>
        </div>

        <div
          onClick={() => setFilterTier("tinggi")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTier === "tinggi"
              ? "bg-orange-50 dark:bg-orange-950/40 border-orange-500 shadow-sm"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-orange-400"
          }`}
        >
          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
            🟠 Tinggi (6-14 hari)
          </span>
          <span className="text-xl font-black text-orange-600 dark:text-orange-400 mt-0.5 block">
            {tierCounts.tinggi}
          </span>
        </div>

        <div
          onClick={() => setFilterTier("sedang")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTier === "sedang"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-sm"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-amber-400"
          }`}
        >
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            🟡 Sedang (3-5 hari)
          </span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
            {tierCounts.sedang}
          </span>
        </div>

        <div
          onClick={() => setFilterTier("normal")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTier === "normal"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-400"
          }`}
        >
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            🟢 Normal (1-2 hari)
          </span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {tierCounts.normal}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="text-xs text-zinc-500 font-medium">
          Menampilkan <span className="font-bold text-zinc-800 dark:text-zinc-200">{filteredCases.length}</span> kasus menggantung yang memerlukan tindakan segera.
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari faktur, apotek, atau PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 backdrop-blur-sm text-zinc-700 dark:text-zinc-300 font-bold">
                <th className="py-3 px-3">Durasi Menggantung</th>
                <th className="py-3 px-3">PBF</th>
                <th className="py-3 px-3">No. Faktur</th>
                <th className="py-3 px-3">Apotek / Outlet</th>
                <th className="py-3 px-3">Nama Produk</th>
                <th className="py-3 px-3">Jenis Masalah</th>
                <th className="py-3 px-3">PIC / Personil</th>
                <th className="py-3 px-3 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Tidak ada kasus menggantung pada kategori ini. Bagus!
                  </td>
                </tr>
              ) : (
                filteredCases.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${row.tierBadge}`}>
                        <Clock className="w-3 h-3" />
                        <span>{row.days} hari ({row.tier})</span>
                      </span>
                    </td>
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
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 max-w-[180px] truncate">
                      {row.reason || "-"}
                    </td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                      {row.person || "-"}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        disabled={updatingId === row.id}
                        onClick={() => handleMarkResolved(row.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 mx-auto cursor-pointer shadow-2xs transition-all disabled:opacity-50"
                        title="Tandai kasus ini selesai"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{updatingId === row.id ? "Memproses..." : "Selesaikan"}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
