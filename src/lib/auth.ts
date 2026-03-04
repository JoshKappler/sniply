import type { User } from "@/lib/types";
export type { User };

// ── Session (localStorage only) ───────────────────────────────────────────────

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sniply_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User): void {
  try {
    localStorage.setItem("sniply_current_user", JSON.stringify(user));
  } catch {
    try {
      const { avatar: _a, ...slim } = user;
      localStorage.setItem("sniply_current_user", JSON.stringify(slim));
    } catch (err) {
      console.error("sniply/auth: failed to persist user session to localStorage", err);
    }
  }
}

export function logout(): void {
  localStorage.removeItem("sniply_current_user");
  localStorage.removeItem("sniply_role");
  localStorage.removeItem("sniply_onboarded");
  // Clear the server-side session cookie (fire-and-forget)
  fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}
