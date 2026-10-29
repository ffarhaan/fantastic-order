"use client";

import React, { useState, useEffect } from "react";
import {
  getUserPassword,
  changeUserPassword,
  isSuperAdminUser,
} from "@/lib/firestoreService";
import { AppUser } from "./LoginModal";
import {
  User,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  LogOut,
  Sparkles,
} from "lucide-react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  isDarkMode: boolean;
  onOpenApprovalModal?: () => void;
  onLogout?: () => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  isDarkMode,
  onOpenApprovalModal,
  onLogout,
}: UserProfileModalProps) {
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [loadingPass, setLoadingPass] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Change password form state
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const userName = currentUser?.name || "";
  const isSuper = isSuperAdminUser(userName);

  // Load current user password
  useEffect(() => {
    if (!isOpen || !userName) return;
    let isMounted = true;
    setLoadingPass(true);
    setErrorMessage("");
    setSuccessMessage("");

    getUserPassword(userName)
      .then((pass) => {
        if (isMounted) {
          setCurrentPassword(pass || "123");
          setLoadingPass(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingPass(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userName]);

  if (!isOpen || !currentUser) return null;

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!oldPassword) {
      setErrorMessage("Silakan masukkan password lama Anda.");
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      setErrorMessage("Password baru minimal 3 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi password baru tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changeUserPassword(userName, oldPassword, newPassword);
      if (res.success) {
        setSuccessMessage(res.message);
        setCurrentPassword(newPassword.trim());
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowChangeForm(false);
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage("Terjadi kendala saat memperbarui password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div
        className={`relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden my-auto transition-all ${
          isDarkMode
            ? "bg-[#0b0c13] border-zinc-800 text-zinc-100 shadow-black/80"
            : "bg-white border-zinc-200 text-zinc-900 shadow-xl"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDarkMode ? "border-zinc-800 bg-[#0e0f17]" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm font-bold text-xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xs font-black tracking-tight flex items-center gap-1.5">
                <span>Informasi Akun &amp; Password</span>
                {isSuper && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-mono font-bold border border-amber-500/30">
                    Super Admin
                  </span>
                )}
              </h3>
              <p className={`text-[10px] ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                Rincian akses login dan kredensial Anda
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition cursor-pointer ${
              isDarkMode
                ? "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700"
            }`}
            title="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* User Identity Card */}
          <div
            className={`p-4 rounded-2xl border space-y-2.5 ${
              isDarkMode
                ? "bg-zinc-900/60 border-zinc-800/80"
                : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                Nama Lengkap
              </span>
              <span className="text-xs font-bold text-blue-400">{userName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                Username
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold">@{userName.toLowerCase()}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(userName.toLowerCase())}
                  className={`p-1 rounded hover:bg-zinc-700/40 text-zinc-400 hover:text-white transition cursor-pointer`}
                  title="Salin username"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            {currentUser.email && (
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                  Email Terdaftar
                </span>
                <span className="text-xs font-mono text-zinc-300 truncate max-w-[200px]">
                  {currentUser.email}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                Hak Akses / Peran
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isSuper
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : currentUser.role === "readonly"
                  ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              }`}>
                {isSuper ? "Super Admin (Owner)" : currentUser.role === "readonly" ? "Hanya Lihat (Viewer)" : "Admin Operasional"}
              </span>
            </div>
          </div>

          {/* Password Card */}
          <div
            className={`p-4 rounded-2xl border ${
              isDarkMode
                ? "bg-gradient-to-br from-indigo-950/20 via-zinc-900/60 to-purple-950/20 border-indigo-500/30"
                : "bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-indigo-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-400">
                <KeyRound className="w-4 h-4" />
                <span>Password Akun Anda</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer ${
                    isDarkMode
                      ? "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:text-black shadow-xs"
                  }`}
                  title={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">Tutup</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">Lihat</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(currentPassword)}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer ${
                    copied
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : isDarkMode
                      ? "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:text-black shadow-xs"
                  }`}
                  title="Salin password ke clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                isDarkMode
                  ? "bg-zinc-950/80 border-zinc-800"
                  : "bg-white border-zinc-200"
              }`}
            >
              {loadingPass ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memuat password...</span>
                </div>
              ) : (
                <span className="text-sm font-mono font-extrabold tracking-wider text-indigo-400 select-all">
                  {showPassword ? currentPassword : "••••••••••••"}
                </span>
              )}
            </div>
          </div>

          {/* Super Admin Special Button (Khusus Farhan) */}
          {isSuper && (
            <div
              className={`p-4 rounded-2xl border ${
                isDarkMode
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black">Menu Khusus Akun Anda (Super Admin / Owner)</span>
              </div>
              <p className="text-[11px] leading-relaxed mb-3 opacity-90">
                Anda dapat melihat seluruh daftar username, email, dan password semua staf Fantastic Order di satu tempat.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenApprovalModal) onOpenApprovalModal();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer transition-all"
              >
                <Shield className="w-4 h-4" />
                <span>Lihat Semua Akun &amp; Password Staf</span>
              </button>
            </div>
          )}

          {/* Ganti Password Section */}
          <div className={`pt-2 border-t ${isDarkMode ? "border-zinc-800" : "border-zinc-200"}`}>
            {!showChangeForm ? (
              <button
                type="button"
                onClick={() => setShowChangeForm(true)}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  isDarkMode
                    ? "border-zinc-700 hover:border-zinc-600 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                    : "border-zinc-300 hover:border-zinc-400 bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Ingin Mengubah Password? Klik di Sini</span>
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 p-3.5 rounded-2xl border border-zinc-700/50 bg-zinc-900/30">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-extrabold text-blue-400">Ganti Password Baru</span>
                  <button
                    type="button"
                    onClick={() => setShowChangeForm(false)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-1 opacity-80">
                    Password Lama
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan password saat ini..."
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none transition ${
                      isDarkMode
                        ? "bg-zinc-950 border-zinc-800 focus:border-blue-500 text-zinc-200"
                        : "bg-white border-zinc-300 focus:border-blue-500 text-zinc-800"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-1 opacity-80">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    placeholder="Minimal 3 karakter..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none transition ${
                      isDarkMode
                        ? "bg-zinc-950 border-zinc-800 focus:border-blue-500 text-zinc-200"
                        : "bg-white border-zinc-300 focus:border-blue-500 text-zinc-800"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-1 opacity-80">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    type="password"
                    placeholder="Ketik ulang password baru..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none transition ${
                      isDarkMode
                        ? "bg-zinc-950 border-zinc-800 focus:border-blue-500 text-zinc-200"
                        : "bg-white border-zinc-300 focus:border-blue-500 text-zinc-800"
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Password Baru</span>
                </button>
              </form>
            )}
          </div>

          {/* Logout button */}
          {onLogout && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer text-rose-400 hover:text-white hover:bg-rose-600/20 border-rose-500/30`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar / Ganti Akun</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
