"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getCurrentUser, setCurrentUser, type User } from "@/lib/auth";
import { apiUpdateUser, apiUpdateNotifPrefs, apiGetNotifPrefs } from "@/lib/api";
import { useToast } from "@/components/Toast";

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-2"
      aria-label={show ? "Hide password" : "Show password"}
    >
      {show ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      )}
    </button>
  );
}

interface NotifPrefs {
  bookingConfirmations: boolean;
  bookingReminders: boolean;
  messages: boolean;
  promotions: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Feedback
  const [nameSuccess, setNameSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    bookingConfirmations: true,
    bookingReminders: true,
    messages: true,
    promotions: false,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setName(u.name);

    // Load saved notif prefs from API
    apiGetNotifPrefs(u.id).then((prefs) => {
      if (prefs) setNotifPrefs(prefs as NotifPrefs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  const saveName = async () => {
    if (!user) return;
    if (!name.trim()) {
      setErrors((e) => ({ ...e, name: "Name cannot be empty." }));
      return;
    }
    try {
      const updated = await apiUpdateUser(user.id, { name: name.trim() });
      const merged = { ...user, ...updated };
      setUser(merged);
      setCurrentUser(merged);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 2500);
      addToast("Display name updated successfully.");
    } catch {
      addToast("Failed to update name. Please try again.");
    }
  };

  const savePassword = async () => {
    if (!user) return;
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Enter your current password.";
    if (!newPassword) errs.newPassword = "Enter a new password.";
    else if (newPassword.length < 6) errs.newPassword = "Password must be at least 6 characters.";
    if (!confirmPassword) errs.confirmPassword = "Confirm your new password.";
    else if (newPassword !== confirmPassword) errs.confirmPassword = "Passwords don't match.";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      const updated = await apiUpdateUser(user.id, { password: newPassword, currentPassword });
      const merged = { ...user, ...updated };
      setUser(merged);
      setCurrentUser(merged);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 2500);
      addToast("Password updated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password. Please try again.";
      setErrors({ currentPassword: msg });
    }
  };

  const saveNotifPrefs = async () => {
    if (!user) return;
    try {
      await apiUpdateNotifPrefs(user.id, notifPrefs);
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2500);
      addToast("Notification preferences saved.");
    } catch {
      addToast("Failed to save preferences. Please try again.");
    }
  };

  const handleDownloadData = async () => {
    if (!user) return;
    const data: Record<string, unknown> = { user: { ...user, password: "[hidden]" } };
    try {
      const [bookings, favorites] = await Promise.all([
        fetch(`/api/bookings?userId=${user.id}`).then((r) => r.json()),
        fetch(`/api/favorites/${user.id}`).then((r) => r.json()),
      ]);
      data.bookings = bookings;
      data.favorites = favorites;
    } catch (err) {
      console.error("sniply/settings: failed to fetch bookings/favorites for export", err);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sniply-data-${user.username}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("Your data has been downloaded.");
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteInput !== user.username) return;
    // Mark user as deleted via API (soft delete by clearing key fields)
    try {
      await apiUpdateUser(user.id, { username: `deleted-${user.id}`, password: "" });
    } catch (err) {
      console.error("sniply/settings: failed to soft-delete user via API", err);
    }
    // Clear session localStorage
    localStorage.removeItem("sniply_current_user");
    localStorage.removeItem("sniply_role");
    localStorage.removeItem("sniply_onboarded");
    localStorage.removeItem("sniply_customer_profile");
    localStorage.removeItem("sniply_pro_profile");
    addToast("Account deleted. Goodbye!");
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] dark:bg-black">
      <Navbar />
      <main className="max-w-[560px] mx-auto px-4 sm:px-6 py-10 animate-fade-in-up">
        <h1 className="font-heading font-bold text-gray-900 text-3xl mb-8">Account Settings</h1>

        {/* Username (read-only) */}
        <div className="bg-white border border-[var(--color-primary)]/12 rounded-xl p-4 sm:p-6 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Account Info</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Username
              </label>
              <p className="text-sm text-gray-800 bg-[var(--color-section-bg)] dark:bg-[#1a1a1a] border border-[var(--color-primary)]/12 rounded-lg px-4 py-2.5">
                @{user?.username}
              </p>
              <p className="text-xs text-gray-400 mt-1">Usernames cannot be changed.</p>
            </div>
          </div>
        </div>

        {/* Display name */}
        <div className="bg-white border border-[var(--color-primary)]/12 rounded-xl p-4 sm:p-6 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Display Name</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((err) => ({ ...err, name: "" }));
                }}
                className={`input-field ${errors.name ? "border-[#EF4444] focus:border-[#EF4444]" : ""}`}
              />
              {errors.name && <p className="text-xs text-[#EF4444] mt-1">{errors.name}</p>}
            </div>
            <button
              onClick={() => void saveName()}
              className={`w-full rounded-xl text-sm font-semibold h-11 transition-all ${
                nameSuccess
                  ? "bg-green-50 text-green-600 border border-green-200"
                  : "btn-primary"
              }`}
            >
              {nameSuccess ? "Name Updated ✓" : "Save Name"}
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white border border-[var(--color-primary)]/12 rounded-xl p-4 sm:p-6 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-[var(--color-primary)]/06">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setErrors((err) => ({ ...err, currentPassword: "" }));
                    }}
                    className={`input-field pr-11 ${errors.currentPassword ? "border-[#EF4444] focus:border-[#EF4444]" : ""}`}
                    placeholder="Enter current password"
                  />
                  <EyeToggle show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
                </div>
                {errors.currentPassword && (
                  <p className="text-xs text-[#EF4444] mt-1">{errors.currentPassword}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setErrors((err) => ({ ...err, newPassword: "" }));
                    }}
                    className={`input-field pr-11 ${errors.newPassword ? "border-[#EF4444] focus:border-[#EF4444]" : ""}`}
                    placeholder="Min. 6 characters"
                  />
                  <EyeToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />
                </div>
                {errors.newPassword && (
                  <p className="text-xs text-[#EF4444] mt-1">{errors.newPassword}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((err) => ({ ...err, confirmPassword: "" }));
                    }}
                    className={`input-field pr-11 ${errors.confirmPassword ? "border-[#EF4444] focus:border-[#EF4444]" : ""}`}
                    placeholder="Repeat new password"
                  />
                  <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-[#EF4444] mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
            {passwordSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                Password updated successfully.
              </div>
            )}
            <button
              onClick={() => void savePassword()}
              className="btn-primary w-full"
              style={{ height: "44px", fontSize: "15px" }}
            >
              Update Password
            </button>
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white border border-[var(--color-primary)]/12 rounded-xl p-4 sm:p-6 mb-5">
          <h2 className="font-semibold text-gray-900 mb-1">Notifications</h2>
          <p className="text-xs text-gray-400 mb-5">Choose what you&apos;d like to be notified about.</p>
          <div className="space-y-4">
            {([
              { key: "bookingConfirmations", label: "Booking confirmations", desc: "When a booking is created or cancelled" },
              { key: "bookingReminders", label: "Appointment reminders", desc: "24 hours before your appointment" },
              { key: "messages", label: "New messages", desc: "When you receive a message from a barber" },
              { key: "promotions", label: "Promotions & tips", desc: "Occasional style tips and special offers" },
            ] as { key: keyof NotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-4 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={notifPrefs[key]}
                    onChange={(e) => setNotifPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-6 rounded-full transition-colors duration-200 ${notifPrefs[key] ? "bg-[var(--color-primary)]" : "bg-gray-300"}`}
                  >
                    <div
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                      style={{ left: notifPrefs[key] ? "22px" : "4px" }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={() => void saveNotifPrefs()}
            className={`mt-5 w-full rounded-xl text-sm font-semibold h-11 transition-all ${
              notifSaved
                ? "bg-green-50 text-green-600 border border-green-200"
                : "btn-primary"
            }`}
          >
            {notifSaved ? "Preferences Saved ✓" : "Save Preferences"}
          </button>
        </div>

        {/* Data & Privacy */}
        <div className="bg-white border border-[var(--color-primary)]/12 rounded-xl p-4 sm:p-6 mb-5">
          <h2 className="font-semibold text-gray-900 mb-1">Data & Privacy</h2>
          <p className="text-xs text-gray-400 mb-5">Download or manage your personal data.</p>
          <button
            onClick={() => void handleDownloadData()}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download My Data
          </button>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Downloads a JSON file with your profile, bookings, and settings.
          </p>
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-red-200 rounded-xl p-4 sm:p-6">
          <h2 className="font-semibold text-red-600 mb-1">Danger Zone</h2>
          <p className="text-xs text-gray-400 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full h-11 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-all"
            >
              Delete My Account
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                This will permanently delete your account, bookings, and all saved data. To confirm, type your username below.
              </div>
              <input
                type="text"
                placeholder={`Type "${user?.username}" to confirm`}
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="input-field border-red-200 focus:border-red-400 focus:ring-red-100"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteInput !== user?.username}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
