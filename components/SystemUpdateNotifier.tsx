"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { subscribeToSystemUpdate, SystemUpdatePayload } from "@/lib/firestoreService";
import { Sparkles, RefreshCw, X, ArrowRight, BellRing } from "lucide-react";

export default function SystemUpdateNotifier() {
  const [updateInfo, setUpdateInfo] = useState<SystemUpdatePayload | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [countdown, setCountdown] = useState<number>(15);
  const [isAutoReloadPaused, setIsAutoReloadPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synthesized soft chime using Web Audio API (no external asset needed)
  const playChime = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio playback blocked by browser autoplay policy, safe to ignore
    }
  }, []);

  const handleRefresh = useCallback(() => {
    // Force reload with cache busting
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const clientBuildTime = Number(process.env.NEXT_PUBLIC_BUILD_TIME || 0);
    const unsub = subscribeToSystemUpdate(clientBuildTime, (payload) => {
      setUpdateInfo(payload);
      setIsDismissed(false);
      setCountdown(15);
      setIsAutoReloadPaused(false);
      playChime();
    });

    return () => unsub();
  }, [playChime]);

  // Countdown timer for auto-refresh
  useEffect(() => {
    if (!updateInfo || isDismissed || isAutoReloadPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleRefresh();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [updateInfo, isDismissed, isAutoReloadPaused, handleRefresh]);

  if (!updateInfo) return null;

  // Mini floating badge when dismissed
  if (isDismissed) {
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs font-bold animate-bounce border border-blue-400/40"
        title="Klik untuk membuka notifikasi pembaruan sistem"
      >
        <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
        <span>Update Tersedia! Klik untuk Refresh</span>
      </button>
    );
  }

  // Full prominent notification modal/card
  return (
    <div className="fixed inset-x-0 top-4 z-[9999] flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-6 duration-300">
      <div className="pointer-events-auto max-w-xl w-full bg-slate-900/95 dark:bg-zinc-950/95 text-white backdrop-blur-xl border-2 border-blue-500/80 rounded-2xl shadow-[0_20px_50px_rgba(37,99,235,0.35)] overflow-hidden">
        {/* Progress bar countdown */}
        {!isAutoReloadPaused && (
          <div className="w-full bg-slate-800 h-1">
            <div
              className="bg-gradient-to-r from-blue-400 to-cyan-400 h-1 transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / 15) * 100}%` }}
            />
          </div>
        )}

        <div className="p-4 sm:p-5 flex items-start gap-4">
          {/* Animated Icon */}
          <div className="p-3 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400 shrink-0 relative">
            <BellRing className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping" />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-blue-500/30 text-blue-300 border border-blue-400/30">
                Pembaruan Sistem
              </span>
              {updateInfo.commitSha && (
                <span className="text-[11px] font-mono text-zinc-400">
                  build-{updateInfo.commitSha}
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white mt-1">
              Versi Baru Telah Selesai di-Deploy! 🚀
            </h3>

            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
              Sistem Fantastic Order baru saja diperbarui di server Vercel. Silakan refresh halaman agar seluruh fitur dan sinkronisasi data berjalan dengan versi terbaru.
            </p>

            {updateInfo.commitMsg && updateInfo.commitMsg !== "Pembaruan versi sistem" && (
              <p className="text-[11px] text-zinc-400 italic mt-1 truncate">
                Catatan: {updateInfo.commitMsg}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-2 border-t border-zinc-800/80">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>
                  Refresh Sekarang {!isAutoReloadPaused && `(${countdown}s)`}
                </span>
              </button>

              {!isAutoReloadPaused ? (
                <button
                  onClick={() => setIsAutoReloadPaused(true)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Jeda Auto-Refresh
                </button>
              ) : (
                <button
                  onClick={() => setIsDismissed(true)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Nanti Saja
                </button>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition shrink-0"
            title="Tutup pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
