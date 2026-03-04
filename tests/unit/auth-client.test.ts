// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCurrentUser, setCurrentUser, logout } from "@/lib/auth";
import type { User } from "@/lib/auth";

const MOCK_USER: User = {
  id: "u1",
  username: "alice",
  password: "",
  name: "Alice",
  role: "customer",
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("getCurrentUser", () => {
  it("returns null when localStorage is empty", () => {
    expect(getCurrentUser()).toBeNull();
  });

  it("returns the stored user after setCurrentUser", () => {
    setCurrentUser(MOCK_USER);
    const user = getCurrentUser();
    expect(user).not.toBeNull();
    expect(user!.id).toBe("u1");
    expect(user!.role).toBe("customer");
  });

  it("returns null when localStorage contains invalid JSON", () => {
    localStorage.setItem("sniply_current_user", "{not valid json");
    expect(getCurrentUser()).toBeNull();
  });
});

describe("setCurrentUser", () => {
  it("persists the full user object", () => {
    setCurrentUser(MOCK_USER);
    const raw = localStorage.getItem("sniply_current_user");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.id).toBe("u1");
    expect(parsed.username).toBe("alice");
  });
});

describe("logout", () => {
  it("removes user from localStorage", () => {
    setCurrentUser(MOCK_USER);
    localStorage.setItem("sniply_role", "customer");
    localStorage.setItem("sniply_onboarded", "true");

    // Mock fetch so the fire-and-forget API call doesn't fail in jsdom
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    logout();

    expect(localStorage.getItem("sniply_current_user")).toBeNull();
    expect(localStorage.getItem("sniply_role")).toBeNull();
    expect(localStorage.getItem("sniply_onboarded")).toBeNull();
  });
});
