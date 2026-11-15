"use client";

import { useState } from "react";
import {
  BarChart3,
  Package,
  Layers,
  Users,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Building2,
  HelpCircle,
} from "lucide-react";

export interface ParetoCategoryItem {
  category: string;
  totalQty: number;
  orderCount: number;
  pct: number;
  cumPct: number;
  paretoClass: "A" | "B" | "C";
  topCustomers: Array<{ name: string; qty: number }>;
}

export interface ParetoProductItem {
  code: string;
  name: string;
  category: string;
  totalQty: number;
  orderCount: number;
  pct: number;
  cumPct: number;
  paretoClass: "A" | "B" | "C";
  topCustomers: Array<{ name: string; qty: number }>;
}

export interface ParetoCustomerItem {
  name: string;
  count: number;
  totalQty?: number;
}

interface ParetoAnalysisViewProps {
  categories: ParetoCategoryItem[];
  products: ParetoProductItem[];
  topCustomers: ParetoCustomerItem[];
  warehouseFilter: "ALL" | "MBI" | "MAI";
  isDarkMode: boolean;
}

export default function ParetoAnalysisView({
  categories = [],
  products = [],
  topCustomers = [],
  warehouseFilter,
  isDarkMode,
}: ParetoAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState<"category" | "product" | "customer">("category");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

  const filteredProducts = selectedCategoryFilter === "ALL"
    ? products
    : products.filter((p) => p.category.toUpperCase() === selectedCategoryFilter.toUpperCase());

  const categoryColorMap: Record<string, string> = {
    FARMA: "bg-blue-500 text-blue-100",
    ALKES: "bg-emerald-500 text-emerald-100",
    PREKURSOR: "bg-purple-500 text-purple-100",
    OOT: "bg-amber-500 text-amber-100",
    CCP: "bg-cyan-500 text-cyan-100",
    NARKOTIKA: "bg-rose-500 text-rose-100",
    PSIKOTROPIKA: "bg-indigo-500 text-indigo-100",
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm space-y-4 ${
      isDarkMode ? "bg-[#0f172a] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
    }`}>
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
            <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <span>Analisis Pareto Barang & Kategori Pesanan (Aturan 80/20)</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {warehouseFilter === "ALL" ? "MBI + MAI" : warehouseFilter}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Identifikasi kategori barang dan produk yang paling banyak dipesan untuk efisiensi operasional picking &amp; ketersediaan stok
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("category")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "category"
                ? "bg-white text-zinc-900 dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Kategori Barang</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("product")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "product"
                ? "bg-white text-zinc-900 dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-500" />
            <span>Produk Terbanyak</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customer")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "customer"
                ? "bg-white text-zinc-900 dark:bg-slate-800 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-500" />
            <span>Pelanggan Utama</span>
          </button>
        </div>
      </div>

      {/* Pareto Classification Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-slate-900/60 border border-zinc-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-slate-300 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-bold">Prinsip Pareto:</span>
          <span className="text-[11px] text-zinc-500">20% ragam barang berkontribusi terhadap 80% volume pesanan</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <strong className="text-emerald-700 dark:text-emerald-400">Kelas A</strong> (0–80% Dominan)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <strong className="text-amber-700 dark:text-amber-400">Kelas B</strong> (80–95% Menengah)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <strong className="text-zinc-600 dark:text-slate-400">Kelas C</strong> (95–100% Rendah)
          </span>
        </div>
      </div>

      {/* ─── TAB 1: PARETO KATEGORI BARANG ─── */}
      {activeTab === "category" && (
        <div className="space-y-3">
          {categories.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Tidak ada data kategori barang pada rentang tanggal terpilih
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((c, idx) => {
                const badgeColor =
                  c.paretoClass === "A"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                    : c.paretoClass === "B"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700";

                return (
                  <div
                    key={c.category}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                      isDarkMode ? "bg-[#090d18] border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>
                      {/* Top Row: Category & Class */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-zinc-400">#{idx + 1}</span>
                          <span className="font-black text-sm text-zinc-900 dark:text-white uppercase tracking-wider">
                            {c.category}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          Kelas {c.paretoClass}
                        </span>
                      </div>

                      {/* Main Metric: Total Qty Dipesan */}
                      <div className="mt-2 flex items-baseline justify-between">
                        <div>
                          <div className="text-[10px] text-zinc-500 font-semibold uppercase">Total Kuantitas Pesanan</div>
                          <div className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white">
                            {Math.round(c.totalQty).toLocaleString("id-ID")}{" "}
                            <span className="text-xs font-medium text-zinc-500 font-sans">unit</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {c.pct}%
                          </span>
                          <div className="text-[9px] text-zinc-400 font-mono">Porsi Total</div>
                        </div>
                      </div>

                      {/* Cumulative Progress Bar */}
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                          <span>Kumulatif Pareto</span>
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">{c.cumPct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              c.paretoClass === "A"
                                ? "bg-emerald-500"
                                : c.paretoClass === "B"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                            style={{ width: `${Math.min(100, c.cumPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Top Customer Pemesan Kategori Ini (Pareto to Customer) */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-slate-800/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Pemesan Terbesar (Outlet):
                      </div>
                      {c.topCustomers && c.topCustomers.length > 0 ? (
                        <div className="space-y-1">
                          {c.topCustomers.map((cust, cIdx) => (
                            <div
                              key={cIdx}
                              className="flex items-center justify-between text-[11px] font-medium"
                            >
                              <span className="truncate max-w-[160px] text-zinc-700 dark:text-zinc-300" title={cust.name}>
                                {cust.name}
                              </span>
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                {Math.round(cust.qty).toLocaleString("id-ID")} unit
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400">Tidak ada rincian pelanggan</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: PARETO PRODUK TERLARIS (TOP ORDERED PRODUCTS) ─── */}
      {activeTab === "product" && (
        <div className="space-y-3">
          {/* Category Filter Pills for Products */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1 text-xs">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Filter Kategori:</span>
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedCategoryFilter === "ALL"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                  : "text-zinc-600 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-slate-800"
              }`}
            >
              Semua ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                type="button"
                onClick={() => setSelectedCategoryFilter(c.category)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategoryFilter === c.category
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-zinc-600 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-slate-800"
                }`}
              >
                {c.category}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-slate-900 text-zinc-500 uppercase text-[10px] tracking-wider font-bold border-b border-zinc-200 dark:border-slate-800">
                  <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-3">Nama Produk / Barang</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Total Qty Dipesan</th>
                  <th className="py-2.5 px-3 text-right">Porsi (%)</th>
                  <th className="py-2.5 px-3 text-center">Kelas</th>
                  <th className="py-2.5 px-3">Outlet Utama Pemesan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-slate-800 font-medium">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400 text-xs">
                      Tidak ada produk pada kategori terpilih
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p, idx) => {
                    const badgeColor =
                      p.paretoClass === "A"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : p.paretoClass === "B"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                    return (
                      <tr key={idx} className="hover:bg-zinc-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                            {p.code && <span className="text-[10px] text-zinc-400 font-mono">{p.code}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-slate-700">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {Math.round(p.totalQty).toLocaleString("id-ID")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                          {p.pct}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${badgeColor}`}>
                            {p.paretoClass}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-zinc-600 dark:text-zinc-300 max-w-[220px] truncate">
                          {p.topCustomers && p.topCustomers.length > 0
                            ? p.topCustomers.map((c) => `${c.name} (${Math.round(c.qty)})`).join(", ")
                            : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: PARETO PELANGGAN UTAMA ─── */}
      {activeTab === "customer" && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-slate-900 text-zinc-500 uppercase text-[10px] tracking-wider font-bold border-b border-zinc-200 dark:border-slate-800">
                  <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-3">Nama Outlet / Pelanggan</th>
                  <th className="py-2.5 px-3 text-right">Frekuensi Faktur</th>
                  <th className="py-2.5 px-3 text-center">Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-slate-800 font-medium">
                {topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-400 text-xs">
                      Tidak ada data pelanggan pada rentang tanggal terpilih
                    </td>
                  </tr>
                ) : (
                  topCustomers.map((c, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {c.count.toLocaleString("id-ID")} Faktur
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Pelanggan Aktif
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
