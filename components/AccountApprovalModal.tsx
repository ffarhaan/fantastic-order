"use client";

import React, { useState, useEffect } from "react";
import {
  StaffAccountProfile,
  StaffPermissions,
  updateStaffApprovalStatus,
  updateStaffPermissions,
  saveCloudOtp,
  isSuperAdminUser,
  subscribeToUserCredentials,
  adminSetUserPassword,
} from "@/lib/firestoreService";
import { recordActivityLog } from "@/lib/activityLogger";
import {
  ShieldCheck,
  Clock,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Mail,
  Sliders,
  ChevronDown,
  ChevronUp,
  FileText,
  Truck,
  Users,
  Package,
  Trash2,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  Lock,
  Edit3,
  User,
  Shield,
} from "lucide-react";

interface AccountApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProfiles: StaffAccountProfile[];
  isDarkMode: boolean;
}

export default function AccountApprovalModal({
  isOpen,
  onClose,
  allProfiles,
  isDarkMode,
}: AccountApprovalModalProps) {
  const [activeTab, setActiveTab] = useState<"passwords" | "permissions">("passwords");
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [savingPermsUser, setSavingPermsUser] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Real-time credentials state (username/displayName -> password)
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edit password modal state
  const [editingUser, setEditingUser] = useState<StaffAccountProfile | null>(null);
  const [editingNewPass, setEditingNewPass] = useState("");
  const [isSavingPass, setIsSavingPass] = useState(false);

  // Subscribe to cloud user_credentials in real-time
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToUserCredentials((creds) => {
      setCredentials(creds);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const pendingProfiles = allProfiles.filter((p) => p.approvalStatus === "pending");
  const approvedProfiles = allProfiles.filter((p) => p.approvalStatus === "approved");

  // Helper to extract password for any user
  const getPasswordForUser = (username: string, displayName?: string) => {
    const cleanU = (username || "").toLowerCase().trim();
    const cleanD = (displayName || "").toLowerCase().trim();
    for (const [k, v] of Object.entries(credentials)) {
      const cleanK = k.toLowerCase().trim();
      if (cleanK === cleanU || (cleanD && cleanK === cleanD)) {
        return String(v);
      }
    }
    return "123";
  };

  const handleCopy = (text: string, keyId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePasswordVisibility = (username: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [username]: !prev[username],
    }));
  };

  const handleSaveEditedPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingNewPass || editingNewPass.trim().length < 3) {
      setErrorMessage("Password baru minimal 3 karakter.");
      return;
    }

    setIsSavingPass(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await adminSetUserPassword(
        editingUser.username,
        editingNewPass.trim(),
        editingUser.displayName
      );

      if (res.success) {
        setSuccessMessage(res.message);
        await recordActivityLog({
          action_type: "UPDATE_PERMISSIONS",
          module: "SETTINGS",
          target_id: editingUser.username,
          details: `Farhan (Owner) mengubah password untuk akun @${editingUser.username} (${editingUser.displayName})`,
          metadata: { username: editingUser.username },
        });
        setEditingUser(null);
        setEditingNewPass("");
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage("Gagal menyimpan password baru.");
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleUpdateUserPermissions = async (
    targetUser: StaffAccountProfile,
    newPerms: StaffPermissions
  ) => {
    setSavingPermsUser(targetUser.username);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await updateStaffPermissions(targetUser.username, newPerms);
      if (res.success) {
        setSuccessMessage(`Hak akses @${targetUser.username} (${targetUser.displayName}) berhasil diperbarui!`);
        await recordActivityLog({
          action_type: "UPDATE_PERMISSIONS",
          module: "SETTINGS",
          target_id: targetUser.username,
          details: `Mengubah hak akses staf @${targetUser.username} (${targetUser.displayName})`,
          metadata: { permissions: newPerms },
        });
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage("Gagal memperbarui hak akses pengguna.");
    } finally {
      setSavingPermsUser(null);
    }
  };

  const handleDecision = async (
    prof: StaffAccountProfile,
    decision: "approved" | "rejected"
  ) => {
    setProcessingUser(prof.username);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (decision === "approved") {
        // 1. Generate & Send 6-digit OTP to user's Gmail via SMTP
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

        // 2. Persist OTP to Firestore so user can verify it from their device
        if (otpData.cloudOtpCode) {
          await saveCloudOtp(prof.email, otpData.cloudOtpCode);
        }

        // 3. Set status to approved in Firestore
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

  // Build unified list of all accounts for the Passwords tab
  const allAccountsMap = new Map<string, {
    username: string;
    displayName: string;
    email: string;
    approvalStatus: "approved" | "pending" | "rejected";
    verified?: boolean;
    role: string;
    profile?: StaffAccountProfile;
  }>();

  allProfiles.forEach((p) => {
    allAccountsMap.set(p.username.toLowerCase(), {
      username: p.username,
      displayName: p.displayName,
      email: p.email,
      approvalStatus: p.approvalStatus,
      verified: p.verified,
      role: p.role,
      profile: p,
    });
  });

  // Filter accounts by search query
  const filteredAccounts = Array.from(allAccountsMap.values()).filter((acc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      acc.username.toLowerCase().includes(q) ||
      acc.displayName.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div
        className={`relative w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh] ${
          isDarkMode
            ? "bg-[#0b0c13] border-zinc-800 text-zinc-100 shadow-black/90"
            : "bg-white border-zinc-200 text-zinc-900 shadow-2xl"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b shrink-0 flex items-center justify-between ${
            isDarkMode ? "border-zinc-800 bg-[#0e0f17]" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight">
                  Kelola Akun, Password &amp; Akses Tim
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold border border-amber-500/30">
                  Super Admin (Farhan)
                </span>
              </div>
              <p className={`text-[11px] ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                Lihat semua username dan password staf, atur izin modul, atau setujui pendaftaran baru
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
              isDarkMode
                ? "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700"
            }`}
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`px-6 pt-3 border-b shrink-0 flex items-center gap-2 ${
          isDarkMode ? "border-zinc-800/80 bg-zinc-950/40" : "border-zinc-200 bg-zinc-100/50"
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab("passwords")}
            className={`pb-2.5 px-3.5 text-xs font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "passwords"
                ? "border-amber-500 text-amber-400"
                : isDarkMode
                ? "border-transparent text-zinc-400 hover:text-zinc-200"
                : "border-transparent text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Rekap Semua Akun &amp; Password</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {allAccountsMap.size}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("permissions")}
            className={`pb-2.5 px-3.5 text-xs font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "permissions"
                ? "border-blue-500 text-blue-400"
                : isDarkMode
                ? "border-transparent text-zinc-400 hover:text-zinc-200"
                : "border-transparent text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Persetujuan &amp; Hak Akses</span>
            {pendingProfiles.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-black animate-pulse">
                {pendingProfiles.length} Baru
              </span>
            )}
          </button>
        </div>

        {/* Body Container */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

          {/* ========================================================= */}
          {/* TAB 1: REKAP SEMUA AKUN & PASSWORD (KHUSUS FARHAN)        */}
          {/* ========================================================= */}
          {activeTab === "passwords" && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Cari nama, username, atau email staf..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition ${
                      isDarkMode
                        ? "bg-zinc-900/80 border-zinc-800 focus:border-amber-500 text-zinc-200 placeholder:text-zinc-500"
                        : "bg-white border-zinc-200 focus:border-amber-500 text-zinc-800 placeholder:text-zinc-400"
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllPasswords(!showAllPasswords)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                    showAllPasswords
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                      : isDarkMode
                      ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                      : "bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300 shadow-xs"
                  }`}
                >
                  {showAllPasswords ? (
                    <>
                      <EyeOff className="w-4 h-4 text-amber-400" />
                      <span>Sembunyikan Semua</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 text-amber-400" />
                      <span>Tampilkan Semua Password</span>
                    </>
                  )}
                </button>
              </div>

              {/* Accounts Card List */}
              <div className="space-y-2.5">
                {filteredAccounts.length === 0 ? (
                  <div
                    className={`p-8 rounded-2xl border text-center text-xs ${
                      isDarkMode
                        ? "border-zinc-800/80 bg-zinc-900/40 text-zinc-500"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500"
                    }`}
                  >
                    Tidak ada akun yang cocok dengan pencarian &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  filteredAccounts.map((acc) => {
                    const pass = getPasswordForUser(acc.username, acc.displayName);
                    const isVisible = showAllPasswords || Boolean(visiblePasswords[acc.username]);
                    const isSelf = isSuperAdminUser(acc.username) || isSuperAdminUser(acc.email);

                    return (
                      <div
                        key={acc.username}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isSelf
                            ? isDarkMode
                              ? "bg-amber-500/5 border-amber-500/30"
                              : "bg-amber-50/60 border-amber-300"
                            : isDarkMode
                            ? "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                            : "bg-zinc-50/80 border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* User info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelf
                                ? "bg-amber-500 text-black shadow-sm"
                                : "bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm"
                            }`}>
                              {acc.displayName.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black truncate">{acc.displayName}</span>
                                {isSelf && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    Owner
                                  </span>
                                )}
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                  acc.approvalStatus === "approved"
                                    ? acc.verified === false
                                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                }`}>
                                  {acc.approvalStatus === "approved"
                                    ? acc.verified === false ? "Tunggu OTP" : "Aktif"
                                    : "Menunggu ACC"}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-0.5 truncate font-mono">
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-400 font-bold">@{acc.username}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(acc.username, `u-${acc.username}`)}
                                    className="p-0.5 rounded hover:bg-zinc-700/40 text-zinc-500 hover:text-white transition cursor-pointer"
                                    title="Salin username"
                                  >
                                    {copiedKey === `u-${acc.username}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>

                                {acc.email && (
                                  <span className="truncate text-zinc-500">
                                    {acc.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Password & Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {/* Password Box */}
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
                              isDarkMode ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
                            }`}>
                              <KeyRound className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="text-xs font-mono font-black tracking-wider text-indigo-400 min-w-[70px] select-all">
                                {isVisible ? pass : "••••••••"}
                              </span>

                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(acc.username)}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                                title={isVisible ? "Sembunyikan password" : "Lihat password"}
                              >
                                {isVisible ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopy(pass, `p-${acc.username}`)}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                                title="Salin password"
                              >
                                {copiedKey === `p-${acc.username}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Edit Password Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(acc.profile || {
                                  username: acc.username,
                                  displayName: acc.displayName,
                                  email: acc.email,
                                  approvalStatus: acc.approvalStatus,
                                  role: "admin",
                                  verified: true,
                                  updatedAt: new Date().toISOString(),
                                });
                                setEditingNewPass("");
                              }}
                              className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                                isDarkMode
                                  ? "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700"
                                  : "bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300 shadow-xs"
                              }`}
                              title="Ubah password akun ini"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: PERSETUJUAN & HAK AKSES MODUL                      */}
          {/* ========================================================= */}
          {activeTab === "permissions" && (
            <div className="space-y-6">
              {/* Section 1: Pending Approvals */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Menunggu ACC & Kirim OTP ({pendingProfiles.length})</span>
                  </span>
                </div>

                {pendingProfiles.length === 0 ? (
                  <div
                    className={`p-5 rounded-2xl border text-center text-xs ${
                      isDarkMode
                        ? "border-zinc-800/80 bg-zinc-900/40 text-zinc-500"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500"
                    }`}
                  >
                    Tidak ada permintaan pendaftaran akun baru yang menunggu ACC saat ini.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingProfiles.map((p) => {
                      const pass = getPasswordForUser(p.username, p.displayName);
                      return (
                        <div
                          key={p.username}
                          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isDarkMode
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-amber-300 bg-amber-50/60"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold flex items-center gap-2">
                              <span>{p.displayName}</span>
                              <span className="text-[11px] font-mono text-amber-400">
                                @{p.username}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-blue-400 flex items-center gap-1.5 mt-0.5 truncate">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{p.email}</span>
                            </div>
                            <div className="text-[11px] font-mono text-zinc-400 mt-1 flex items-center gap-1.5">
                              <KeyRound className="w-3 h-3 text-indigo-400" />
                              <span>Password Didaftarkan: </span>
                              <strong className="text-indigo-400 font-bold">{pass}</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={processingUser === p.username}
                              onClick={() => handleDecision(p, "approved")}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                            >
                              {processingUser === p.username ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                              <span>ACC & Kirim OTP</span>
                            </button>

                            <button
                              type="button"
                              disabled={processingUser === p.username}
                              onClick={() => handleDecision(p, "rejected")}
                              className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Approved Accounts & Permissions */}
              <div className={`pt-4 border-t ${isDarkMode ? "border-zinc-800" : "border-zinc-200"}`}>
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider block mb-3 ${
                    isDarkMode ? "text-zinc-400" : "text-zinc-600"
                  }`}
                >
                  Daftar Akun Disetujui ({approvedProfiles.length})
                </span>

                <div className="space-y-3">
                  {approvedProfiles.map((p) => {
                    const isSelf = isSuperAdminUser(p.username) || isSuperAdminUser(p.email);
                    const isExpanded = expandedUser === p.username;
                    const isSaving = savingPermsUser === p.username;
                    const pass = getPasswordForUser(p.username, p.displayName);
                    const perms = p.permissions || {
                      can_edit_faktur: true,
                      can_edit_shipment_error: false,
                      can_edit_customers: false,
                      can_edit_products: false,
                      can_delete_data: false,
                    };

                    const allowedModules: string[] = [];
                    if (perms.can_edit_faktur) allowedModules.push("Faktur");
                    if (perms.can_edit_shipment_error) allowedModules.push("Shipment");
                    if (perms.can_edit_customers) allowedModules.push("Customer");
                    if (perms.can_edit_products) allowedModules.push("Produk");
                    if (perms.can_delete_data) allowedModules.push("Hapus");

                    return (
                      <div
                        key={p.username}
                        className={`rounded-2xl border transition-all ${
                          isDarkMode
                            ? "border-zinc-800 bg-zinc-900/60"
                            : "border-zinc-200 bg-zinc-50"
                        }`}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold flex items-center gap-2 truncate">
                              <span>{p.displayName}</span>
                              <span className="text-[11px] font-mono text-zinc-500">
                                (@{p.username})
                              </span>
                              {!isSelf && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                    p.verified
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                  }`}
                                >
                                  {p.verified ? "Aktif" : "Tunggu Input OTP"}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] font-mono text-zinc-400 truncate mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{p.email}</span>
                              <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                                Pwd: {pass}
                              </span>
                              {!isSelf && allowedModules.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 font-sans">
                                  Hak: {allowedModules.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>

                          {isSelf ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Owner (Super Admin)</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setExpandedUser(isExpanded ? null : p.username)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                                  isExpanded
                                    ? "bg-blue-600 text-white border-blue-500"
                                    : isDarkMode
                                    ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                                    : "bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300"
                                }`}
                                title="Atur Hak Akses Pengguna"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>Atur Hak Akses</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>

                              {!p.verified && (
                                <button
                                  type="button"
                                  disabled={processingUser === p.username}
                                  onClick={() => handleDecision(p, "approved")}
                                  className="px-2 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                                  title="Kirim Ulang Kode OTP ke Gmail"
                                >
                                  Kirim OTP
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={processingUser === p.username}
                                onClick={() => handleDecision(p, "rejected")}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                                  isDarkMode
                                    ? "bg-zinc-800 hover:bg-rose-600 text-zinc-400 hover:text-white"
                                    : "bg-zinc-200 hover:bg-rose-600 text-zinc-700 hover:text-white"
                                }`}
                                title="Nonaktifkan / Cabut Akses Akun"
                              >
                                Cabut
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expandable Permissions Editor */}
                        {!isSelf && isExpanded && (
                          <div className={`p-4 border-t space-y-3 ${
                            isDarkMode ? "border-zinc-800/80 bg-zinc-950/40" : "border-zinc-200 bg-white"
                          }`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <label
                                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                                  perms.can_edit_faktur
                                    ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                                    : isDarkMode
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-400"
                                    : "bg-white border-zinc-200 text-zinc-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={perms.can_edit_faktur}
                                  disabled={isSaving}
                                  onChange={(e) =>
                                    handleUpdateUserPermissions(p, {
                                      ...perms,
                                      can_edit_faktur: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-[11px] flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                    <span>Modul Faktur Tracker</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    Upload file &amp; tanda selesai cetak
                                  </div>
                                </div>
                              </label>

                              <label
                                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                                  perms.can_edit_shipment_error
                                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                    : isDarkMode
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-400"
                                    : "bg-white border-zinc-200 text-zinc-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={perms.can_edit_shipment_error}
                                  disabled={isSaving}
                                  onChange={(e) =>
                                    handleUpdateUserPermissions(p, {
                                      ...perms,
                                      can_edit_shipment_error: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-[11px] flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Shipment Error (Komplain)</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    Edit status tiket &amp; investigasi
                                  </div>
                                </div>
                              </label>

                              <label
                                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                                  perms.can_edit_customers
                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                    : isDarkMode
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-400"
                                    : "bg-white border-zinc-200 text-zinc-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={perms.can_edit_customers}
                                  disabled={isSaving}
                                  onChange={(e) =>
                                    handleUpdateUserPermissions(p, {
                                      ...perms,
                                      can_edit_customers: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-[11px] flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>Master Customer</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    Ubah data apotek / pelanggan
                                  </div>
                                </div>
                              </label>

                              <label
                                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                                  perms.can_edit_products
                                    ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                                    : isDarkMode
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-400"
                                    : "bg-white border-zinc-200 text-zinc-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={perms.can_edit_products}
                                  disabled={isSaving}
                                  onChange={(e) =>
                                    handleUpdateUserPermissions(p, {
                                      ...perms,
                                      can_edit_products: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-[11px] flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    <span>Master Produk</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    Ubah master data produk
                                  </div>
                                </div>
                              </label>

                              <label
                                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors sm:col-span-2 ${
                                  perms.can_delete_data
                                    ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                                    : isDarkMode
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-400"
                                    : "bg-white border-zinc-200 text-zinc-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={perms.can_delete_data}
                                  disabled={isSaving}
                                  onChange={(e) =>
                                    handleUpdateUserPermissions(p, {
                                      ...perms,
                                      can_delete_data: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 rounded text-rose-600 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-[11px] flex items-center gap-1.5 text-rose-400">
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Izin Hapus Data (Delete Records)</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    Mengizinkan penghapusan tiket return atau data master
                                  </div>
                                </div>
                              </label>
                            </div>

                            {isSaving && (
                              <div className="flex items-center gap-2 text-[11px] text-blue-400 font-bold">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyimpan perubahan hak akses...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Quick Edit Password (Inline dialog for Farhan) */}
        {editingUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div
              className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${
                isDarkMode
                  ? "bg-[#0f111a] border-zinc-700 text-zinc-100"
                  : "bg-white border-zinc-300 text-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-700/50">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black">
                    Ubah Password: <span className="text-amber-400">@{editingUser.username}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditedPassword} className="space-y-3">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Sebagai Owner / Super Admin, Anda dapat langsung mengatur password baru untuk staf <strong>{editingUser.displayName}</strong>.
                </p>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-zinc-400">
                    Password Baru
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan password baru..."
                    value={editingNewPass}
                    onChange={(e) => setEditingNewPass(e.target.value)}
                    autoFocus
                    className={`w-full px-3 py-2 text-xs font-mono rounded-xl border outline-none ${
                      isDarkMode
                        ? "bg-zinc-950 border-zinc-800 focus:border-amber-500 text-zinc-200"
                        : "bg-white border-zinc-300 focus:border-amber-500 text-zinc-800"
                    }`}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPass || !editingNewPass.trim()}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingPass ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Password</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
