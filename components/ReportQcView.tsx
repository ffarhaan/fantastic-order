"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { QcCatatanBarangEntry } from "@/lib/qcParser";
import { isSuperAdminUser } from "@/lib/firestoreService";
import { subscribeToDoCheckerLive } from "@/lib/doCheckerService";

export interface SoDetail {
  customerName: string;
  orderDate: string;
  transactionDate: string;
  totalItems: number;
  totalQty: number;
  invoiceNumber?: string;
}

interface ReportQcViewProps {
  qcOrders: any[];
  warehouse: "MBI" | "MAI";
  currentUser?: { name?: string | null; email?: string | null } | null;
  isDarkMode: boolean;
  existingSOSet: Set<string>;
  soDetailsMap: Map<string, SoDetail>;
  onRefreshQc: (fresh?: boolean) => Promise<void>;
  onCancelQcOrder?: (soNum: string) => Promise<void>;
  onOpenAnnouncement?: () => void;
}

const PAGE_SIZE = 50; // 50 baris per halaman identik dengan Laptop 1 (60-120 FPS tanpa lag)

// ============================================================================
// MEMOIZED ROW COMPONENT: Hanya re-render baris yang aktif berubah (0.05ms render)
// ============================================================================
interface ReportQcRowProps {
  row: any;
  rowIdx: number;
  isSelectedRow: boolean;
  selectedColIdx: number;
  isDarkMode: boolean;
  onSelectCell: (rowIdx: number, colIdx: number) => void;
  onCopyCell: (row: any, colIdx: number) => void;
  onMarkDone: (so: string) => void;
  onCancelQcOrder?: (so: string) => void;
  canCancel: boolean;
  onViewCatatan: (so: string) => void;
  setRowRef: (el: HTMLTableRowElement | null) => void;
}

const ReportQcRow = React.memo(
  function ReportQcRow({
    row,
    rowIdx,
    isSelectedRow,
    selectedColIdx,
    isDarkMode,
    onSelectCell,
    onCopyCell,
    onMarkDone,
    onCancelQcOrder,
    canCancel,
    onViewCatatan,
    setRowRef,
  }: ReportQcRowProps) {
    const jmlCatatan = Number(row.barang_catatan) || 0;

    const getCellCls = (colIdx: number) =>
      isSelectedRow && selectedColIdx === colIdx
        ? isDarkMode
          ? "ring-2 ring-amber-400 ring-inset bg-amber-500/20 text-white font-bold"
          : "ring-2 ring-amber-500 ring-inset bg-amber-100 text-black font-bold"
        : "";

    return (
      <tr
        ref={setRowRef}
        className={`transition-colors select-text ${
          isSelectedRow
            ? isDarkMode
              ? "bg-slate-800/50 border-l-4 border-l-amber-400"
              : "bg-amber-50/70 border-l-4 border-l-amber-500"
            : !row.is_invoiced
            ? isDarkMode
              ? "bg-rose-950/10 hover:bg-rose-950/20"
              : "bg-rose-50/30 hover:bg-rose-50/60"
            : row.is_done_flag
            ? isDarkMode
              ? "bg-emerald-950/10 hover:bg-emerald-950/20"
              : "bg-emerald-50/40 hover:bg-emerald-50/70"
            : isDarkMode
            ? "hover:bg-slate-800/30"
            : "hover:bg-slate-50"
        }`}
      >
        {/* Col 0: Waktu Kirim */}
        <td
          onClick={() => onSelectCell(rowIdx, 0)}
          className={`px-3 py-2 ${isDarkMode ? "text-cyan-400 font-bold" : "text-blue-950 font-black"} whitespace-nowrap text-[11px] cursor-pointer ${getCellCls(0)}`}
        >
          {row.waktu_kirim || "-"}
        </td>

        {/* Col 1: NO DO */}
        <td
          onClick={() => onSelectCell(rowIdx, 1)}
          className={`px-3 py-2 ${isDarkMode ? "font-medium text-slate-300" : "font-bold text-slate-900"} whitespace-nowrap cursor-pointer ${getCellCls(1)}`}
        >
          {row.no_do || "-"}
        </td>

        {/* Col 2: No SO (Default Highlight Cell) */}
        <td
          onClick={() => onSelectCell(rowIdx, 2)}
          className={`px-3 py-2 whitespace-nowrap cursor-pointer ${getCellCls(2)}`}
        >
          <div className="flex items-center gap-1.5">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelectCell(rowIdx, 2);
                onCopyCell(row, 2);
              }}
              className={`font-bold ${isDarkMode ? "text-amber-300 hover:text-amber-100" : "text-amber-950 font-black hover:text-amber-700"} flex items-center gap-1 group`}
              title="Klik untuk salin No SO (atau tekan C saat sel aktif)"
            >
              <span>{row.so_number}</span>
              <span className={`text-[10px] ${isDarkMode ? "text-slate-400 group-hover:text-amber-300" : "text-slate-600 group-hover:text-amber-800 font-bold"} opacity-60 group-hover:opacity-100 transition`}>
                📋
              </span>
            </span>

            {/* Tanda Status Faktur: CUKUP Tanda Seru Merah '!' jika belum ada inv */}
            {!row.is_invoiced ? (
              <span
                className={`text-sm px-1.5 py-0.2 rounded font-mono inline-flex items-center justify-center leading-none shadow-xs cursor-help ${isDarkMode ? "text-rose-500 font-black bg-rose-500/15 border border-rose-500/40" : "text-rose-700 font-black bg-rose-100 border border-rose-500"}`}
                title="Faktur Oracle belum terbit / belum diupload"
              >
                !
              </span>
            ) : (
              <span
                className={`rounded px-1.5 py-0.2 text-[9px] font-sans font-bold whitespace-nowrap border ${isDarkMode ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" : "bg-cyan-100 text-cyan-950 border-cyan-500 font-black"}`}
                title={`Sudah Terbit Faktur: ${row.invoice_number || "Terbit"}`}
              >
                ✓ Inv {row.invoice_number ? `: ${row.invoice_number}` : ""}
              </span>
            )}
          </div>
        </td>

        {/* Col 3: Apotek / Pelanggan */}
        <td
          onClick={() => onSelectCell(rowIdx, 3)}
          className={`px-3 py-2 max-w-xs truncate font-sans ${isDarkMode ? "text-slate-200 font-normal" : "text-slate-950 font-bold"} cursor-pointer ${getCellCls(3)}`}
          title={row.customer_name || "-"}
        >
          {row.customer_name || "-"}
        </td>

        {/* Col 4: Total Item */}
        <td
          onClick={() => onSelectCell(rowIdx, 4)}
          className={`px-2.5 py-2 text-center ${isDarkMode ? "text-slate-300" : "text-slate-900 font-bold"} cursor-pointer ${getCellCls(4)}`}
        >
          {row.total_item}
        </td>

        {/* Col 5: Total Qty */}
        <td
          onClick={() => onSelectCell(rowIdx, 5)}
          className={`px-2.5 py-2 text-center ${isDarkMode ? "text-slate-300 font-bold" : "text-slate-950 font-black"} cursor-pointer ${getCellCls(5)}`}
        >
          {row.total_qty}
        </td>

        {/* Col 6: Jml Barang Catatan */}
        <td
          onClick={() => onSelectCell(rowIdx, 6)}
          className={`px-3 py-2 text-center whitespace-nowrap cursor-pointer ${getCellCls(6)}`}
        >
          {jmlCatatan === 0 ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${isDarkMode ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-emerald-100 text-emerald-950 border-emerald-500 font-black"}`}>
              ✓ 0 (Siap)
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewCatatan(row.so_number);
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition cursor-pointer border ${isDarkMode ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30" : "bg-amber-200 text-amber-950 border-amber-600 font-black hover:bg-amber-300 shadow-xs"}`}
              title="Klik untuk lihat rincian catatan barang ini"
            >
              ⚠️ {jmlCatatan} Catatan
            </button>
          )}
        </td>

        {/* Col 7: Picker */}
        <td
          onClick={() => onSelectCell(rowIdx, 7)}
          className={`px-3 py-2 text-center font-sans text-[11px] ${isDarkMode ? "text-slate-300" : "text-slate-900 font-bold"} whitespace-nowrap cursor-pointer ${getCellCls(7)}`}
        >
          {row.picker_name || "-"}
        </td>

        {/* Col 8: Checker */}
        <td
          onClick={() => onSelectCell(rowIdx, 8)}
          className={`px-3 py-2 text-center font-sans text-[11px] ${isDarkMode ? "text-amber-300 font-bold" : "text-amber-950 font-black"} whitespace-nowrap cursor-pointer ${getCellCls(8)}`}
        >
          {row.checker_name || "-"}
        </td>

        {/* Col 9: Packer */}
        <td
          onClick={() => onSelectCell(rowIdx, 9)}
          className={`px-3 py-2 text-center font-sans text-[11px] ${isDarkMode ? "text-slate-300" : "text-slate-900 font-bold"} whitespace-nowrap cursor-pointer ${getCellCls(9)}`}
        >
          {row.packer_name || "-"}
        </td>

        {/* Col 10: Tindakan Admin (DONE) */}
        <td
          onClick={() => onSelectCell(rowIdx, 10)}
          className={`px-4 py-2 text-center whitespace-nowrap cursor-pointer ${getCellCls(10)}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            {row.is_done_flag ? (
              <div className="flex flex-col items-center">
                <span className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-black border ${isDarkMode ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/40" : "bg-emerald-100 text-emerald-950 border-emerald-600 shadow-xs"}`}>
                  ✓ DONE
                </span>
                <span className={`text-[9px] font-sans mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-700 font-bold"}`}>
                  {row.done_by_name} {row.done_at_time ? `(${row.done_at_time})` : ""}
                </span>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkDone(row.so_number);
                }}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold px-3.5 py-1 text-xs shadow-md shadow-emerald-950 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Tandai Selesai Diproses oleh Admin (Shortcut: Spasi)"
              >
                <span>✓</span>
                <span>DONE</span>
              </button>
            )}

            {/* Cancel by Oracle (Owner SuperAdmin only) */}
            {canCancel && onCancelQcOrder && !row.is_done_flag && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelQcOrder(row.so_number);
                }}
                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                title="Cancel by Oracle (Keluarkan dari Antrean)"
              >
                ✕
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  },
  (prev, next) => {
    // Ultra-fast skip re-render for unselected rows
    if (!prev.isSelectedRow && !next.isSelectedRow) {
      return (
        prev.row === next.row &&
        prev.isDarkMode === next.isDarkMode &&
        prev.canCancel === next.canCancel
      );
    }
    return (
      prev.isSelectedRow === next.isSelectedRow &&
      prev.selectedColIdx === next.selectedColIdx &&
      prev.row === next.row &&
      prev.isDarkMode === next.isDarkMode &&
      prev.canCancel === next.canCancel
    );
  }
);

