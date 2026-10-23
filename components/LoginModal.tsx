"use client";

import React, { useState, useEffect, useRef } from "react";
import { verifyUserPassword } from "@/lib/firestoreService";
import Link from "next/link";
import {
  Lock,
  KeyRound,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export interface AppUser {
  name: string;
  role: "admin" | "readonly";
}

export const ALLOWED_USERS = [
  { name: "Farhan", icon: "👨‍💻", role: "Super Admin" },
  { name: "Rendy", icon: "👨‍💼", role: "Logistik Hub" },
  { name: "Afuan", icon: "👨‍💻", role: "IT & Admin" },
  { name: "Aqsal", icon: "👨‍🔬", role: "QC Lead" },
  { name: "Wibi", icon: "👨‍🔧", role: "Operasional" },
  { name: "Andre", icon: "👨‍💼", role: "Logistik" },
  { name: "Melinda", icon: "👩‍💼", role: "Administrasi" },
  { name: "Mahendra", icon: "👨‍💻", role: "Warehouse" },
  { name: "Putri", icon: "👩‍💼", role: "Faktur Staff" },
  { name: "Azizah", icon: "👩‍💻", role: "Faktur Staff" },
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
  const [showPassword, setShowPassword] = useState(false);
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
        setErrorMessage("Password salah. Silakan periksa kembali.");
        passInputRef.current?.focus();
      }
    } catch {
      setErrorMessage("Gagal memverifikasi password ke server cloud. Coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  const selectedUserData = ALLOWED_USERS.find((u) => u.name === selectedName) || ALLOWED_USERS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0b0c13] text-zinc-100 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col md:flex-row my-auto">
        
        {/* Optional Close Button if user is already authenticated */}
        {currentUser && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
            title="Tutup & Kembali"
          >
            ✕
          </button>
        )}

        {/* ========================================================= */}
        {/* SISI KIRI (BRANDING RESMI & LIVE METRICS BADGES) */}
        {/* ========================================================= */}
        <div className="md:w-1/2 p-6 sm:p-8 md:p-10 bg-gradient-to-br from-[#0c0e1a] via-[#080913] to-[#04050a] border-b md:border-b-0 md:border-r border-zinc-800/80 flex flex-col justify-between relative overflow-hidden">
          {/* Ambient decorative glowing orbs */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Top Brand Tag */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md mb-6">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-xs">
                F
              </div>
              <span className="text-[11px] font-black tracking-wider text-white">FANTASTIC ORDER</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                v2.0 LIVE
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              Pusat Logistik Terpadu & Faktur Tracker.
            </h1>
            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
              Platform operasional logistik terpusat &bull; PT Medika Bina Investama &bull; PT Medika Abadi Investama.
            </p>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 mt-6 sm:mt-8">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Jaringan Apotek</span>
                </div>
                <div className="text-xl font-black text-white mt-1">
                  3.599 <span className="text-xs font-normal text-zinc-500">Mitra</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Jabodetabek & Jabar</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Faktur Diproses</span>
                </div>
                <div className="text-xl font-black text-white mt-1">
                  10.300+ <span className="text-xs font-normal text-zinc-500">Order</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Dual-Sync Cloud Aktif</div>
              </div>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="relative z-10 pt-6 mt-6 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span>&copy; 2026 PT Medika Bina Investama</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Sistem Terenkripsi Cloud</span>
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SISI KANAN (FORM LOGIN & PILIH PENGGUNA) */}
        {/* ========================================================= */}
        <div className="md:w-1/2 p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-[#0e0f17]">
          <div className="w-full max-w-sm mx-auto">
            {/* Header Form */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Autentikasi Internal</span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Login Meja Kerja</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Pilih akun Anda dan masukkan password untuk melanjutkan.</p>
            </div>

            {/* Quick Select Avatar Chips */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Pilih Nama Petugas:
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {ALLOWED_USERS.map((usr) => {
                  const isSelected = selectedName === usr.name;
                  return (
                    <button
                      key={usr.name}
                      type="button"
                      onClick={() => handleSelectUser(usr.name)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer text-xs ${
                        isSelected
                          ? "bg-blue-600/20 border-blue-500 text-blue-200 font-bold ring-2 ring-blue-500/30 shadow-xs"
                          : "bg-zinc-900/70 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300"
                      }`}
                    >
                      <span className="text-base shrink-0">{usr.icon}</span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate font-bold">{usr.name}</div>
                        <div className="text-[9px] text-zinc-500 truncate">{usr.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Password */}
            <form onSubmit={handleConfirmLogin} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Password untuk <strong className="text-blue-400">{selectedName}</strong>:
                  </label>
                  <span className="text-[10px] text-zinc-500">Default: 123</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    ref={passInputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="Ketik password..."
                    className={`w-full pl-10 pr-10 py-2.5 text-xs font-mono rounded-xl border bg-zinc-900/90 text-white outline-hidden transition-all ${
                      errorMessage
                        ? "border-red-500 ring-2 ring-red-500/20 bg-red-950/20"
                        : "border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white cursor-pointer"
                    title={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 px-4 text-xs font-extrabold rounded-xl text-white shadow-lg shadow-blue-600/25 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk sebagai {selectedName}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Link Portal Apotek Pelanggan */}
            <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
              <span className="text-[11px] text-zinc-400 block">
                Anda perwakilan dari Apotek / Faskes Mitra?
              </span>
              <Link
                href="/komplain"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline mt-1 transition-colors"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Buka Portal Pengajuan & Status Retur Apotek</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
