"use client";

import React, { useState, useEffect } from "react";
import {
  StaffAccountProfile,
  StaffPermissions,
  updateStaffApprovalStatus,
  updateStaffPermissions,
  saveCloudOtp,
  isSuperAdminUser,
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
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [savingPermsUser, setSavingPermsUser] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  const pendingProfiles = allProfiles.filter((p) => p.approvalStatus === "pending");
  const approvedProfiles = allProfiles.filter((p) => p.approvalStatus === "approved");

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

            <div className="space-y-3">
              {approvedProfiles.map((p) => {
                const isSelf = isSuperAdminUser(p.username) || isSuperAdminUser(p.email);
                const isExpanded = expandedUser === p.username;
                const isSaving = savingPermsUser === p.username;
                const perms = p.permissions || {
                  can_edit_faktur: true,
                  can_edit_shipment_error: false,
                  can_edit_customers: false,
                  can_edit_products: false,
                  can_delete_data: false,
                };

                // Quick summary of what this user is allowed to do
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
                        <div className="text-[11px] font-mono text-zinc-400 truncate mt-0.5 flex items-center gap-2">
                          <span>{p.email}</span>
                          {!isSelf && allowedModules.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 font-sans">
                              Hak: {allowedModules.join(", ")}
                            </span>
                          )}
                          {!isSelf && allowedModules.length === 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-zinc-500/10 text-zinc-400 rounded border border-zinc-500/20 font-sans">
                              Read-Only (Hanya Lihat)
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
                      <div
                        className={`px-4 py-3 border-t text-xs space-y-3 animate-in fade-in duration-150 ${
                          isDarkMode
                            ? "border-zinc-800/80 bg-black/40"
                            : "border-zinc-200/80 bg-zinc-100/50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-extrabold text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            <span>Preset Cepat Hak Akses:</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                handleUpdateUserPermissions(p, {
                                  can_edit_faktur: true,
                                  can_edit_shipment_error: false,
                                  can_edit_customers: false,
                                  can_edit_products: false,
                                  can_delete_data: false,
                                })
                              }
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 cursor-pointer"
                              title="Hanya berikan akses ubah daftar faktur (Rendy preset)"
                            >
                              ⭐ Hanya Faktur (Rendy)
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                handleUpdateUserPermissions(p, {
                                  can_edit_faktur: true,
                                  can_edit_shipment_error: true,
                                  can_edit_customers: true,
                                  can_edit_products: true,
                                  can_delete_data: false,
                                })
                              }
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 cursor-pointer"
                            >
                              ⚡ Full Editor
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                handleUpdateUserPermissions(p, {
                                  can_edit_faktur: false,
                                  can_edit_shipment_error: false,
                                  can_edit_customers: false,
                                  can_edit_products: false,
                                  can_delete_data: false,
                                })
                              }
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/15 hover:bg-zinc-500/25 text-zinc-400 border border-zinc-500/30 cursor-pointer"
                            >
                              🔒 Read Only
                            </button>
                          </div>
                        </div>

                        {/* Checklist Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <label
                            className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                              perms.can_edit_faktur
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
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
                                <span>Daftar Faktur</span>
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                Ubah & tandai cetak faktur
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                              perms.can_edit_shipment_error
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
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
                                <span>Shipment Error</span>
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                Ubah tiket, status & catatan
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                              perms.can_edit_customers
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
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
                                <span>Master Pelanggan</span>
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                Ubah & perbarui data customer
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-colors ${
                              perms.can_edit_products
                                ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
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
      </div>
    </div>
  );
}
