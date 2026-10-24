"use client";

import React, { useState } from "react";
import {
  StaffAccountProfile,
  updateStaffApprovalStatus,
  saveCloudOtp,
  isSuperAdminUser,
} from "@/lib/firestoreService";
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
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  const pendingProfiles = allProfiles.filter((p) => p.approvalStatus === "pending");
  const approvedProfiles = allProfiles.filter((p) => p.approvalStatus === "approved");

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden my-auto ${
          isDarkMode
            ? "bg-[#0b0c13] border-zinc-800 text-zinc-100"
            : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDarkMode ? "border-zinc-800 bg-[#0e0f17]" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight">
                Kelola & Persetujuan (ACC) Akun Staf
              </h3>
              <p className={`text-[11px] ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                Setujui pendaftaran akun baru untuk mengirimkan kode OTP ke Gmail staf
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

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
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
                {pendingProfiles.map((p) => (
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
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Approved Accounts */}
          <div className={`pt-4 border-t ${isDarkMode ? "border-zinc-800" : "border-zinc-200"}`}>
            <span
              className={`text-xs font-extrabold uppercase tracking-wider block mb-3 ${
                isDarkMode ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              Daftar Akun Disetujui ({approvedProfiles.length})
            </span>

            <div className="space-y-2">
              {approvedProfiles.map((p) => {
                const isSelf = isSuperAdminUser(p.username) || isSuperAdminUser(p.email);
                return (
                  <div
                    key={p.username}
                    className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      isDarkMode
                        ? "border-zinc-800 bg-zinc-900/60"
                        : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
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
                      <div className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                        {p.email}
                      </div>
                    </div>

                    {isSelf ? (
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                        Owner
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!p.verified && (
                          <button
                            type="button"
                            disabled={processingUser === p.username}
                            onClick={() => handleDecision(p, "approved")}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Kirim Ulang Kode OTP ke Gmail"
                          >
                            Kirim Ulang OTP
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
                          Cabut Akses
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
