"use client";

import React, { useState, useEffect, useRef } from "react";
import { verifyUserPassword } from "@/lib/firestoreService";
import Link from "next/link";
import { Lock, KeyRound, AlertCircle, Loader2, ArrowRight } from "lucide-react";

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
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const passInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.name) {
        setSelectedName(currentUser.name);
      }
      setPassword("");
      setErrorMessage("");
      setTimeout(() => {
        passInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, currentUser]);

  const handleSelectUser = (name: string) => {
    setSelectedName(name);
    setErrorMessage("");
    setPassword("");
    setTimeout(() => {
      passInputRef.current?.focus();
    }, 50);
  };

  const handleConfirmLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setErrorMessage("Silakan masukkan password / PIN Anda.");
      passInputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");

    try {
      const isValid = await verifyUserPassword(selectedName, password.trim());
      if (isValid) {
        onLogin({
          name: selectedName,
          role: "admin",
        });
      } else {
        setErrorMessage("Password salah. Silakan coba lagi.");
        passInputRef.current?.focus();
      }
    } catch {
      setErrorMessage("Gagal memverifikasi password. Coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border transition-all ${
          isDarkMode
            ? "bg-[#0b1120] border-slate-700/80 text-slate-100 shadow-black"
            : "bg-white border-slate-200 text-slate-800 shadow-xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Login Internal Logistik</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Pilih nama akun & masukkan password</p>
            </div>
          </div>
          {currentUser && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-2 py-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* User Grid (5 Kolom x 2 Baris) */}
        <div className="mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Pilih Nama Pengguna:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {ALLOWED_USERS.map((usr) => {
              const isSelected = selectedName === usr.name;
              return (
                <button
                  key={usr.name}
                  type="button"
                  onClick={() => handleSelectUser(usr.name)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-left transition-all cursor-pointer text-xs ${
                    isSelected
                      ? isDarkMode
                        ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold ring-2 ring-blue-500/30"
                        : "bg-blue-50 border-blue-500 text-blue-900 font-bold ring-2 ring-blue-500/20"
                      : isDarkMode
                      ? "bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <span className="text-sm shrink-0">{usr.icon}</span>
                  <span className="truncate">{usr.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Password Form */}
        <form onSubmit={handleConfirmLogin} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Password untuk <span className="text-blue-500">{selectedName}</span>:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                ref={passInputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                placeholder="Masukkan password..."
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border font-sans outline-hidden transition-all ${
                  errorMessage
                    ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/20"
                    : isDarkMode
                    ? "bg-slate-900/90 border-slate-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    : "bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                }`}
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-xs flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {currentUser && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={isVerifying}
              className="flex-1 py-2 px-3 text-xs font-bold rounded-xl text-white shadow-md bg-blue-600 hover:bg-blue-500 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk sebagai {selectedName}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Link for Apotek Customers */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Anda perwakilan dari Apotek / Faskes?
          </p>
          <Link
            href="/komplain"
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mt-1"
          >
            <span>Buka Portal Pengajuan & Status Retur Apotek</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
