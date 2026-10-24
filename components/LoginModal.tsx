"use client";

import React, { useState, useEffect } from "react";
import {
  authenticateUser,
  getMasterUsersList,
  saveMasterUserAccount,
  deleteMasterUserAccount,
  MasterUserAccount,
} from "@/lib/firestoreService";
import { useRouter } from "next/navigation";
import {
  Package,
  AlertTriangle,
  QrCode,
  KeyRound,
  ArrowLeft,
  Users,
  UserPlus,
  Key,
  Send,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  Eye,
  EyeOff,
  LogOut,
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
  onLogout,
  currentUser,
  isDarkMode,
}: LoginModalProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [mode, setMode] = useState<"select" | "login" | "directory">("select");

  // Login form state (exact match with C:\consumable\src\components\login-form.tsx)
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // User Directory / Settings state (exact match with C:\consumable\src\components\settings-client-ui.tsx)
  const [users, setUsers] = useState<MasterUserAccount[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<MasterUserAccount | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<MasterUserAccount | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(true);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [dirAlert, setDirAlert] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [emailPendingMap, setEmailPendingMap] = useState<Record<string, boolean>>({});

  // Create/Edit User Form fields
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"super_admin" | "warehouse_manager" | "staff" | "viewer">("staff");

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDirAlert(null);
      if (currentUser) {
        setMode("directory");
        loadUsers();
      } else {
        setMode("select");
        setUsernameInput("");
        setPasswordInput("");
      }
    }
  }, [isOpen, currentUser]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const list = await getMasterUsersList();
      setUsers(list);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!usernameInput.trim() || !passwordInput) {
      setError(
        language === "id"
          ? "Username dan kata sandi wajib diisi."
          : "Username and password are required."
      );
      return;
    }

    setIsPending(true);
    try {
      const res = await authenticateUser(usernameInput.trim(), passwordInput);
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setError(
          res.message ||
            (language === "id"
              ? "Kredensial tidak valid atau akun tidak aktif."
              : "Invalid credentials or inactive account.")
        );
      }
    } catch {
      setError(
        language === "id"
          ? "Kredensial tidak valid atau akun tidak aktif."
          : "Invalid credentials or inactive account."
      );
    } finally {
      setIsPending(false);
    }
  };

  const isSuperAdmin =
    currentUser?.systemRole === "super_admin" ||
    currentUser?.systemRole === "warehouse_manager" ||
    currentUser?.name?.toLowerCase().includes("farhan") ||
    currentUser?.name?.toLowerCase().includes("eko") ||
    currentUser?.name?.toLowerCase().includes("admin") ||
    currentUser?.role === "admin";

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400";
      case "warehouse_manager":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400";
      case "staff":
        return "bg-sky-100 text-sky-800 dark:bg-sky-950/30 dark:text-sky-400";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getUserRoleTitle = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Vanguard Commander";
      case "warehouse_manager":
        return "Marshal";
      case "staff":
        return "Ranger";
      case "viewer":
        return "Scout";
      default:
        return role;
    }
  };

  const handleSendEmailInvitation = async (u: MasterUserAccount) => {
    setEmailPendingMap((prev) => ({ ...prev, [u.id]: true }));
    setDirAlert(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite",
          targetEmail: u.email,
          targetName: u.name,
          passwordHash: u.passwordHash.includes(":") ? "(Sesuai Kata Sandi Anda)" : u.passwordHash,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDirAlert({
          type: "success",
          text:
            language === "id"
              ? `Email aktivasi akses berhasil dikirim ke ${u.name} (${u.email})!`
              : `Access invitation email sent to ${u.name} (${u.email})!`,
        });
      } else {
        setDirAlert({
          type: "error",
          text: data.error || "Gagal mengirim email undangan.",
        });
      }
    } catch {
      setDirAlert({
        type: "error",
        text: "Gagal menghubungi server SMTP email.",
      });
    } finally {
      setEmailPendingMap((prev) => ({ ...prev, [u.id]: false }));
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirAlert(null);
    setIsPending(true);
    try {
      const res = await saveMasterUserAccount({
        id: editingUser?.id,
        name: formName,
        email: formEmail,
        password: formPassword || undefined,
        role: formRole,
        warehouseIds: "all",
      });
      if (res.success) {
        await loadUsers();
        setIsAddUserOpen(false);
        setEditingUser(null);
        setDirAlert({
          type: "success",
          text:
            language === "id"
              ? "Profil pengguna berhasil disimpan!"
              : "User profile saved successfully!",
        });
      } else {
        setDirAlert({ type: "error", text: res.error || "Gagal menyimpan pengguna." });
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || !newPasswordVal.trim()) return;
    setIsPending(true);
    setDirAlert(null);
    try {
      const res = await saveMasterUserAccount({
        id: selectedUserForPassword.id,
        name: selectedUserForPassword.name,
        email: selectedUserForPassword.email,
        password: newPasswordVal.trim(),
        role: selectedUserForPassword.role,
        warehouseIds: selectedUserForPassword.warehouseIds,
      });
      if (res.success) {
        await loadUsers();
        setSelectedUserForPassword(null);
        setNewPasswordVal("");
        setDirAlert({
          type: "success",
          text:
            language === "id"
              ? `Kata sandi untuk ${selectedUserForPassword.name} berhasil diperbarui!`
              : `Password for ${selectedUserForPassword.name} updated!`,
        });
      } else {
        setDirAlert({ type: "error", text: res.error || "Gagal mengubah kata sandi." });
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteUser = async (u: MasterUserAccount) => {
    if (u.name.toLowerCase() === currentUser?.name?.toLowerCase()) {
      setDirAlert({
        type: "error",
        text:
          language === "id"
            ? "Anda tidak dapat menghapus akun aktif Anda sendiri."
            : "You cannot delete your own active account.",
      });
      return;
    }
    const ok = window.confirm(
      language === "id"
        ? `Apakah Anda yakin ingin menghapus pengguna ${u.name} (${u.email})?`
        : `Are you sure you want to delete ${u.name} (${u.email})?`
    );
    if (!ok) return;

    setIsPending(true);
    try {
      const res = await deleteMasterUserAccount(u.email, u.name);
      if (res.success) {
        await loadUsers();
        setDirAlert({
          type: "success",
          text: language === "id" ? "Pengguna berhasil dihapus!" : "User deleted successfully!",
        });
      }
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`${isDarkMode ? "dark" : ""} fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto ${
        currentUser
          ? "bg-slate-950/80 backdrop-blur-sm"
          : "bg-slate-50 dark:bg-slate-950"
      }`}
    >
      {mode === "directory" && currentUser ? (
        /* ============================================================================
           MASTER AKUN PENGGUNA (EXACT REPLICA OF CONSUMABLE SETTINGS USER DIRECTORY)
           ============================================================================ */
        <div className="w-full max-w-4xl my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-violet-50 dark:bg-violet-950/30 text-violet-600 p-2.5 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {language === "id" ? "Master Akun Pengguna" : "Master User Accounts"}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>{language === "id" ? "Masuk sebagai:" : "Signed in as:"}</span>
                  <strong className="text-slate-800 dark:text-slate-200">{currentUser.name}</strong>
                  <span
                    className={`inline-flex text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${getRoleBadge(
                      currentUser.systemRole || (currentUser.role === "readonly" ? "viewer" : "super_admin")
                    )}`}
                  >
                    {getUserRoleTitle(
                      currentUser.systemRole || (currentUser.role === "readonly" ? "viewer" : "super_admin")
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setFormName("");
                    setFormEmail("");
                    setFormPassword("");
                    setFormRole("staff");
                    setEditingUser(null);
                    setIsAddUserOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 uppercase cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{language === "id" ? "Tambah Profil Pengguna" : "Add User Profile"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode("select");
                  setUsernameInput("");
                  setPasswordInput("");
                }}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Ganti Akun" : "Switch Account"}</span>
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{language === "id" ? "Keluar" : "Sign Out"}</span>
                </button>
              )}

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {dirAlert && (
            <div
              className={`px-4 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center justify-between gap-2 ${
                dirAlert.type === "error"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {dirAlert.type === "error" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{dirAlert.text}</span>
              </div>
              <button type="button" onClick={() => setDirAlert(null)} className="text-xs opacity-70 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {/* Add / Edit User Sub-Form */}
          {(isAddUserOpen || editingUser) && (
            <form
              onSubmit={handleSaveUser}
              className="mb-6 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  {editingUser
                    ? language === "id"
                      ? `Edit Akun: ${editingUser.name}`
                      : `Edit Account: ${editingUser.name}`
                    : language === "id"
                    ? "Tambah Profil Pengguna Baru"
                    : "Add New User Profile"}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddUserOpen(false);
                    setEditingUser(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    {language === "id" ? "Nama Lengkap *" : "Full Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-semibold focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    {language === "id" ? "Alamat Email *" : "Email Address *"}
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. staff@mhealth.tech"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-semibold focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    {editingUser
                      ? language === "id"
                        ? "Password Baru (Kosongkan jika tetap)"
                        : "New Password (Optional)"
                      : "Password *"}
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      required={!editingUser}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-2 text-xs font-semibold focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    {language === "id" ? "Peran Otorisasi *" : "Authorization Role *"}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 outline-none"
                  >
                    <option value="super_admin">Vanguard Commander (Super Admin)</option>
                    <option value="warehouse_manager">Marshal (Manager)</option>
                    <option value="staff">Ranger (Staff)</option>
                    <option value="viewer">Scout (Viewer)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddUserOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  {language === "id" ? "Batal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md"
                >
                  {isPending
                    ? language === "id"
                      ? "Menyimpan..."
                      : "Saving..."
                    : language === "id"
                    ? "Simpan Pengguna"
                    : "Save User"}
                </button>
              </div>
            </form>
          )}

          {/* Change Password Sub-Modal */}
          {selectedUserForPassword && (
            <form
              onSubmit={handleUpdatePassword}
              className="mb-6 p-5 rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/60 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-violet-700 dark:text-violet-300">
                  {language === "id"
                    ? `Ubah Kata Sandi: ${selectedUserForPassword.name} (${selectedUserForPassword.email})`
                    : `Change Password: ${selectedUserForPassword.name}`}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type={showChangePassword ? "text" : "password"}
                    required
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder={
                      language === "id" ? "Ketik kata sandi baru..." : "Enter new password..."
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-700 rounded-xl pl-4 pr-10 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(!showChangePassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showChangePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md shrink-0 cursor-pointer"
                >
                  {language === "id" ? "Simpan Kata Sandi" : "Update Password"}
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold tracking-wider sticky top-0 bg-white dark:bg-slate-900">
                  <th className="pb-3">{language === "id" ? "Nama Lengkap" : "Full Name"}</th>
                  <th className="pb-3">{language === "id" ? "Alamat Email" : "Email Address"}</th>
                  <th className="pb-3">{language === "id" ? "Peran Otorisasi" : "Role"}</th>
                  <th className="pb-3">{language === "id" ? "Kata Sandi" : "Password"}</th>
                  <th className="pb-3 text-center">{language === "id" ? "Aksi" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : (
                  (isSuperAdmin
                    ? users
                    : users.filter(
                        (u) => u.name.toLowerCase() === currentUser.name.toLowerCase()
                      )
                  ).map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {u.name}
                      </td>
                      <td className="py-3.5 text-slate-500 font-mono">{u.email}</td>
                      <td className="py-3.5">
                        <span
                          className={`inline-block text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {getUserRoleTitle(u.role)}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForPassword(u);
                            setNewPasswordVal(
                              u.passwordHash.includes(":") ? "" : u.passwordHash
                            );
                            setShowChangePassword(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-xs font-bold transition-all border border-violet-200 dark:border-violet-800/60 cursor-pointer"
                        >
                          <Key className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          <span>{language === "id" ? "Ubah Sandi" : "Change Password"}</span>
                        </button>
                      </td>
                      <td className="py-3.5 text-center">
                        <div className="inline-flex items-center gap-2">
                          {isSuperAdmin && (
                            <>
                              <button
                                type="button"
                                disabled={emailPendingMap[u.id]}
                                onClick={() => handleSendEmailInvitation(u)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
                                title={
                                  language === "id"
                                    ? "Kirim Email Akses"
                                    : "Send Access Email"
                                }
                              >
                                <Send
                                  className={`h-4 w-4 ${
                                    emailPendingMap[u.id] ? "animate-pulse text-emerald-500" : ""
                                  }`}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(u);
                                  setIsAddUserOpen(false);
                                  setFormName(u.name);
                                  setFormEmail(u.email);
                                  setFormPassword("");
                                  setFormRole(u.role);
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                                title={language === "id" ? "Edit Akun" : "Edit User"}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title={language === "id" ? "Hapus" : "Delete"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ============================================================================
           LOGIN SCREEN (EXACT REPLICA OF C:\consumable\src\components\login-form.tsx)
           ============================================================================ */
        <div className="w-full max-w-md p-4 animate-in fade-in duration-300 relative">
          {currentUser && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 right-2 p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Kembali"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Brand logo */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="bg-violet-600 p-3 rounded-2xl mb-3 shadow-lg shadow-violet-500/20">
              <Package className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
              Fantastic<span className="text-violet-600">Order</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {language === "id"
                ? "Sistem Manajemen Gudang & Pelacakan Faktur"
                : "Warehouse & Invoice Tracking Management System"}
            </p>
          </div>

          {mode === "select" ? (
            /* Welcome Mode Selector Card */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                  {language === "id" ? "Pilih Akses Masuk" : "Choose Entry Mode"}
                </h2>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[9px] font-black">
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                      language === "en"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("id")}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                      language === "id"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    ID
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Mode 1: Public Portal (Without Login) */}
                <button
                  type="button"
                  onClick={() => router.push("/komplain")}
                  className="w-full group flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white p-6 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <div className="bg-white/15 p-3.5 rounded-2xl group-hover:scale-110 transition-transform">
                    <QrCode className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-center">
                    <span className="block font-black text-sm uppercase tracking-wide">
                      {language === "id"
                        ? "Portal Retur & Komplain (Quick Access)"
                        : "Return & Complaint Portal (Quick Access)"}
                    </span>
                    <span className="block text-[10px] text-violet-200 mt-1">
                      {language === "id"
                        ? "Ajukan komplain / cek status tanpa login"
                        : "Submit return or check status without sign-in"}
                    </span>
                  </div>
                </button>

                {/* Mode 2: Management System Login */}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full flex items-center justify-between gap-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-800 px-5 py-4 rounded-xl transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-200 dark:bg-slate-700 p-2.5 rounded-xl text-slate-600 dark:text-slate-300">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-xs text-slate-800 dark:text-slate-200">
                        {language === "id"
                          ? "Sistem Manajemen (Login)"
                          : "Management System (Login)"}
                      </span>
                      <span className="block text-[9px] text-slate-400 mt-0.5">
                        {language === "id"
                          ? "Buka Dasbor & Master Faktur"
                          : "Access Dashboard & Invoice Tracker"}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* Login Card */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("select");
                      setError(null);
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title={language === "id" ? "Kembali" : "Back"}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {language === "id" ? "Masuk ke Dasbor" : "Sign In to Dashboard"}
                  </h2>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[9px] font-black">
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                      language === "en"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("id")}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                      language === "id"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    ID
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-4 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    {language === "id" ? "Username / Email" : "Username / Email"}
                  </label>
                  <input
                    type="text"
                    name="username"
                    required
                    placeholder="e.g. admin or admin@inventrack.com"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    {language === "id" ? "Kata Sandi" : "Password"}
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 text-xs uppercase cursor-pointer disabled:opacity-50"
                >
                  {isPending
                    ? language === "id"
                      ? "Memproses Masuk..."
                      : "Signing In..."
                    : language === "id"
                    ? "Masuk"
                    : "Sign In"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
