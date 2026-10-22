"use client";

import React, { useState, useEffect } from "react";

export interface AppUser {
  name: string;
  role: "admin" | "readonly";
}

export const ALLOWED_USERS = [
  { name: "Farhan", icon: "👨‍💻" },
  { name: "Rendy", icon: "👨‍💼" },
  { name: "Afuan", icon: "👨‍💻" },
  { name: "Aqsal", icon: "👨‍🔬" },
  { name: "Wibi", icon: "👨‍🔧" },
  { name: "Andre", icon: "👨‍💼" },
  { name: "Melinda", icon: "👩‍💼" },
  { name: "Mahendra", icon: "👨‍💻" },
  { name: "Putri", icon: "👩‍💼" },
  { name: "Azizah", icon: "👩‍💻" },
  { name: "stranger", icon: "👁️", isReadOnly: true },
] as const;

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLogin: (user: AppUser) => void;
  currentUser: AppUser | null;
  isDarkMode: boolean;
}

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  currentUser,
  isDarkMode,
}: LoginModalProps) {
  const [selectedName, setSelectedName] = useState<string>("Farhan");

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.name) {
        setSelectedName(currentUser.name);
      }
    }
  }, [isOpen, currentUser]);

  const handleSelectUser = (name: string) => {
    setSelectedName(name);
  };

  const handleConfirmLogin = (nameToLogin?: string) => {
    const targetName = nameToLogin || selectedName || "Farhan";
    const isStranger = String(targetName).toLowerCase() === "stranger";
    onLogin({
      name: targetName,
      role: isStranger ? "readonly" : "admin",
    });
  };

  if (!isOpen) return null;

  const isStranger = String(selectedName || "").toLowerCase() === "stranger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm rounded-2xl p-4 sm:p-5 shadow-2xl border transition-all ${
          isDarkMode
            ? "bg-[#0f172a] border-slate-700/80 text-slate-100 shadow-black/80"
            : "bg-white border-slate-200 text-slate-800 shadow-slate-300/60"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div>
              <h2 className="text-xs font-bold tracking-tight">Siapa yang Sedang ON?</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Pilih nama Anda untuk masuk ke sistem</p>
            </div>
          </div>
          {currentUser && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-1.5 py-0.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* User Grid (3 Kolom Ringkas) */}
        <div className="mb-3.5">
          <div className="grid grid-cols-3 gap-1.5">
            {ALLOWED_USERS.map((usr) => {
              const isSelected = selectedName === usr.name;
              const isReadOnly = "isReadOnly" in usr && usr.isReadOnly;

              return (
                <button
                  key={usr.name}
                  type="button"
                  onClick={() => handleSelectUser(usr.name)}
                  onDoubleClick={() => handleConfirmLogin(usr.name)}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? isDarkMode
                        ? "bg-blue-950/90 border-blue-500 ring-2 ring-blue-500/40 text-blue-200 font-bold shadow-xs scale-[1.02]"
                        : "bg-blue-50 border-blue-500 ring-2 ring-blue-500/30 text-blue-900 font-bold shadow-xs scale-[1.02]"
                      : isDarkMode
                      ? "bg-[#182542]/50 hover:bg-[#223359] border-slate-700/80 text-slate-300"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <span className="text-base shrink-0">{usr.icon}</span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-xs truncate">{usr.name}</div>
                    {isReadOnly && (
                      <div className="text-[8px] text-amber-500 font-normal leading-none mt-0.5">Lihat</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status info bar */}
        <div
          className={`mb-3.5 p-2 rounded-xl border flex items-center gap-2 text-[11px] ${
            isStranger
              ? isDarkMode
                ? "bg-amber-950/30 border-amber-800/50 text-amber-200"
                : "bg-amber-50 border-amber-200 text-amber-800"
              : isDarkMode
              ? "bg-slate-900/80 border-slate-800 text-slate-300"
              : "bg-slate-50 border-slate-200 text-slate-700"
          }`}
        >
          <span className="text-xs shrink-0">{isStranger ? "👁️" : "⚡"}</span>
          <div className="min-w-0 flex-1">
            {isStranger ? (
              <span><strong>Mode Stranger:</strong> Akses pantau (Hanya Lihat).</span>
            ) : (
              <span>Terpilih: <strong className="text-black dark:text-white font-bold">{selectedName}</strong> (Akses Penuh)</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {currentUser && onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                isDarkMode
                  ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                  : "border-slate-200 hover:bg-slate-100 text-slate-600"
              }`}
            >
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={() => handleConfirmLogin()}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
              isStranger
                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 shadow-amber-900/20"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 shadow-emerald-900/20"
            }`}
          >
            <span>
              {isStranger ? "👁️ Masuk Mode Stranger" : `🟢 Masuk sebagai ${selectedName}`}
            </span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
