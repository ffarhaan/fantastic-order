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
  X,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Package,
} from "lucide-react";
import { ShipmentReturnRecord } from "@/lib/types";
import { broadcastRealtimeSignal } from "@/lib/firestoreService";

interface OpenCasesViewProps {
  returns: ShipmentReturnRecord[];
  onRefreshParentReturns?: () => void;
  onSelectInvoice?: (invoiceNo: string) => void;
  onSelectReturn?: (item: ShipmentReturnRecord) => void;
}

export default function OpenCasesView({
  returns = [],
  onRefreshParentReturns,
  onSelectInvoice,
  onSelectReturn,
}: OpenCasesViewProps) {
  const [filterTier, setFilterTier] = useState<"ALL" | "kritis" | "tinggi" | "sedang" | "normal">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirmResolveCase, setConfirmResolveCase] = useState<ShipmentReturnRecord | null>(null);
  const [warningModal, setWarningModal] = useState<{
    row: ShipmentReturnRecord;
    missing: string[];
  } | null>(null);

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

  // Counts by tier & status
  const tierCounts = useMemo(() => {
    let kritis = 0;
    let tinggi = 0;
    let sedang = 0;
    let normal = 0;
    let inProgress = 0;
    let pending = 0;

    for (const c of openCases) {
      if (c.tier === "kritis") kritis++;
      else if (c.tier === "tinggi") tinggi++;
      else if (c.tier === "sedang") sedang++;
      else normal++;

      if ((c.status || "").toLowerCase() === "in progress") {
        inProgress++;
      } else {
        pending++;
      }
    }

    return { total: openCases.length, kritis, tinggi, sedang, normal, inProgress, pending };
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

  // Handler sebelum konfirmasi selesai: WAJIB periksa kelengkapan Tindakan, Penyebab, & Personil
  const handleRequestResolve = (row: ShipmentReturnRecord) => {
    const hasAction = row.action && row.action.trim() && row.action !== "-" && row.action !== "#N/A";
    const hasRootCause = row.root_cause && row.root_cause.trim() && row.root_cause !== "-" && row.root_cause !== "#N/A";
    const hasPerson = row.person && row.person.trim() && row.person !== "-" && row.person !== "#N/A";

    if (!hasAction || !hasRootCause || !hasPerson) {
      const missing: string[] = [];
      if (!hasAction) missing.push("Tindakan Solusi Gudang (Action)");
      if (!hasRootCause) missing.push("Penyebab Kesalahan (Root Cause)");
      if (!hasPerson) missing.push("Personil Terkait (Picker / Checker)");

      setWarningModal({ row, missing });
      return;
    }

    setConfirmResolveCase(row);
  };

  // One-click mark resolved with confirmation modal
  const handleExecuteResolve = async () => {
    if (!confirmResolveCase) return;
    const target = confirmResolveCase;
    setUpdatingId(target.id);
    setConfirmResolveCase(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/tidb?action=update_return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: target.id,
          invoice_no: target.invoice_no,
          status: "Resolved",
          resolved_date: today,
        }),
      });
      const json = await res.json();
      if (json.success) {
        broadcastRealtimeSignal("returns");
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
    <div className="space-y-4">
      {/* Tier Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        <div
          onClick={() => setFilterTier("ALL")}
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer touch-manipulation ${
            filterTier === "ALL"
              ? "bg-white dark:bg-zinc-800 border-zinc-900 dark:border-white shadow-sm"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
          }`}
        >
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Semua Open
          </span>
          <div className="flex items-baseline justify-between gap-1 mt-0.5">
            <span className="text-xl font-black text-zinc-900 dark:text-white">
              {tierCounts.total}
            </span>
            <span className="text-[10px] font-semibold text-zinc-500">
              <span className="text-blue-600 dark:text-blue-400 font-bold">{tierCounts.inProgress}</span> kirim • <span className="text-amber-600 dark:text-amber-400 font-bold">{tierCounts.pending}</span> pending
            </span>
          </div>
        </div>

        <div
          onClick={() => setFilterTier("kritis")}
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer touch-manipulation ${
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
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer touch-manipulation ${
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
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer touch-manipulation ${
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
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer touch-manipulation ${
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

      {/* Mobile Cards View (Khusus iPhone & Layar Kecil) */}
      <div className="block md:hidden space-y-3 pb-24 max-w-full overflow-hidden">
        {filteredCases.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
            <p className="font-bold text-xs text-zinc-700 dark:text-zinc-200">Tidak ada kasus menggantung</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Semua pengiriman berjalan lancar atau sudah tuntas.</p>
          </div>
        ) : (
          filteredCases.map((row) => (
            <div
              key={`mobile-open-${row.id}`}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-xs space-y-2.5 max-w-full overflow-hidden"
            >
              {/* Baris 1: PBF + Faktur Link + Durasi + Status */}
              <div className="flex items-center justify-between gap-1.5 flex-wrap pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      row.pbf === "MAI"
                        ? "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30"
                        : "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                    }`}
                  >
                    {row.pbf || "MBI"}
                  </span>

                  {row.invoice_no && row.invoice_no !== "-" && row.invoice_no !== "#N/A" && onSelectInvoice ? (
                    <button
                      type="button"
                      onClick={() => onSelectInvoice(row.invoice_no)}
                      className="font-mono text-xs font-bold text-blue-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer touch-manipulation"
                      title="Buka Faktur Terkait"
                    >
                      <span>#{row.invoice_no}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono text-zinc-500">#{row.invoice_no || row.id}</span>
                  )}

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.tierBadge}`}>
                    <Clock className="w-2.5 h-2.5" />
                    <span>{row.days}h ({row.tier})</span>
                  </span>
                </div>

                {row.status === "In Progress" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>In Progress</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Pending</span>
                  </span>
                )}
              </div>

              {/* Baris 2: Nama Apotek/Outlet + Nama Produk */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                  {row.customer_name || "-"}
                </h4>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                  Produk: {row.product_name || "-"}
                </div>
              </div>

              {/* Baris 3: Jenis Kendala + PIC Personil */}
              <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
                <div className="text-amber-700 dark:text-amber-400 font-bold truncate">
                  <span>Kendala: </span>
                  <span className="font-semibold">{row.reason || "-"}</span>
                </div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium truncate">
                  <span>PIC (Picker/Checker): </span>
                  <strong className="text-zinc-800 dark:text-zinc-200">{row.person || "-"}</strong>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-1">
                {row.status === "In Progress" ? (
                  <button
                    type="button"
                    disabled={updatingId === row.id}
                    onClick={() => handleRequestResolve(row)}
                    className="w-full h-9 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors touch-manipulation cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{updatingId === row.id ? "Memproses..." : "Selesaikan Kasus"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectReturn && onSelectReturn(row)}
                    className="w-full h-9 py-2 px-3 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors touch-manipulation cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Tindak Lanjut / Verifikasi</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop & Tablet Table Container */}
      <div className="hidden md:block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 text-zinc-700 dark:text-zinc-300 font-bold">
                <th className="py-3 px-3">Durasi Menggantung</th>
                <th className="py-3 px-3">PBF</th>
                <th className="py-3 px-3">Status / Tahap</th>
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
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
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
                    <td className="py-3 px-3 whitespace-nowrap">
                      {row.status === "In Progress" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pending Review
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {row.invoice_no && row.invoice_no !== "-" && row.invoice_no !== "#N/A" && onSelectInvoice ? (
                        <button
                          type="button"
                          onClick={() => onSelectInvoice(row.invoice_no)}
                          className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                          title="Buka Faktur Terkait di Daftar Faktur"
                        >
                          <span>#{row.invoice_no}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      ) : (
                        <span>{row.invoice_no || "-"}</span>
                      )}
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
                      {row.status === "In Progress" ? (
                        <button
                          type="button"
                          disabled={updatingId === row.id}
                          onClick={() => handleRequestResolve(row)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 mx-auto cursor-pointer shadow-xs transition-all disabled:opacity-50"
                          title="Tandai kasus ini selesai (barang pengganti sudah sampai di apotek)"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{updatingId === row.id ? "Memproses..." : "Selesaikan"}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectReturn && onSelectReturn(row)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 mx-auto cursor-pointer shadow-xs transition-all"
                          title="Verifikasi bukti fisik & tetapkan PIC gudang"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Tindak Lanjut / Verifikasi</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pop-up Konfirmasi Akhir Penerimaan Barang */}
      {confirmResolveCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  Konfirmasi Penerimaan Barang
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Faktur #{confirmResolveCase.invoice_no} • {confirmResolveCase.customer_name}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 font-medium leading-relaxed">
              Apakah fisik barang pengganti sudah benar-benar sampai dan diterima dengan baik oleh pihak apotek?
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmResolveCase(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer"
              >
                Belum Sampai
              </button>
              <button
                type="button"
                onClick={handleExecuteResolve}
                className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Ya, Fisik Sudah Sampai &amp; Selesai ✓</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Peringatan Kelengkapan Investigasi Gudang */}
      {warningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white dark:bg-zinc-900 border border-amber-400/80 dark:border-amber-600/80 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg shrink-0 mt-0.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  Tiket Belum Dapat Diselesaikan
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                  Faktur #{warningModal.row.invoice_no || warningModal.row.id} • {warningModal.row.customer_name || ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWarningModal(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-zinc-800 dark:text-zinc-200 space-y-2.5 leading-relaxed">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Pada tahap In Progress, Anda wajib melengkapi data investigasi gudang berikut terlebih dahulu sebelum menyelesaikan tiket:
              </p>

              <div className="space-y-1.5 pt-1">
                {warningModal.missing.map((field, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-amber-200/80 dark:border-amber-800/60 text-xs font-bold text-amber-800 dark:text-amber-300 shadow-2xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span>{field}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                💡 Silakan klik tombol di bawah untuk membuka form tiket dan melengkapi data investigasi.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  const r = warningModal.row;
                  setWarningModal(null);
                  if (onSelectReturn) onSelectReturn(r);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black text-black bg-amber-400 hover:bg-amber-500 shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Buka Detail &amp; Lengkapi Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
