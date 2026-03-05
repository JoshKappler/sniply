"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUser, logout, type User } from "@/lib/auth";
import { apiGetThreads, apiGetCustomerThreads } from "@/lib/api";

interface NavbarProps {
  variant?: "default" | "minimal" | "logged-in";
  showBack?: boolean;
  onBack?: () => void;
}

function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="4.5" cy="7" r="2.5" />
      <circle cx="4.5" cy="17" r="2.5" />
      <line x1="6.5" y1="8.5" x2="11.5" y2="12" />
      <line x1="11.5" y1="12" x2="22" y2="5.5" />
      <line x1="6.5" y1="15.5" x2="11.5" y2="12" />
      <line x1="11.5" y1="12" x2="22" y2="18.5" />
      <circle cx="11.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export default function Navbar({ variant = "default", showBack = false, onBack }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [customerUnreadCount, setCustomerUnreadCount] = useState(0);

  useEffect(() => {
    const checkUser = () => {
      const u = getCurrentUser();
      setUser(u);
      if (u?.role === "pro") {
        const pid = u.profileId ?? u.id;
        apiGetThreads(pid).then((threads) => {
          setUnreadCount(threads.filter((t) => t.unread).length);
        }).catch(() => setUnreadCount(0));
        setCustomerUnreadCount(0);
      } else if (u?.role === "customer") {
        setUnreadCount(0);
        apiGetCustomerThreads(u.id).then((refs) => {
          setCustomerUnreadCount(refs.filter((r) => r.unread).length);
        }).catch(() => setCustomerUnreadCount(0));
      } else {
        setUnreadCount(0);
        setCustomerUnreadCount(0);
      }
    };

    checkUser();
    const interval = setInterval(checkUser, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("sniply_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("sniply_theme", "light");
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setMenuOpen(false);
    setMobileDrawerOpen(false);
    router.push("/");
  };

  const isLoggedIn = !!user;
  const initials = user?.name
    ? user.name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
    : "?";

  const proMenuItems = [
    { label: "Account Settings", href: "/settings" },
  ];

  const customerMenuItems = [
    { label: "Messages", href: "/messages" },
    { label: "My Profile", href: "/customer/profile" },
    { label: "My Bookings", href: "/bookings" },
    { label: "Saved Pros", href: "/saved" },
    { label: "Edit Profile", href: "/customer/profile-setup" },
    { label: "Account Settings", href: "/settings" },
  ];

  const menuItems = user?.role === "pro" ? proMenuItems : customerMenuItems;

  // Mobile nav links (shown in drawer)
  const mobileNavLinks = isLoggedIn
    ? user?.role === "pro"
      ? [
          { label: "Browse Pros", href: "/browse", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
          { label: "Pro Dashboard", href: "/pro/dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
          { label: "Account Settings", href: "/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        ]
      : [
          { label: "Browse Pros", href: "/browse", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
          { label: "Messages", href: "/messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
          { label: "My Bookings", href: "/bookings", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
          { label: "Saved Pros", href: "/saved", icon: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" },
          { label: "Account Settings", href: "/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        ]
    : [
        { label: "Browse Pros", href: "/browse", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
        { label: "Log In", href: "/login", icon: "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" },
        { label: "Sign Up", href: "/signup/role-selection", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
      ];

  return (
    <>
      <nav
        className="sticky top-0 z-50 transition-colors"
        style={{
          background: isDark ? "rgba(10,10,10,0.93)" : "rgba(214,228,247,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: isDark ? "1px solid rgba(42,42,42,0.7)" : "1px solid rgba(var(--color-primary-rgb),0.14)",
          boxShadow: isDark
            ? "0 1px 0 rgba(255,255,255,0.03)"
            : "0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
          height: "68px",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
          {/* Left: back button + logo + browse link */}
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium mr-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}

            <Link href="/" className="flex items-center gap-2 group">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)" }}
              >
                <ScissorsIcon className="w-4 h-4 text-white" />
              </div>
              <span
                className="font-heading font-bold text-xl"
                style={{
                  background: "linear-gradient(135deg, #1E3573 0%, var(--color-primary) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Sniply
              </span>
            </Link>

            {variant !== "minimal" && (
              <>
                {pathname !== "/browse" && (
                  <Link
                    href="/browse"
                    className="hidden md:flex items-center text-sm font-medium ml-5 px-3 py-1.5 rounded-lg nav-link"
                  >
                    Browse Pros
                  </Link>
                )}
                {user?.role === "customer" && pathname !== "/messages" && (
                  <Link
                    href="/messages"
                    className="hidden md:flex items-center gap-1.5 text-sm font-medium ml-1 px-3 py-1.5 rounded-lg relative nav-link"
                  >
                    Messages
                    {customerUnreadCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    )}
                  </Link>
                )}
                {user?.role === "pro" && (
                  <Link
                    href="/pro/dashboard"
                    className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold ml-2 px-4 py-1.5 rounded-lg transition-all"
                    style={{
                      background: pathname === "/pro/dashboard"
                        ? "var(--color-primary)"
                        : "rgba(var(--color-primary-rgb),0.10)",
                      color: pathname === "/pro/dashboard" ? "#fff" : "var(--color-primary)",
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Dashboard
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Right: auth controls */}
          {variant !== "minimal" && (
            <div className="flex items-center gap-2">
              {/* Dark mode toggle */}
              <button
                onClick={toggleDark}
                className="w-10 h-10 flex items-center justify-center rounded-full nav-icon-btn"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>

              {/* Mobile hamburger — shown on small screens */}
              <button
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-full transition-all"
                style={{ color: isDark ? "#a3a3a3" : "#6B7280" }}
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open menu"
              >
                {isLoggedIn && (unreadCount > 0 || customerUnreadCount > 0) ? (
                  <div className="relative">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
                  </div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              {/* Desktop: auth controls */}
              {isLoggedIn ? (
                <div className="relative ml-1 hidden md:block">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 group"
                    aria-label="Profile menu"
                  >
                    <div className="relative">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-9 h-9 rounded-full object-cover transition-all"
                          style={{
                            border: "2px solid rgba(var(--color-primary-rgb),0.2)",
                            boxShadow: "0 0 0 0 rgba(var(--color-primary-rgb),0)",
                          }}
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full text-white font-semibold flex items-center justify-center text-sm transition-all"
                          style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)" }}
                        >
                          {initials}
                        </div>
                      )}
                      {(unreadCount > 0 || customerUnreadCount > 0) && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
                      )}
                    </div>
                    <span className="hidden sm:block text-sm font-medium" style={{ color: isDark ? "#d4d4d4" : "#374151" }}>
                      {user?.name?.split(" ")[0]}
                    </span>
                    <svg className="w-3.5 h-3.5" style={{ color: isDark ? "#5a5a5a" : "#9CA3AF" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div
                        className="absolute right-0 top-12 w-56 rounded-2xl z-50 py-1.5 overflow-hidden animate-dropdown"
                        style={{
                          background: isDark ? "#111111" : "#ffffff",
                          border: isDark ? "1px solid #2a2a2a" : "1px solid rgba(0,0,0,0.08)",
                          boxShadow: isDark
                            ? "0 20px 40px rgba(0,0,0,0.6)"
                            : "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.10)",
                        }}
                      >
                        <div className="px-4 py-3" style={{ borderBottom: isDark ? "1px solid #1e1e1e" : "1px solid rgba(var(--color-primary-rgb),0.07)" }}>
                          <p className="text-sm font-semibold" style={{ color: isDark ? "#ffffff" : "#111827" }}>{user?.name}</p>
                          <p className="text-xs" style={{ color: isDark ? "#5a5a5a" : "#9CA3AF" }}>@{user?.username}</p>
                        </div>
                        {menuItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="dropdown-item block px-4 py-2.5 text-sm"
                            onClick={() => setMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                        <div style={{ borderTop: isDark ? "1px solid #1e1e1e" : "1px solid rgba(var(--color-primary-rgb),0.07)", margin: "4px 0" }} />
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
                        >
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link
                    href="/login"
                    className="text-sm font-medium transition-colors px-3 py-2 rounded-lg"
                    style={{ color: isDark ? "#a3a3a3" : "#6B7280" }}
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup/role-selection"
                    className="btn-primary text-sm px-4 py-2 h-9 min-h-[36px] inline-flex items-center"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}

          {variant === "minimal" && (
            <Link
              href="/"
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ color: isDark ? "#a3a3a3" : "#6B7280" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile slide-out drawer */}
      {mobileDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setMobileDrawerOpen(false)}
          />
          {/* Drawer */}
          <div
            className="fixed top-0 right-0 bottom-0 z-[70] w-72 max-w-[calc(100%-2rem)] flex flex-col"
            style={{
              background: isDark ? "#111111" : "#ffffff",
              boxShadow: "-4px 0 32px rgba(0,0,0,0.15)",
            }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: isDark ? "1px solid #1e1e1e" : "1px solid rgba(var(--color-primary-rgb),0.07)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)" }}
                >
                  <ScissorsIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <span
                  className="font-heading font-bold text-lg"
                  style={{
                    background: "linear-gradient(135deg, #1E3573 0%, var(--color-primary) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Sniply
                </span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ color: isDark ? "#6b6b6b" : "#9CA3AF" }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User info (if logged in) */}
            {isLoggedIn && (
              <div
                className="px-5 py-4 flex items-center gap-3"
                style={{ borderBottom: isDark ? "1px solid #1e1e1e" : "1px solid rgba(var(--color-primary-rgb),0.07)" }}
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user?.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center text-sm"
                    style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)" }}
                  >
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: isDark ? "#ffffff" : "#111827" }}>{user?.name}</p>
                  <p className="text-xs truncate" style={{ color: isDark ? "#5a5a5a" : "#9CA3AF" }}>@{user?.username}</p>
                </div>
                {(unreadCount + customerUnreadCount) > 0 && (
                  <span className="ml-auto text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full shrink-0">
                    {unreadCount + customerUnreadCount}
                  </span>
                )}
              </div>
            )}

            {/* Nav links */}
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              {mobileNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="drawer-nav-link flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(var(--color-primary-rgb),0.08)" }}
                  >
                    <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                    </svg>
                  </div>
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Footer: dark mode toggle + sign out */}
            <div
              className="px-5 py-4 space-y-3"
              style={{ borderTop: isDark ? "1px solid #1e1e1e" : "1px solid rgba(var(--color-primary-rgb),0.07)" }}
            >
              <button
                onClick={toggleDark}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ color: isDark ? "#d4d4d4" : "#374151", background: isDark ? "#1a1a1a" : "rgba(var(--color-primary-rgb),0.05)" }}
              >
                {isDark ? (
                  <><SunIcon /> Light Mode</>
                ) : (
                  <><MoonIcon /> Dark Mode</>
                )}
              </button>
              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="w-full text-center py-2.5 text-sm font-medium text-red-500 rounded-xl transition-colors hover:bg-red-50"
                >
                  Sign Out
                </button>
              )}
              {!isLoggedIn && (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="btn-secondary w-full text-center block py-2.5 text-sm font-medium rounded-xl"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup/role-selection"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="btn-primary w-full text-center block py-2.5 text-sm"
                  >
                    Sign Up Free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
