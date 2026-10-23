"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  authenticateUser,
  registerStaffAccount,
  saveCloudOtp,
  verifyCloudOtp,
} from "@/lib/firestoreService";
import Link from "next/link";
import {
  Lock,
  KeyRound,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Building2,
  Package,
  ExternalLink,
  User,
  Mail,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RotateCw,
} from "lucide-react";

export interface AppUser {
  name: string;
  role: "admin" | "readonly";
}

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
}: LoginModalProps) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Login form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const passInputRef = useRef<HTMLInputElement>(null);

  // Register form state
  const [regStep, setRegStep] = useState<"form" | "otp">("form");
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);

  // OTP verification state
  const [regOtp, setRegOtp] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [previewOtpHint, setPreviewOtpHint] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.name) {
        setIdentifier(currentUser.name.toLowerCase());
      }
      setPassword("");
      setErrorMessage("");
      setSuccessMessage("");
      setTimeout(() => {
        passInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, currentUser]);

  // Cooldown countdown for Kirim Ulang OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [otpCooldown]);

  const handleConfirmLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage("Silakan masukkan username atau alamat Gmail Anda.");
      return;
    }
    if (!password) {
      setErrorMessage("Silakan masukkan password Anda.");
      passInputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");

    try {
      const res = await authenticateUser(cleanId, password.trim());
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setErrorMessage(res.message || "Password salah. Silakan periksa kembali.");
        passInputRef.current?.focus();
      }
    } catch {
      setErrorMessage("Gagal memverifikasi password ke server cloud. Coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  };

  // STEP 1: Submit form details & request OTP to Gmail
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanFull = regFullName.trim();
    const cleanUser = regUsername.trim().toLowerCase();
    const cleanMail = regEmail.trim().toLowerCase();
    const cleanPass = regPassword.trim();

    if (!cleanFull) {
      setErrorMessage("Silakan masukkan nama lengkap Anda.");
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setErrorMessage("Username akun minimal 3 karakter (tanpa spasi).");
      return;
    }
    if (!cleanMail || !cleanMail.includes("@")) {
      setErrorMessage("Silakan masukkan alamat Gmail yang valid.");
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setErrorMessage("Password minimal 4 karakter.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");
    setSuccessMessage("");
    setPreviewOtpHint(null);

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: cleanMail,
          name: cleanFull,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRegStep("otp");
        setOtpCooldown(60);
        setSuccessMessage(data.message || `Kode OTP telah dikirim ke ${cleanMail}`);
        if (data.previewOtp) {
          setPreviewOtpHint(data.previewOtp);
          await saveCloudOtp(cleanMail, data.previewOtp);
        }
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 150);
      } else {
        setErrorMessage(data.message || "Gagal mengirimkan kode OTP.");
      }
    } catch (err) {
      console.error("OTP send error:", err);
      // Fallback offline generation
      const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
      await saveCloudOtp(cleanMail, fallbackOtp);
      setRegStep("otp");
      setOtpCooldown(60);
      setPreviewOtpHint(fallbackOtp);
      setSuccessMessage(`Kode verifikasi dibuat untuk ${cleanMail}.`);
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (otpCooldown > 0 || isVerifying) return;
    await handleRequestOtp();
  };

  // STEP 2: Verify OTP and finalize staff account creation
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = regOtp.trim();
    const cleanMail = regEmail.trim().toLowerCase();

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage("Silakan masukkan 6 digit kode OTP verifikasi.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let isValid = false;

      // 1. Check via API endpoint
      try {
        const res = await fetch("/api/auth/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "verify",
            email: cleanMail,
            code: cleanOtp,
          }),
        });
        const data = await res.json();
        if (data.success) isValid = true;
      } catch {}

      // 2. Fallback check with Firestore
      if (!isValid) {
        const cloudRes = await verifyCloudOtp(cleanMail, cleanOtp);
        if (cloudRes.success) isValid = true;
      }

      // 3. Fallback check with local preview hint
      if (!isValid && previewOtpHint && previewOtpHint === cleanOtp) {
        isValid = true;
      }

      if (!isValid) {
        setErrorMessage("Kode OTP yang Anda masukkan salah atau telah kadaluarsa. Periksa kembali email Anda.");
        setIsVerifying(false);
        return;
      }

      // OTP Verified successfully! Now register account
      const regRes = await registerStaffAccount(regUsername, cleanMail, regPassword, regFullName);
      if (regRes.success) {
        setSuccessMessage("Kode OTP Berhasil Diverifikasi! Akun Anda aktif.");
        setTimeout(() => {
          onLogin({
            name: regFullName.trim() || regUsername.trim(),
            role: "admin",
          });
        }, 1200);
      } else {
        setErrorMessage(regRes.message || "Gagal menyimpan akun ke database.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setErrorMessage("Terjadi kendala saat memverifikasi akun.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

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
        {/* SISI KANAN (FORM LOGIN / REGISTER / OTP) */}
        {/* ========================================================= */}
        <div className="md:w-1/2 p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-[#0e0f17]">
          <div className="w-full max-w-sm mx-auto">
            
            {/* Header Tabs (Login vs Register) */}
            <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setRegStep("form");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "login"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Masuk ke Akun</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setRegStep("form");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "register"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Daftar Akun Baru</span>
              </button>
            </div>

            {/* Error & Success Alerts */}
            {errorMessage && (
              <div className="mb-3.5 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-3.5 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* ========================================= */}
            {/* TAB 1: FORM LOGIN (USERNAME / GMAIL + PW) */}
            {/* ========================================= */}
            {authMode === "login" ? (
              <form onSubmit={handleConfirmLogin} className="space-y-3.5">
                {/* Identifier Input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Username atau Alamat Gmail:
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      placeholder="Masukkan username atau alamat Gmail..."
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-zinc-700 bg-zinc-900/90 text-white outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Password:
                    </label>
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
                      placeholder="Masukkan password Anda..."
                      className="w-full pl-10 pr-10 py-2.5 text-xs font-mono rounded-xl border border-zinc-700 bg-zinc-900/90 text-white outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3 px-4 text-xs font-extrabold rounded-xl text-white shadow-lg shadow-blue-600/25 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Meja Kerja</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : regStep === "form" ? (
              /* ========================================= */
              /* TAB 2, STEP 1: FORM PENDAFTARAN AKUN      */
              /* ========================================= */
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Nama Lengkap Staf:
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Contoh: Farhan"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Username Akun (Kecil tanpa spasi):
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    placeholder="Contoh: farhan"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Alamat Gmail (Untuk Verifikasi OTP):
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value.trim())}
                    placeholder="Contoh: ffuegoleon@gmail.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Buat Password (Min. 4 Karakter):
                  </label>
                  <div className="relative">
                    <input
                      type={regShowPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Masukkan password baru..."
                      className="w-full px-3 pr-10 py-2 text-xs font-mono rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {regShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full mt-2 py-2.5 px-4 text-xs font-extrabold rounded-xl text-white shadow-lg shadow-emerald-600/25 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirimkan Kode OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Lanjut: Kirim Kode OTP ke Gmail</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ========================================= */
              /* TAB 2, STEP 2: VERIFIKASI KODE OTP GMAIL  */
              /* ========================================= */
              <form onSubmit={handleVerifyOtp} className="space-y-3.5 animate-in fade-in duration-200">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center mb-1.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Masukkan 6-Digit Kode Verifikasi</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Kode OTP dikirimkan ke:
                  </p>
                  <p className="text-xs font-mono font-bold text-blue-400 truncate max-w-full">
                    {regEmail}
                  </p>
                </div>

                {/* Preview hint badge if SMTP is waiting for credentials */}
                {previewOtpHint && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span>Kode Verifikasi Uji Coba: </span>
                      <strong className="font-mono text-xs text-white">{previewOtpHint}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegOtp(previewOtpHint)}
                      className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-black rounded hover:bg-amber-400 cursor-pointer shrink-0"
                    >
                      Isi Otomatis
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 text-center">
                    6-Digit Kode OTP:
                  </label>
                  <input
                    ref={otpInputRef}
                    type="text"
                    maxLength={6}
                    required
                    value={regOtp}
                    onChange={(e) => {
                      setRegOtp(e.target.value.replace(/\D/g, ""));
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="••••••"
                    className="w-full text-center text-2xl font-mono tracking-[0.4em] py-2.5 rounded-xl border border-blue-500/40 bg-zinc-900 text-white outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-zinc-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || regOtp.length < 6}
                  className="w-full py-2.5 px-4 text-xs font-extrabold rounded-xl text-white shadow-lg shadow-emerald-600/25 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Kode OTP...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verifikasi & Aktifkan Akun</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRegStep("form");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Ubah Data</span>
                  </button>

                  <button
                    type="button"
                    disabled={otpCooldown > 0 || isVerifying}
                    onClick={handleResendOtp}
                    className="text-blue-400 hover:text-blue-300 disabled:text-zinc-600 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed font-medium"
                  >
                    <RotateCw className={`w-3 h-3 ${isVerifying ? "animate-spin" : ""}`} />
                    <span>
                      {otpCooldown > 0 ? `Kirim Ulang (${otpCooldown}s)` : "Kirim Ulang Kode"}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* Link Portal Apotek Pelanggan */}
            <div className="mt-5 pt-3.5 border-t border-zinc-800 text-center">
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
