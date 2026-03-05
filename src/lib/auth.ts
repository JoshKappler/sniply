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

export async function logout(): Promise<void> {
  localStorage.removeItem("sniply_current_user");
  localStorage.removeItem("sniply_role");
  localStorage.removeItem("sniply_onboarded");
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Session cookie may persist if network is unavailable, but local state is cleared
  }
}
