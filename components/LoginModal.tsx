"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  authenticateUser,
  registerStaffAccount,
  saveCloudOtp,
  verifyCloudOtp,
  markAccountOtpVerified,
  subscribeToUserProfiles,
  updateStaffApprovalStatus,
  isSuperAdminUser,
  StaffAccountProfile,
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
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";

export interface AppUser {
  id?: string;
  name: string;
  email?: string;
  role: "admin" | "readonly";
  systemRole?: "super_admin" | "warehouse_manager" | "staff" | "viewer";
  warehouseIds?: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLogin: (user: AppUser) => void;
  onLogout?: () => void;
  currentUser: AppUser | null;
  isDarkMode: boolean;
}

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  currentUser,
}: LoginModalProps) {
  const isFarhanAdmin =
    isSuperAdminUser(currentUser?.name) || isSuperAdminUser(currentUser?.email);
  const [authMode, setAuthMode] = useState<"login" | "register" | "approvals">("login");

  // Login form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const passInputRef = useRef<HTMLInputElement>(null);

  // Register & OTP workflow state:
  // "form" -> "waiting_acc" (waiting for Farhan to ACC) -> "otp" (OTP sent after ACC, user inputs OTP)
  const [regStep, setRegStep] = useState<"form" | "waiting_acc" | "otp">("form");
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);

  // OTP verification state
  const [regOtp, setRegOtp] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Admin Approval state (real-time profiles from Firestore)
  const [allProfiles, setAllProfiles] = useState<StaffAccountProfile[]>([]);
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToUserProfiles((list) => {
      setAllProfiles(list);
    });
    return () => unsub();
  }, []);

  const pendingProfiles = allProfiles.filter((p) => p.approvalStatus === "pending");
  const approvedProfiles = allProfiles.filter((p) => p.approvalStatus === "approved");

  // Real-time transition: if user is on "waiting_acc" screen and Farhan clicks ACC,
  // automatically switch their screen to "otp" so they can input the OTP sent to their Gmail!
  useEffect(() => {
    if (regStep === "waiting_acc" && regUsername) {
      const cleanU = regUsername.trim().toLowerCase();
      const matched = allProfiles.find((p) => p.username.toLowerCase() === cleanU);
      if (matched) {
        if (matched.approvalStatus === "approved") {
          setRegStep("otp");
          setErrorMessage("");
          setSuccessMessage(
            `Akun Anda baru saja di-ACC oleh Farhan! Kode OTP 6 digit telah dikirimkan ke Gmail ${matched.email}.`
          );
          setTimeout(() => {
            otpInputRef.current?.focus();
          }, 150);
        } else if (matched.approvalStatus === "rejected") {
          setRegStep("form");
          setErrorMessage("Maaf, pengajuan pendaftaran akun Anda tidak disetujui oleh Administrator.");
        }
      }
    }
  }, [allProfiles, regStep, regUsername]);

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.name) {
        setIdentifier(currentUser.name.toLowerCase());
      }
      setPassword("");
      setErrorMessage("");
      setSuccessMessage("");
      if (isFarhanAdmin && pendingProfiles.length > 0) {
        setAuthMode("approvals");
      } else {
        setAuthMode("login");
        setTimeout(() => {
          passInputRef.current?.focus();
        }, 150);
      }
    }
  }, [isOpen, currentUser, isFarhanAdmin, pendingProfiles.length]);

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
    setSuccessMessage("");

    try {
      const res = await authenticateUser(cleanId, password.trim());
      if (res.success && res.user) {
        onLogin(res.user);
      } else if (res.requiresOtp && res.pendingProfile) {
        // Account has been approved by Farhan, now needs to enter the 6-digit OTP sent to their Gmail!
        setRegUsername(res.pendingProfile.username);
        setRegFullName(res.pendingProfile.displayName);
        setRegEmail(res.pendingProfile.email);
        setRegOtp("");
        setAuthMode("register");
        setRegStep("otp");
        setSuccessMessage(
          res.message ||
            `Akun Anda telah di-ACC oleh Farhan! Masukkan 6-digit Kode OTP yang telah dikirim ke Gmail ${res.pendingProfile.email}.`
        );
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 150);
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

  // STEP 1: User submits registration form -> Saved as PENDING ACC (NO OTP sent yet!)
  const handleSubmitRegistration = async (e?: React.FormEvent) => {
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

    try {
      const regRes = await registerStaffAccount(
        cleanUser,
        cleanMail,
        cleanPass,
        cleanFull
      );

      if (!regRes.success) {
        setErrorMessage(regRes.message || "Gagal mengajukan pendaftaran akun.");
        return;
      }

      // If Farhan himself registers/updates, log right in
      if (isSuperAdminUser(cleanUser) || isSuperAdminUser(cleanMail)) {
        setSuccessMessage("Akun Administrator aktif!");
        setTimeout(() => {
          onLogin({
            name: cleanFull || cleanUser,
            role: "admin",
          });
        }, 800);
        return;
      }

      // Notify Farhan's Gmail that a new account is waiting for his ACC
      fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notify_admin",
          email: cleanMail,
          name: cleanFull,
          username: cleanUser,
        }),
      }).catch(() => {});

      setRegStep("waiting_acc");
      setSuccessMessage(
        "Pengajuan akun berhasil dikirim! Menunggu di-ACC oleh Farhan sebelum kode OTP dikirimkan ke Gmail Anda."
      );
    } catch (err) {
      console.error("Registration submit error:", err);
      setErrorMessage("Terjadi kendala saat mengirim pengajuan akun.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP handler (only available AFTER account has been approved by Farhan)
  const handleResendOtp = async () => {
    if (otpCooldown > 0 || isVerifying || !regEmail) return;
    setIsVerifying(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: regEmail.trim().toLowerCase(),
          name: regFullName.trim() || regUsername.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpCooldown(60);
        if (data.otpToken) setOtpToken(data.otpToken);
        if (data.cloudOtpCode) {
          await saveCloudOtp(regEmail.trim().toLowerCase(), data.cloudOtpCode);
        }
        setSuccessMessage(`Kode OTP baru telah dikirim ulang ke Gmail ${regEmail}.`);
      } else {
        setErrorMessage(data.message || "Gagal mengirim ulang kode OTP.");
      }
    } catch {
      setErrorMessage("Gagal menghubungi server email OTP.");
    } finally {
      setIsVerifying(false);
    }
  };

  // STEP 3: Verify 6-digit OTP received in Gmail AFTER Farhan's ACC
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = regOtp.trim();
    const cleanMail = regEmail.trim().toLowerCase();

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage("Silakan masukkan 6 digit kode OTP verifikasi dari Gmail Anda.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let isValid = false;

      // 1. Check with Firestore cloud OTP (saved when Farhan clicked ACC & Kirim OTP)
      const cloudRes = await verifyCloudOtp(cleanMail, cleanOtp);
      if (cloudRes.success) {
        isValid = true;
      }

      // 2. Fallback check via API endpoint (if resent in same session)
      if (!isValid) {
        try {
          const res = await fetch("/api/auth/otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "verify",
              email: cleanMail,
              code: cleanOtp,
              otpToken,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) isValid = true;
        } catch {}
      }

      if (!isValid) {
        setErrorMessage(
          "Kode OTP yang Anda masukkan salah atau telah kadaluarsa. Periksa kembali Gmail Anda atau klik Kirim Ulang Kode."
        );
        setIsVerifying(false);
        return;
      }

      // Mark account as verified in Firestore!
      await markAccountOtpVerified(regUsername, regFullName);

      setSuccessMessage("Kode OTP Berhasil Diverifikasi! Akun Anda kini aktif sepenuhnya.");
      setTimeout(() => {
        onLogin({
          name: regFullName.trim() || regUsername.trim(),
          role: "admin",
        });
      }, 1000);
    } catch (err) {
      console.error("Verification error:", err);
      setErrorMessage("Terjadi kendala saat memverifikasi kode OTP.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Handler for Farhan to Approve (ACC -> automatically sends OTP to user's Gmail!) or Reject
  const handleDecision = async (
    prof: StaffAccountProfile,
    decision: "approved" | "rejected"
  ) => {
    setProcessingUser(prof.username);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (decision === "approved") {
        // 1. Send 6-digit OTP email to the user's Gmail right when Farhan clicks ACC!
        const otpRes = await fetch("/api/auth/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send",
            email: prof.email,
            name: prof.displayName,
          }),
        });
        const otpData = await otpRes.json();

        if (!otpRes.ok || !otpData.success) {
          setErrorMessage(
            otpData.message || `Gagal mengirim OTP ke Gmail ${prof.email}.`
          );
          return;
        }

        // 2. Save the generated OTP to Firestore so the user can verify it on their device
        if (otpData.cloudOtpCode) {
          await saveCloudOtp(prof.email, otpData.cloudOtpCode);
        }

        // 3. Update profile status to "approved" (with verified: false until they input the OTP)
        const res = await updateStaffApprovalStatus(
          prof.username,
          prof.displayName,
          "approved",
          prof.role
        );

        if (res.success) {
          setSuccessMessage(
            `Akun ${prof.displayName} (@${prof.username}) berhasil di-ACC & kode OTP 6 digit telah dikirim ke Gmail ${prof.email}!`
          );
        } else {
          setErrorMessage(res.message);
        }
      } else {
        const res = await updateStaffApprovalStatus(
          prof.username,
          prof.displayName,
          "rejected",
          prof.role
        );
        if (res.success) {
          setSuccessMessage(res.message);
        } else {
          setErrorMessage(res.message);
        }
      }
    } catch {
      setErrorMessage("Terjadi kesalahan saat memproses persetujuan akun.");
    } finally {
      setProcessingUser(null);
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
        {/* SISI KANAN (FORM LOGIN / REGISTER / OTP / ACC FARHAN) */}
        {/* ========================================================= */}
        <div className="md:w-1/2 p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-[#0e0f17]">
          <div className="w-full max-w-sm mx-auto">
            
            {/* Header Tabs (Login vs Register vs ACC Admin) */}
            <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl mb-5 gap-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setRegStep("form");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "login"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Lock className="w-3 h-3 shrink-0" />
                <span>Masuk</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setRegStep("form");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "register"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Daftar Baru</span>
              </button>
              {isFarhanAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("approvals");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                    authMode === "approvals"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>ACC Akun</span>
                  {pendingProfiles.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-black animate-pulse">
                      {pendingProfiles.length}
                    </span>
                  )}
                </button>
              )}
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
            {/* TAB 3: PANEL ACC AKUN (KHUSUS AKUN FARHAN) */}
            {/* ========================================= */}
            {authMode === "approvals" && isFarhanAdmin ? (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Menunggu ACC & Kirim OTP ({pendingProfiles.length})</span>
                    </span>
                  </div>

                  {pendingProfiles.length === 0 ? (
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-center text-xs text-zinc-500">
                      Tidak ada permintaan pendaftaran akun baru yang menunggu ACC saat ini.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {pendingProfiles.map((p) => (
                        <div
                          key={p.username}
                          className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {p.displayName}{" "}
                              <span className="text-[10px] font-mono text-zinc-400">
                                (@{p.username})
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-blue-400 truncate">
                              {p.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={processingUser === p.username}
                              onClick={() => handleDecision(p, "approved")}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Setujui (ACC) & Kirim Kode OTP ke Gmail Pendaftar"
                            >
                              {processingUser === p.username ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserCheck className="w-3 h-3" />
                              )}
                              <span>ACC & Kirim OTP</span>
                            </button>
                            <button
                              type="button"
                              disabled={processingUser === p.username}
                              onClick={() => handleDecision(p, "rejected")}
                              className="px-2 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Tolak Akun Ini"
                            >
                              <UserX className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Daftar Akun yang Sudah Di-ACC */}
                <div className="pt-3 border-t border-zinc-800">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block mb-2">
                    Daftar Akun Disetujui ({approvedProfiles.length})
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {approvedProfiles.map((p) => {
                      const isSelf = isSuperAdminUser(p.username) || isSuperAdminUser(p.email);
                      return (
                        <div
                          key={p.username}
                          className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1.5">
                              <span>{p.displayName}</span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                (@{p.username})
                              </span>
                              {!isSelf && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                    p.verified
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                  }`}
                                >
                                  {p.verified ? "Aktif" : "Tunggu Input OTP"}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-400 truncate">
                              {p.email}
                            </div>
                          </div>
                          {isSelf ? (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                              Owner
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 shrink-0">
                              {!p.verified && (
                                <button
                                  type="button"
                                  disabled={processingUser === p.username}
                                  onClick={() => handleDecision(p, "approved")}
                                  className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-[9px] font-bold transition-colors cursor-pointer"
                                  title="Kirim Ulang OTP ke Gmail"
                                >
                                  Kirim OTP
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={processingUser === p.username}
                                onClick={() => handleDecision(p, "rejected")}
                                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-400 hover:text-white text-[10px] font-bold transition-colors cursor-pointer"
                                title="Nonaktifkan / Cabut ACC"
                              >
                                Cabut
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : authMode === "login" ? (
              /* ========================================= */
              /* TAB 1: FORM LOGIN (USERNAME / GMAIL + PW) */
              /* ========================================= */
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
              <form onSubmit={handleSubmitRegistration} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Nama Lengkap Staf:
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
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
                    placeholder="Contoh: budi"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Alamat Gmail (Tujuan Pengiriman OTP Setelah Di-ACC):
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value.trim())}
                    placeholder="Contoh: nama@gmail.com"
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

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                  * Pendaftaran akan diajukan ke <strong>Admin (Farhan)</strong> terlebih dahulu. Setelah di-ACC oleh Admin, <strong>Kode OTP 6 digit akan otomatis dikirimkan ke Gmail Anda</strong>.
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full mt-1 py-2.5 px-4 text-xs font-extrabold rounded-xl text-white shadow-lg shadow-emerald-600/25 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim Pengajuan ke Admin...</span>
                    </>
                  ) : (
                    <>
                      <span>Ajukan Pendaftaran Akun</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : regStep === "waiting_acc" ? (
              /* ======================================================== */
              /* TAB 2, STEP 2: MENUNGGU ACC FARHAN SEBELUM OTP DIKIRIM   */
              /* ======================================================== */
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white">
                    Menunggu Persetujuan (ACC) Admin
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Pengajuan akun <strong>{regFullName}</strong> (<span className="font-mono text-amber-300">@{regUsername}</span>) telah diterima.
                  </p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Begitu akun Anda <strong>di-ACC oleh Farhan</strong>, sistem akan langsung mengirimkan <strong>6-Digit Kode OTP</strong> ke Gmail:
                  </p>
                  <p className="text-xs font-mono font-bold text-blue-400 truncate">
                    {regEmail}
                  </p>
                </div>

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
                    <span>Kembali</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setRegStep("form");
                      setIdentifier(regUsername);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                  >
                    Ke Halaman Login &rarr;
                  </button>
                </div>
              </div>
            ) : (
              /* ======================================================== */
              /* TAB 2, STEP 3: INPUT KODE OTP (SETELAH DI-ACC FARHAN)    */
              /* ======================================================== */
              <form onSubmit={handleVerifyOtp} className="space-y-3.5 animate-in fade-in duration-200">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center mb-1.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Akun Di-ACC! Cek Gmail Anda</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Masukkan 6-Digit Kode OTP yang dikirimkan ke:
                  </p>
                  <p className="text-xs font-mono font-bold text-blue-400 truncate max-w-full">
                    {regEmail}
                  </p>
                </div>

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
                      <span>Verifikasi OTP & Masuk</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setRegStep("form");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Kembali</span>
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