// ============================================================================
// MEMOIZED CATATAN BARANG ROW COMPONENT (60-120 FPS Keyboard Navigation)
// ============================================================================
interface CatatanBarangRowProps {
  item: QcCatatanBarangEntry;
  rowIdx: number;
  isSelectedRow: boolean;
  selectedColIdx: number;
  isDarkMode: boolean;
  onSelectCell: (rowIdx: number, colIdx: number) => void;
  onCopyCell: (item: QcCatatanBarangEntry, colIdx: number) => void;
  setRowRef: (el: HTMLTableRowElement | null) => void;
}

const CatatanBarangRow = React.memo(
  function CatatanBarangRow({
    item,
    rowIdx,
    isSelectedRow,
    selectedColIdx,
    isDarkMode,
    onSelectCell,
    onCopyCell,
    setRowRef,
  }: CatatanBarangRowProps) {
    const isTakeout = (item.noteType || "").toUpperCase().includes("TAKEOUT");
    const isBatch = (item.noteType || "").toUpperCase().includes("BATCH");
    const isMinus = (item.noteType || "").toUpperCase().includes("MINUS");

    const getCellCls = (colIdx: number) =>
      isSelectedRow && selectedColIdx === colIdx
        ? isDarkMode
          ? "ring-2 ring-amber-400 ring-inset bg-amber-500/20 text-white font-bold"
          : "ring-2 ring-amber-500 ring-inset bg-amber-100 text-black font-bold"
        : "";

    return (
      <tr
        ref={setRowRef}
        className={`transition-colors select-text ${
          isSelectedRow
            ? isDarkMode
              ? "bg-slate-800/50 border-l-4 border-l-amber-400"
              : "bg-amber-50/70 border-l-4 border-l-amber-500"
            : isDarkMode
            ? "hover:bg-slate-800/30"
            : "hover:bg-slate-50"
        }`}
      >
        {/* Col 0: Waktu Kirim */}
        <td
          onClick={() => onSelectCell(rowIdx, 0)}
          className={`px-3 py-2 ${isDarkMode ? "text-cyan-400 font-bold" : "text-blue-950 font-black"} whitespace-nowrap text-[11px] cursor-pointer ${getCellCls(0)}`}
        >
          {item.waktuKirim}
        </td>

        {/* Col 1: NO DO */}
        <td
          onClick={() => onSelectCell(rowIdx, 1)}
          className={`px-3 py-2 ${isDarkMode ? "font-medium text-slate-300" : "font-bold text-slate-900"} whitespace-nowrap cursor-pointer ${getCellCls(1)}`}
        >
          {item.noDo}
        </td>

        {/* Col 2: No SO */}
        <td
          onClick={() => onSelectCell(rowIdx, 2)}
          className={`px-3 py-2 whitespace-nowrap cursor-pointer ${getCellCls(2)}`}
        >
          <span
            onClick={(e) => {
              e.stopPropagation();
              onSelectCell(rowIdx, 2);
              onCopyCell(item, 2);
            }}
            className={`font-bold ${isDarkMode ? "text-amber-300 hover:text-amber-100" : "text-amber-950 font-black hover:text-amber-700"} flex items-center gap-1 group`}
            title="Klik untuk salin No SO (atau tekan C saat sel aktif)"
          >
            <span>{item.so}</span>
            <span className="text-[10px] text-slate-400 group-hover:text-amber-300 opacity-60 group-hover:opacity-100 transition">
              📋
            </span>
          </span>
        </td>

        {/* Col 3: Apotek / Pelanggan */}
        <td
          onClick={() => onSelectCell(rowIdx, 3)}
          className={`px-3 py-2 max-w-xs truncate font-sans ${isDarkMode ? "text-slate-200" : "text-slate-950 font-bold"} cursor-pointer ${getCellCls(3)}`}
          title={item.customer || "-"}
        >
          {item.customer || "-"}
        </td>

        {/* Col 4: Nama Barang */}
        <td
          onClick={() => onSelectCell(rowIdx, 4)}
          className={`px-3 py-2 max-w-xs font-sans ${isDarkMode ? "text-slate-200 font-medium" : "text-slate-950 font-black"} cursor-pointer ${getCellCls(4)}`}
          title={item.name}
        >
          {item.name}
        </td>

        {/* Col 5: Kode */}
        <td
          onClick={() => onSelectCell(rowIdx, 5)}
          className={`px-2.5 py-2 ${isDarkMode ? "text-slate-400" : "text-slate-800 font-bold"} whitespace-nowrap text-[11px] cursor-pointer ${getCellCls(5)}`}
        >
          {item.kode}
        </td>

        {/* Col 6: Batch */}
        <td
          onClick={() => onSelectCell(rowIdx, 6)}
          className={`px-3 py-2 ${isDarkMode ? "text-slate-300" : "text-slate-900 font-bold"} whitespace-nowrap cursor-pointer ${getCellCls(6)}`}
        >
          {item.batch}
        </td>

        {/* Col 7: ED */}
        <td
          onClick={() => onSelectCell(rowIdx, 7)}
          className={`px-2.5 py-2 ${isDarkMode ? "text-slate-300" : "text-slate-900 font-bold"} whitespace-nowrap text-[11px] cursor-pointer ${getCellCls(7)}`}
        >
          {item.ed || "-"}
        </td>

        {/* Col 8: Batch Baru */}
        <td
          onClick={() => onSelectCell(rowIdx, 8)}
          className={`px-3 py-2 whitespace-nowrap cursor-pointer ${getCellCls(8)}`}
        >
          {item.batchBaru && item.batchBaru !== "-" ? (
            <span className={`font-bold px-1.5 py-0.5 rounded border ${isDarkMode ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-950 bg-amber-100 border-amber-500 font-black"}`}>
              {item.batchBaru}
            </span>
          ) : (
            <span className="text-slate-500">-</span>
          )}
        </td>

        {/* Col 9: ED Baru */}
        <td
          onClick={() => onSelectCell(rowIdx, 9)}
          className={`px-2.5 py-2 whitespace-nowrap text-[11px] cursor-pointer ${getCellCls(9)}`}
        >
          {item.edBaru && item.edBaru !== "-" ? (
            <span className={`font-bold px-1.5 py-0.5 rounded border ${isDarkMode ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/20" : "text-cyan-950 bg-cyan-100 border-cyan-500 font-black"}`}>
              {item.edBaru}
            </span>
          ) : (
            <span className="text-slate-500">-</span>
          )}
        </td>

        {/* Col 10: Qty */}
        <td
          onClick={() => onSelectCell(rowIdx, 10)}
          className={`px-2 py-2 text-center font-bold ${isDarkMode ? "text-slate-200" : "text-slate-950 font-black"} cursor-pointer ${getCellCls(10)}`}
        >
          {item.qty}
        </td>

        {/* Col 11: Tipe Catatan */}
        <td
          onClick={() => onSelectCell(rowIdx, 11)}
          className={`px-3 py-2 text-center whitespace-nowrap cursor-pointer ${getCellCls(11)}`}
        >
          <span
            className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-sans font-black tracking-wide ${
              isTakeout
                ? (isDarkMode ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-amber-100 text-amber-950 border border-amber-500 font-black")
                : isBatch
                ? (isDarkMode ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "bg-purple-100 text-purple-950 border border-purple-500 font-black")
                : isMinus
                ? (isDarkMode ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-rose-100 text-rose-950 border border-rose-500 font-black")
                : (isDarkMode ? "bg-slate-700/60 text-slate-300 border border-slate-600" : "bg-slate-200 text-slate-900 border border-slate-400 font-bold")
            }`}
          >
            {item.noteType}
          </span>
        </td>

        {/* Col 12: Keterangan */}
        <td
          onClick={() => onSelectCell(rowIdx, 12)}
          className={`px-4 py-2 font-sans text-xs ${isDarkMode ? "text-slate-300" : "text-slate-950 font-bold"} max-w-sm cursor-pointer ${getCellCls(12)}`}
        >
          {item.keterangan || "-"}
        </td>
      </tr>
    );
  },
  (prev, next) => {
    if (!prev.isSelectedRow && !next.isSelectedRow) {
      return prev.item === next.item && prev.isDarkMode === next.isDarkMode;
    }
    return (
      prev.isSelectedRow === next.isSelectedRow &&
      prev.selectedColIdx === next.selectedColIdx &&
      prev.item === next.item &&
      prev.isDarkMode === next.isDarkMode
    );
  }
);

// ============================================================================
// MAIN VIEW COMPONENT
// ============================================================================
export default function ReportQcView({
  qcOrders,
  warehouse,
  currentUser,
  isDarkMode,
  existingSOSet,
  soDetailsMap,
  onRefreshQc,
  onCancelQcOrder,
  onOpenAnnouncement,
}: ReportQcViewProps) {
  const [subTab, setSubTab] = useState<"rekap" | "catatan">("rekap");
  const [mainFilter, setMainFilter] = useState<"queue" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState<number>(0);
  const [catatanPage, setCatatanPage] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localDoneMap, setLocalDoneMap] = useState<Record<string, { doneBy: string; doneAt: string }>>({});

  // SPREADSHEET CELL-BASED NAVIGATION (Identik dengan Laptop 1 / Excel)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [selectedColIdx, setSelectedColIdx] = useState<number>(2); // Default to Col 2 (No SO)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Catatan Barang Spreadsheet Navigation (60-120 FPS Keyboard Navigation)
  const [selectedCatatanRowIndex, setSelectedCatatanRowIndex] = useState<number>(0);
  const [selectedCatatanColIdx, setSelectedCatatanColIdx] = useState<number>(2); // Default to Col 2 (No SO)
  const catatanRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 1800);
  }, []);

  const normalizeSO = (soStr: string) => (soStr || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const validWarehouseQcOrders = useMemo(() => {
    return qcOrders.filter((qc) => {
      const cleanSo = (qc.so_number || "").trim();
      if (!cleanSo || cleanSo.length < 3 || cleanSo === "-" || cleanSo === "#N/A" || cleanSo.toLowerCase() === "buset") {
        return false;
      }
      return (qc.warehouse || "MBI").toUpperCase() === warehouse;
    });
  }, [qcOrders, warehouse]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshQc(true);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Realtime Live WebSocket Listener: Langsung masuk DETIK ITU JUGA saat checker selesai di DO Checker
  useEffect(() => {
    // 1. Initial quiet fetch saat antrean Report QC dibuka (tanpa toast spam & tanpa bypass cache paksa)
    onRefreshQc(false);

    let liveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    // 2. Direct Real-Time WebSocket Listener ke Firebase RTDB DO Checker (<1s via WebSocket, di-debounce agar hemat kuota)
    const unsub = subscribeToDoCheckerLive(() => {
      if (liveDebounceTimer) clearTimeout(liveDebounceTimer);
      liveDebounceTimer = setTimeout(() => {
        onRefreshQc(false);
      }, 800);
    });

    // 3. Fallback heartbeat konservatif (5 menit) karena WebSocket RTDB + Firestore sudah aktif real-time
    const fallbackInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      onRefreshQc(false);
    }, 300000);

    return () => {
      unsub();
      if (liveDebounceTimer) clearTimeout(liveDebounceTimer);
      clearInterval(fallbackInterval);
    };
  }, [onRefreshQc]);

  // Enriched Rekap SO list (Instant memoization, zero network storm)
  const enrichedOrders = useMemo(() => {
    return validWarehouseQcOrders.map((row) => {
      const soNum = String(row.so_number || "").trim();
      const normSo = normalizeSO(soNum);
      const detail = soDetailsMap.get(soNum.toUpperCase()) || soDetailsMap.get(normSo) || null;

      const waktuKirim =
        row.waktu_kirim && row.waktu_kirim !== "-"
          ? row.waktu_kirim
          : detail?.transactionDate && detail.transactionDate !== "-"
          ? detail.transactionDate
          : detail?.orderDate || "-";

      const noDo = row.no_do && row.no_do !== "-" ? row.no_do : "-";

      const customer =
        row.customer_name && row.customer_name !== "-"
          ? row.customer_name
          : detail?.customerName && detail.customerName !== "-"
          ? detail.customerName
          : "-";

      const totalItem =
        Number(row.total_item) > 0 ? Number(row.total_item) : detail?.totalItems || 0;

      const totalQty =
        Number(row.total_qty) > 0 ? Number(row.total_qty) : detail?.totalQty || totalItem || 0;

      const checkerName = row.checker_name && row.checker_name !== "-" ? row.checker_name : "-";
      const packerName = row.packer_name && row.packer_name !== "-" ? row.packer_name : "-";
      const pickerName = row.picker_name && row.picker_name !== "-" ? row.picker_name : "-";

      const isInvoiced = existingSOSet.has(soNum.toUpperCase()) || existingSOSet.has(normSo);
      const invoiceNum = detail?.invoiceNumber || null;

      const isDone = Boolean(
        localDoneMap[soNum] || row.is_done === "DONE" || String(row.is_done || "").toUpperCase() === "DONE"
      );
      const doneBy = localDoneMap[soNum]?.doneBy || row.done_by || "Admin";
      const doneAt = localDoneMap[soNum]?.doneAt || row.done_at || "";

      // Parse noted items if stringified JSON
      let parsedNotedItems = row.noted_items;
      if (typeof parsedNotedItems === "string") {
        try {
          parsedNotedItems = JSON.parse(parsedNotedItems);
        } catch {
          parsedNotedItems = null;
        }
      }

      return {
        ...row,
        so_number: soNum,
        waktu_kirim: waktuKirim,
        no_do: noDo,
        customer_name: customer,
        total_item: totalItem,
        total_qty: totalQty,
        checker_name: checkerName,
        packer_name: packerName,
        picker_name: pickerName,
        is_invoiced: isInvoiced,
        invoice_number: invoiceNum,
        is_done_flag: isDone,
        done_by_name: doneBy,
        done_at_time: doneAt,
        noted_items: Array.isArray(parsedNotedItems) ? parsedNotedItems : null,
      };
    });
  }, [validWarehouseQcOrders, soDetailsMap, existingSOSet, localDoneMap]);

  // FILTER & SORTING MANDAT MUTLAK:
  // 1. Yang BELUM ADA INVOICE (!is_invoiced) WAJIB TAMPIL PALING ATAS!
  // 2. Jika SUDAH DONE dan SUDAH ADA NO INVOICE -> PINDAH KE FILTER "SEMUA"!
  // 3. Jika BELUM ADA INVOICE (walaupun sudah DONE) -> TETAP TAMPIL DI PALING ATAS DENGAN TANDA '!'!
  const filteredRekapOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = enrichedOrders.filter((row) => {
      // Filter Antrean Aktif (Menunggu Faktur / Belum Ada Invoice):
      // Menampilkan seluruh SO yang BELUM MEMPUNYAI NO INVOICE (!row.is_invoiced).
      // Begitu fakturnya terbit di Oracle -> otomatis keluar dari antrean ini dan hanya ada di filter "Semua".
      if (mainFilter === "queue" && row.is_invoiced) {
        return false;
      }

      if (q) {
        const matchSo = row.so_number.toLowerCase().includes(q);
        const matchDo = String(row.no_do || "").toLowerCase().includes(q);
        const matchCust = String(row.customer_name || "").toLowerCase().includes(q);
        const matchChecker = String(row.checker_name || "").toLowerCase().includes(q);
        if (!matchSo && !matchDo && !matchCust && !matchChecker) return false;
      }
      return true;
    });

    // SORTING MANDAT STABIL 100%:
    // 1. Yang BELUM ADA INVOICE (!is_invoiced) PALING ATAS!
    // 2. Yang BELUM DONE (!is_done_flag) di atas yang SUDAH DONE!
    // 3. Waktu Kirim Riil Scan Gudang (waktu_kirim) TERBARU PALING ATAS!
    // 4. Deterministic tie-breaker nomor SO agar urutan 100% paten & tidak loncat-loncat.
    const parseWaktuKirim = (w: string | null | undefined): number => {
      if (!w) return 0;
      const str = String(w).trim();
      const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const y = parseInt(m[3], 10);
        const h = parseInt(m[4] || "0", 10);
        const min = parseInt(m[5] || "0", 10);
        const s = parseInt(m[6] || "0", 10);
        return new Date(y, mo, d, h, min, s).getTime();
      }
      const t = new Date(str).getTime();
      return isNaN(t) ? 0 : t;
    };

    return list.sort((a, b) => {
      // 1. Belum ber-invoice di atas yang sudah ber-invoice
      if (!a.is_invoiced && b.is_invoiced) return -1;
      if (a.is_invoiced && !b.is_invoiced) return 1;

      // 2. Belum DONE di atas yang sudah DONE
      if (!a.is_done_flag && b.is_done_flag) return -1;
      if (a.is_done_flag && !b.is_done_flag) return 1;

      // 3. Urutkan berdasarkan waktu_kirim riil scan gudang (terbaru di atas)
      const wtA = parseWaktuKirim(a.waktu_kirim);
      const wtB = parseWaktuKirim(b.waktu_kirim);
      if (wtB !== wtA) return wtB - wtA;

      // 4. Sheet row terbaru
      const rowA = Number(a.sheet_row) || 0;
      const rowB = Number(b.sheet_row) || 0;
      if (rowB !== rowA) return rowB - rowA;

      // 5. Updated at server terbaru
      const timeA = new Date(a.updated_at || 0).getTime();
      const timeB = new Date(b.updated_at || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;

      // 6. Tie-breaker mutlak nomor SO (Zero Shuffling guarantee)
      return String(b.so_number || "").localeCompare(String(a.so_number || ""));
    });
  }, [enrichedOrders, mainFilter, searchQuery]);

  // PAGINATION IDENTIK DENGAN LAPTOP 1: 50 baris per halaman untuk 60 FPS ZERO-LAG
  const totalPages = Math.ceil(filteredRekapOrders.length / PAGE_SIZE) || 1;
  const pagedOrders = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredRekapOrders.slice(start, start + PAGE_SIZE);
  }, [filteredRekapOrders, page]);

  // Counts
  const queueCount = useMemo(() => {
    return enrichedOrders.filter((r) => !r.is_invoiced).length;
  }, [enrichedOrders]);

  const allCount = enrichedOrders.length;

  // Total Catatan count for tab badge (instant number sum, 0ms overhead)
  const totalCatatanCount = useMemo(() => {
    return enrichedOrders.reduce((sum, r) => sum + (Number(r.barang_catatan) || 0), 0);
  }, [enrichedOrders]);

  // Single Mark DONE
  const handleMarkDone = useCallback(
    async (soNum: string) => {
      if (!soNum) return;
      const cleanSo = soNum.trim();
      const adminName = currentUser?.name || "Admin";
      const nowTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      setLocalDoneMap((prev) => ({
        ...prev,
        [cleanSo]: { doneBy: adminName, doneAt: nowTime },
      }));
      showToast(`✓ SO #${cleanSo} ditandai DONE`);

      try {
        await fetch("/api/tidb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "mark_qc_done",
            so_number: cleanSo,
            warehouse,
            user_name: adminName,
            user_email: currentUser?.email || "",
            is_done: "DONE",
          }),
        });
        onRefreshQc(false);
      } catch (e) {
        console.error("Failed to mark QC DONE:", e);
      }
    },
    [currentUser, warehouse, onRefreshQc, showToast]
  );

  // Batch Mark ALL DONE
  const handleMarkAllDone = useCallback(async () => {
    const pendingRows = pagedOrders.filter((r) => !r.is_done_flag);
    if (pendingRows.length === 0) return;

    const adminName = currentUser?.name || "Admin";
    const nowTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const soList = pendingRows.map((r) => r.so_number);

    setLocalDoneMap((prev) => {
      const updated = { ...prev };
      for (const so of soList) {
        updated[so] = { doneBy: adminName, doneAt: nowTime };
      }
      return updated;
    });
    showToast(`✓✓ ${soList.length} SO ditandai DONE`);

    try {
      await fetch("/api/tidb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_all_qc_done",
          so_numbers: soList,
          warehouse,
          user_name: adminName,
          user_email: currentUser?.email || "",
        }),
      });
      onRefreshQc(false);
    } catch (e) {
      console.error("Failed to mark ALL QC DONE:", e);
    }
  }, [pagedOrders, currentUser, warehouse, onRefreshQc, showToast]);

  // Copy helper
  const copyCellContent = useCallback(
    (row: any, colIdx: number) => {
      if (!row) return;
      let textToCopy = "";
      let label = "Data";

      switch (colIdx) {
        case 0:
          textToCopy = row.waktu_kirim;
          label = "Waktu Kirim";
          break;
        case 1:
          textToCopy = row.no_do;
          label = "No DO";
          break;
        case 2:
          textToCopy = row.so_number;
          label = "No SO";
          break;
        case 3:
          textToCopy = row.customer_name;
          label = "Apotek / Pelanggan";
          break;
        case 4:
          textToCopy = String(row.total_item);
          label = "Total Item";
          break;
        case 5:
          textToCopy = String(row.total_qty);
          label = "Total Qty";
          break;
        case 6:
          textToCopy = String(row.barang_catatan || 0);
          label = "Jml Barang Catatan";
          break;
        case 7:
          textToCopy = row.picker_name;
          label = "Picker";
          break;
        case 8:
          textToCopy = row.checker_name;
          label = "Checker";
          break;
        case 9:
          textToCopy = row.packer_name;
          label = "Packer";
          break;
        default:
          textToCopy = row.so_number;
          label = "No SO";
          break;
      }

      if (textToCopy && textToCopy !== "-") {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          navigator.clipboard
            .writeText(textToCopy)
            .then(() => {
              showToast(`📋 ${label} disalin: ${textToCopy}`);
            })
            .catch(() => {
              showToast(`📋 ${label}: ${textToCopy}`);
            });
        }
      }
    },
    [showToast]
  );

  // Copy helper Catatan Barang
  const copyCatatanCellContent = useCallback(
    (item: QcCatatanBarangEntry, colIdx: number) => {
      if (!item) return;
      let textToCopy = "";
      let label = "Data";

      switch (colIdx) {
        case 0:
          textToCopy = item.waktuKirim;
          label = "Waktu Kirim";
          break;
        case 1:
          textToCopy = item.noDo;
          label = "No DO";
          break;
        case 2:
          textToCopy = item.so;
          label = "No SO";
          break;
        case 3:
          textToCopy = item.customer;
          label = "Apotek / Pelanggan";
          break;
        case 4:
          textToCopy = item.name;
          label = "Nama Barang";
          break;
        case 5:
          textToCopy = item.kode;
          label = "Kode Barang";
          break;
        case 6:
          textToCopy = item.batch;
          label = "Batch";
          break;
        case 7:
          textToCopy = item.ed || "-";
          label = "ED";
          break;
        case 8:
          textToCopy = item.batchBaru || "-";
          label = "Batch Baru";
          break;
        case 9:
          textToCopy = item.edBaru || "-";
          label = "ED Baru";
          break;
        case 10:
          textToCopy = String(item.qty || 1);
          label = "Qty";
          break;
        case 11:
          textToCopy = item.noteType;
          label = "Tipe Catatan";
          break;
        case 12:
          textToCopy = item.keterangan || "-";
          label = "Keterangan";
          break;
        default:
          textToCopy = item.so;
          label = "No SO";
          break;
      }

      if (textToCopy && textToCopy !== "-") {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          navigator.clipboard
            .writeText(textToCopy)
            .then(() => {
              showToast(`📋 ${label} disalin: ${textToCopy}`);
            })
            .catch(() => {
              showToast(`📋 ${label}: ${textToCopy}`);
            });
        }
      }
    },
    [showToast]
  );

  // Catatan Barang list (HANYA dihitung saat subTab === 'catatan' agar Rekap SO 100% cepat)
  const catatanBarangList = useMemo(() => {
    if (subTab !== "catatan") return [];
    const res: QcCatatanBarangEntry[] = [];
    const q = searchQuery.toLowerCase().trim();

    for (const row of enrichedOrders) {
      if (Array.isArray(row.noted_items) && row.noted_items.length > 0) {
        for (const item of row.noted_items) {
          const soStr = item.so || row.so_number || "-";
          const custStr =
            item.customer && item.customer !== "-"
              ? item.customer
              : row.customer_name && row.customer_name !== "-"
              ? row.customer_name
              : soDetailsMap.get(soStr.toUpperCase())?.customerName ||
                soDetailsMap.get(normalizeSO(soStr))?.customerName ||
                "-";

          res.push({
            waktuKirim: item.waktuKirim || row.waktu_kirim || "-",
            noDo: item.noDo || row.no_do || "-",
            so: soStr,
            customer: custStr,
            name: item.name || "-",
            kode: item.kode || "-",
            batch: item.batch || "-",
            batchBaru: item.batchBaru || "-",
            ed: item.ed || "",
            edBaru: item.edBaru || "",
            qty: item.qty || 1,
            noteType: item.noteType || "CATATAN",
            keterangan: item.keterangan || "",
          });
        }
      }
    }

    if (!q) return res;
    return res.filter(
      (it) =>
        it.so.toLowerCase().includes(q) ||
        it.noDo.toLowerCase().includes(q) ||
        it.customer.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        it.kode.toLowerCase().includes(q) ||
        it.batch.toLowerCase().includes(q) ||
        (it.batchBaru && it.batchBaru.toLowerCase().includes(q)) ||
        it.noteType.toLowerCase().includes(q) ||
        (it.keterangan && it.keterangan.toLowerCase().includes(q))
    );
  }, [subTab, enrichedOrders, mainFilter, searchQuery, soDetailsMap]);

  const totalCatatanPages = Math.ceil(catatanBarangList.length / PAGE_SIZE) || 1;
  const pagedCatatan = useMemo(() => {
    const start = catatanPage * PAGE_SIZE;
    return catatanBarangList.slice(start, start + PAGE_SIZE);
  }, [catatanBarangList, catatanPage]);

  // KEYBOARD NAVIGATION ZERO-LAG (Ref-based 120 FPS, isolated single listener)
  const pagedOrdersRef = useRef(pagedOrders);
  pagedOrdersRef.current = pagedOrders;
  const selectedRowIndexRef = useRef(selectedRowIndex);
  selectedRowIndexRef.current = selectedRowIndex;
  const selectedColIdxRef = useRef(selectedColIdx);
  selectedColIdxRef.current = selectedColIdx;
  const subTabRef = useRef(subTab);
  subTabRef.current = subTab;
  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;
  const handleMarkDoneRef = useRef(handleMarkDone);
  handleMarkDoneRef.current = handleMarkDone;
  const handleMarkAllDoneRef = useRef(handleMarkAllDone);
  handleMarkAllDoneRef.current = handleMarkAllDone;
  const copyCellContentRef = useRef(copyCellContent);
  copyCellContentRef.current = copyCellContent;

  const pagedCatatanRef = useRef(pagedCatatan);
  pagedCatatanRef.current = pagedCatatan;
  const totalCatatanPagesRef = useRef(totalCatatanPages);
  totalCatatanPagesRef.current = totalCatatanPages;
  const selectedCatatanRowIndexRef = useRef(selectedCatatanRowIndex);
  selectedCatatanRowIndexRef.current = selectedCatatanRowIndex;
  const selectedCatatanColIdxRef = useRef(selectedCatatanColIdx);
  selectedCatatanColIdxRef.current = selectedCatatanColIdx;
  const copyCatatanCellContentRef = useRef(copyCatatanCellContent);
  copyCatatanCellContentRef.current = copyCatatanCellContent;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.tagName === "BUTTON" ||
          target.isContentEditable)
      ) {
        return;
      }

      // ---------------------------------------------------------------------
      // TAB 1: REKAP SO KEYBOARD NAVIGATION (120 FPS)
      // ---------------------------------------------------------------------
      if (subTabRef.current === "rekap") {
        const curOrders = pagedOrdersRef.current;
        const maxRow = Math.max(0, curOrders.length - 1);
        const curRowIdx = Math.min(selectedRowIndexRef.current, maxRow);
        const currentRow = curOrders[curRowIdx];

        // Copy on 'c' or 'Ctrl+C'
        if (e.key === "c" || e.key === "C") {
          if (e.repeat) return;
          const textSelected = typeof window !== "undefined" && window.getSelection()?.toString();
          if (textSelected && (e.ctrlKey || e.metaKey)) return;

          if (currentRow) {
            if (e.ctrlKey || e.metaKey) e.preventDefault();
            copyCellContentRef.current(currentRow, selectedColIdxRef.current);
            return;
          }
        }

        // Space: Toggle DONE
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          if (e.repeat) return;
          if (currentRow && !currentRow.is_done_flag) {
            handleMarkDoneRef.current(currentRow.so_number);
          }
          return;
        }

        // Enter: Single or Batch DONE
        if (e.key === "Enter") {
          e.preventDefault();
          if (e.repeat) return;
          if (e.ctrlKey || e.shiftKey || e.metaKey) {
            handleMarkAllDoneRef.current();
          } else if (currentRow && !currentRow.is_done_flag) {
            handleMarkDoneRef.current(currentRow.so_number);
          }
          return;
        }

        // Arrow navigation
        if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault();
          const next = Math.min(maxRow, curRowIdx + 1);
          selectedRowIndexRef.current = next;
          setSelectedRowIndex(next);
          rowRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "auto" });
          return;
        }
        if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          const next = Math.max(0, curRowIdx - 1);
          selectedRowIndexRef.current = next;
          setSelectedRowIndex(next);
          rowRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "auto" });
          return;
        }
        if (e.key === "ArrowRight" || e.key === "l") {
          e.preventDefault();
          const nextCol = Math.min(10, selectedColIdxRef.current + 1);
          selectedColIdxRef.current = nextCol;
          setSelectedColIdx(nextCol);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "h") {
          e.preventDefault();
          const nextCol = Math.max(0, selectedColIdxRef.current - 1);
          selectedColIdxRef.current = nextCol;
          setSelectedColIdx(nextCol);
          return;
        }
        if (e.key === "PageDown") {
          e.preventDefault();
          setPage((p) => Math.min(totalPagesRef.current - 1, p + 1));
          setSelectedRowIndex(0);
          selectedRowIndexRef.current = 0;
          return;
        }
        if (e.key === "PageUp") {
          e.preventDefault();
          setPage((p) => Math.max(0, p - 1));
          setSelectedRowIndex(0);
          selectedRowIndexRef.current = 0;
          return;
        }
        return;
      }

      // ---------------------------------------------------------------------
      // TAB 2: CATATAN BARANG KEYBOARD NAVIGATION (120 FPS, 13 Columns)
      // ---------------------------------------------------------------------
      if (subTabRef.current === "catatan") {
        const curCatatan = pagedCatatanRef.current;
        const maxCatatanRow = Math.max(0, curCatatan.length - 1);
        const curCatatanRowIdx = Math.min(selectedCatatanRowIndexRef.current, maxCatatanRow);
        const currentItem = curCatatan[curCatatanRowIdx];

        // Copy on 'c' or 'Ctrl+C'
        if (e.key === "c" || e.key === "C") {
          if (e.repeat) return;
          const textSelected = typeof window !== "undefined" && window.getSelection()?.toString();
          if (textSelected && (e.ctrlKey || e.metaKey)) return;

          if (currentItem) {
            if (e.ctrlKey || e.metaKey) e.preventDefault();
            copyCatatanCellContentRef.current(currentItem, selectedCatatanColIdxRef.current);
            return;
          }
        }

        // Enter / Shift+Enter navigation
        if (e.key === "Enter") {
          e.preventDefault();
          if (e.repeat) return;
          const next = e.shiftKey
            ? Math.max(0, curCatatanRowIdx - 1)
            : Math.min(maxCatatanRow, curCatatanRowIdx + 1);
          selectedCatatanRowIndexRef.current = next;
          setSelectedCatatanRowIndex(next);
          catatanRowRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "auto" });
          return;
        }

        // Tab / Shift+Tab navigation
        if (e.key === "Tab") {
          e.preventDefault();
          const nextCol = e.shiftKey
            ? Math.max(0, selectedCatatanColIdxRef.current - 1)
            : Math.min(12, selectedCatatanColIdxRef.current + 1);
          selectedCatatanColIdxRef.current = nextCol;
          setSelectedCatatanColIdx(nextCol);
          return;
        }

        // Arrow navigation
        if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault();
          const next = Math.min(maxCatatanRow, curCatatanRowIdx + 1);
          selectedCatatanRowIndexRef.current = next;
          setSelectedCatatanRowIndex(next);
          catatanRowRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "auto" });
          return;
        }
        if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          const next = Math.max(0, curCatatanRowIdx - 1);
          selectedCatatanRowIndexRef.current = next;
          setSelectedCatatanRowIndex(next);
          catatanRowRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "auto" });
          return;
        }
        if (e.key === "ArrowRight" || e.key === "l") {
          e.preventDefault();
          const nextCol = Math.min(12, selectedCatatanColIdxRef.current + 1);
          selectedCatatanColIdxRef.current = nextCol;
          setSelectedCatatanColIdx(nextCol);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "h") {
          e.preventDefault();
          const nextCol = Math.max(0, selectedCatatanColIdxRef.current - 1);
          selectedCatatanColIdxRef.current = nextCol;
          setSelectedCatatanColIdx(nextCol);
          return;
        }
        if (e.key === "PageDown") {
          e.preventDefault();
          setCatatanPage((p) => Math.min(totalCatatanPagesRef.current - 1, p + 1));
          setSelectedCatatanRowIndex(0);
          selectedCatatanRowIndexRef.current = 0;
          return;
        }
        if (e.key === "PageUp") {
          e.preventDefault();
          setCatatanPage((p) => Math.max(0, p - 1));
          setSelectedCatatanRowIndex(0);
          selectedCatatanRowIndexRef.current = 0;
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onSelectCell = useCallback((rowIdx: number, colIdx: number) => {
    setSelectedRowIndex(rowIdx);
    selectedRowIndexRef.current = rowIdx;
    setSelectedColIdx(colIdx);
    selectedColIdxRef.current = colIdx;
  }, []);

  const onSelectCatatanCell = useCallback((rowIdx: number, colIdx: number) => {
    setSelectedCatatanRowIndex(rowIdx);
    selectedCatatanRowIndexRef.current = rowIdx;
    setSelectedCatatanColIdx(colIdx);
    selectedCatatanColIdxRef.current = colIdx;
  }, []);

  const onViewCatatan = useCallback((soNum: string) => {
    setSubTab("catatan");
    setSearchQuery(soNum);
    setCatatanPage(0);
    setSelectedCatatanRowIndex(0);
    selectedCatatanRowIndexRef.current = 0;
    setSelectedCatatanColIdx(2);
    selectedCatatanColIdxRef.current = 2;
  }, []);

  const canCancel = isSuperAdminUser(currentUser?.name);

  return (
    <div
      className={`w-full rounded-xl border transition-all ${
        isDarkMode ? "bg-[#090d16] border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900 shadow-sm"
      } p-3 sm:p-4 mb-4 select-text relative`}
    >
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border-2 border-amber-400 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP BAR: Sub-Tabs & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3">
        {/* Left: Sub-tabs (Rekap SO vs Catatan Barang) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setSubTab("rekap");
              setPage(0);
              setSelectedRowIndex(0);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "rekap"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>📋 Rekap SO</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all ${
                subTab === "rekap" ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}
            >
              {mainFilter === "queue" ? `${queueCount} Menunggu Faktur` : `${allCount} Semua`}
            </span>
          </button>

          <button
            onClick={() => {
              setSubTab("catatan");
              setCatatanPage(0);
              setSelectedCatatanRowIndex(0);
              selectedCatatanRowIndexRef.current = 0;
              setSelectedCatatanColIdx(2);
              selectedCatatanColIdxRef.current = 2;
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "catatan"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>📝 Catatan Barang</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                subTab === "catatan" ? "bg-purple-400 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}
            >
              {totalCatatanCount} Barang
            </span>
          </button>

          {onOpenAnnouncement && (
            <button
              onClick={onOpenAnnouncement}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition active:scale-95 cursor-pointer ml-1"
              title="Buka Update Penting & How to Use Report QC"
            >
              <span>🚨</span>
              <span>Panduan Alur Baru</span>
            </button>
          )}

          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ml-1"
            title="Koneksi Real-time ke DO Checker Aktif (<100ms)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>DO Checker Live</span>
          </span>
        </div>

        {/* Right Controls: Batch DONE, Search, Main Filter, and Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Batch "Tandai Semua Selesai" */}
          {mainFilter === "queue" && queueCount > 0 && subTab === "rekap" && (
            <button
              onClick={handleMarkAllDone}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Tandai semua SO di halaman ini sebagai DONE (Shortcut: Ctrl+Enter / Shift+Enter)"
            >
              <span>✓✓</span>
              <span>Tandai Semua Selesai ({pagedOrders.filter((r) => !r.is_done_flag).length})</span>
            </button>
          )}

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
                setCatatanPage(0);
                setSelectedRowIndex(0);
                setSelectedCatatanRowIndex(0);
              }}
              placeholder="Cari No SO / DO / Apotek..."
              className={`w-44 sm:w-56 text-xs px-2.5 py-1.5 rounded-lg border outline-none transition font-sans ${
                isDarkMode
                  ? "bg-slate-900/80 border-slate-800 text-slate-200 focus:border-amber-400"
                  : "bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPage(0);
                  setCatatanPage(0);
                  setSelectedRowIndex(0);
                  setSelectedCatatanRowIndex(0);
                }}
                className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Antrean vs Semua */}
          <div
            className={`flex items-center rounded-lg p-0.5 border ${
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"
            }`}
          >
            <button
              onClick={() => {
                setMainFilter("queue");
                setPage(0);
                setSelectedRowIndex(0);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                mainFilter === "queue"
                  ? "bg-amber-600 text-white shadow"
                  : isDarkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Menunggu Faktur ({queueCount})
            </button>
            <button
              onClick={() => {
                setMainFilter("all");
                setPage(0);
                setSelectedRowIndex(0);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                mainFilter === "all"
                  ? "bg-amber-600 text-white shadow"
                  : isDarkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({allCount})
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh Data Realtime dari Checker"
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isDarkMode
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300"
                : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-amber-400" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Spreadsheet Navigation Guide */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-sans mb-2 px-1 gap-2">
        <div>
          ⌨️ Navigasi: <span className="text-amber-300 font-bold">↑ / ↓</span> Baris &bull;{" "}
          <span className="text-amber-300 font-bold">← / →</span> Sel &bull;{" "}
          <span className="text-cyan-300 font-bold">C / Ctrl+C</span> Salin
          {subTab === "rekap" && (
            <>
              {" "}
              &bull; <span className="text-emerald-400 font-bold">Spasi</span> DONE &bull;{" "}
              <span className="text-rose-400 font-black">!</span> Belum Ada Faktur (Prioritas Paling Atas)
            </>
          )}
        </div>
        <div className="text-slate-400 font-mono text-[10px]">
          {subTab === "rekap" ? (
            <>
              Menampilkan {pagedOrders.length} dari {filteredRekapOrders.length} SO &bull; Hal {page + 1}/{totalPages}
            </>
          ) : (
            <>
              Menampilkan {pagedCatatan.length} dari {catatanBarangList.length} Catatan &bull; Hal {catatanPage + 1}/{totalCatatanPages}
            </>
          )}
        </div>
      </div>

      {/* VIEW CONTENT */}
      {subTab === "rekap" ? (
        /* TAB 1: REKAP SO */
        <div className={`rounded-lg border shadow-sm overflow-hidden ${isDarkMode ? "border-slate-800/60 bg-slate-900/30" : "border-slate-300 bg-white"}`}>
          <div className="overflow-x-auto max-h-[64vh] overflow-y-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead
                className={`sticky top-0 z-10 uppercase tracking-wider text-[11px] font-bold border-b ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800 text-slate-300"
                    : "bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <tr>
                  <th className="px-3 py-2.5">Waktu Kirim</th>
                  <th className="px-3 py-2.5">NO DO</th>
                  <th className="px-3 py-2.5">No SO</th>
                  <th className="px-3 py-2.5">Apotek / Pelanggan</th>
                  <th className="px-2.5 py-2.5 text-center">Total Item</th>
                  <th className="px-2.5 py-2.5 text-center">Total Qty</th>
                  <th className="px-3 py-2.5 text-center">Jml Barang Catatan</th>
                  <th className="px-3 py-2.5 text-center">Picker</th>
                  <th className="px-3 py-2.5 text-center">Checker</th>
                  <th className="px-3 py-2.5 text-center">Packer</th>
                  <th className="px-4 py-2.5 text-center">Tindakan Admin (DONE)</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y font-mono ${
                  isDarkMode ? "divide-slate-800/60 text-slate-200" : "divide-slate-200 text-slate-800"
                }`}
              >
                {pagedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-xs text-slate-400 font-sans">
                      {mainFilter === "queue"
                        ? "🎉 Meja kerja bersih! Semua SO sudah selesai di-DONE dan sudah terbit faktur resminya."
                        : "Tidak ada data Report QC yang sesuai pencarian."}
                    </td>
                  </tr>
                ) : (
                  pagedOrders.map((row, rowIdx) => (
                    <ReportQcRow
                      key={row.so_number}
                      row={row}
                      rowIdx={rowIdx}
                      isSelectedRow={rowIdx === selectedRowIndex}
                      selectedColIdx={selectedColIdx}
                      isDarkMode={isDarkMode}
                      onSelectCell={onSelectCell}
                      onCopyCell={copyCellContent}
                      onMarkDone={handleMarkDone}
                      onCancelQcOrder={onCancelQcOrder}
                      canCancel={canCancel}
                      onViewCatatan={onViewCatatan}
                      setRowRef={(el) => {
                        rowRefs.current[rowIdx] = el;
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div
              className={`p-2.5 border-t flex items-center justify-between text-xs transition-colors ${
                isDarkMode
                  ? "bg-slate-900/90 border-slate-800 text-slate-400"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <span>
                Halaman <strong>{page + 1}</strong> dari <strong>{totalPages}</strong> ({filteredRekapOrders.length}{" "}
                total SO)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPage((p) => Math.max(0, p - 1));
                    setSelectedRowIndex(0);
                    selectedRowIndexRef.current = 0;
                  }}
                  disabled={page === 0}
                  className="px-3 py-1 border rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-800/40 transition cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => {
                    setPage((p) => Math.min(totalPages - 1, p + 1));
                    setSelectedRowIndex(0);
                    selectedRowIndexRef.current = 0;
                  }}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-800/40 transition cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: CATATAN BARANG */
        <div className={`rounded-lg border shadow-sm overflow-hidden ${isDarkMode ? "border-slate-800/60 bg-slate-900/30" : "border-slate-300 bg-white"}`}>
          <div className="overflow-x-auto max-h-[64vh] overflow-y-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead
                className={`sticky top-0 z-10 uppercase tracking-wider text-[11px] font-bold border-b ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800 text-slate-300"
                    : "bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <tr>
                  <th className="px-3 py-2.5">Waktu Kirim</th>
                  <th className="px-3 py-2.5">NO DO</th>
                  <th className="px-3 py-2.5">No SO</th>
                  <th className="px-3 py-2.5">Apotek / Pelanggan</th>
                  <th className="px-3 py-2.5">Nama Barang</th>
                  <th className="px-2.5 py-2.5">Kode</th>
                  <th className="px-3 py-2.5">Batch</th>
                  <th className="px-2.5 py-2.5">ED</th>
                  <th className="px-3 py-2.5">Batch Baru</th>
                  <th className="px-2.5 py-2.5">ED Baru</th>
                  <th className="px-2 py-2.5 text-center">Qty</th>
                  <th className="px-3 py-2.5 text-center">Tipe Catatan</th>
                  <th className="px-4 py-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y font-mono ${
                  isDarkMode ? "divide-slate-800/60 text-slate-200" : "divide-slate-200 text-slate-800"
                }`}
              >
                {catatanBarangList.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-xs text-slate-400 font-sans">
                      ✨ Tidak ada barang yang memiliki catatan! Seluruh SO siap diproses cetak invoice.
                    </td>
                  </tr>
                ) : (
                  pagedCatatan.map((item, rowIdx) => (
                    <CatatanBarangRow
                      key={`${item.so}-${item.kode}-${rowIdx}`}
                      item={item}
                      rowIdx={rowIdx}
                      isSelectedRow={rowIdx === selectedCatatanRowIndex}
                      selectedColIdx={selectedCatatanColIdx}
                      isDarkMode={isDarkMode}
                      onSelectCell={onSelectCatatanCell}
                      onCopyCell={copyCatatanCellContent}
                      setRowRef={(el) => {
                        catatanRowRefs.current[rowIdx] = el;
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer untuk Catatan Barang */}
          {totalCatatanPages > 1 && (
            <div
              className={`p-2.5 border-t flex items-center justify-between text-xs transition-colors ${
                isDarkMode
                  ? "bg-slate-900/90 border-slate-800 text-slate-400"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <span>
                Halaman <strong>{catatanPage + 1}</strong> dari <strong>{totalCatatanPages}</strong> (
                {catatanBarangList.length} total catatan)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCatatanPage((p) => Math.max(0, p - 1));
                    setSelectedCatatanRowIndex(0);
                    selectedCatatanRowIndexRef.current = 0;
                  }}
                  disabled={catatanPage === 0}
                  className="px-3 py-1 border rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-800/40 transition cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => {
                    setCatatanPage((p) => Math.min(totalCatatanPages - 1, p + 1));
                    setSelectedCatatanRowIndex(0);
                    selectedCatatanRowIndexRef.current = 0;
                  }}
                  disabled={catatanPage >= totalCatatanPages - 1}
                  className="px-3 py-1 border rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-800/40 transition cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
