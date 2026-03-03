"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setCurrentUser } from "@/lib/auth";
import { apiLogin } from "@/lib/api";

function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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

const TESTIMONIALS = [
  {
    quote: "I finally found a barber who actually gets my hair texture. Booked in under a minute.",
    author: "Marcus T.",
    role: "Customer",
    initial: "M",
  },
  {
    quote: "My client list doubled in 3 months after joining Sniply. The platform just works.",
    author: "DeShawn W.",
    role: "Independent Barber",
    initial: "D",
  },
  {
    quote: "No more scrolling through Instagram hoping for the right vibe. Sniply delivers.",
    author: "Aaliyah R.",
    role: "Customer",
    initial: "A",
  },
];

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [testimonialIdx] = useState(() => Math.floor(Math.random() * TESTIMONIALS.length));

  const testimonial = TESTIMONIALS[testimonialIdx];

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    if (errors.general) setErrors((prev) => ({ ...prev, general: "" }));
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.username.trim()) newErrors.username = "Username is required";
    if (!form.password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const user = await apiLogin(form.username.trim(), form.password);
      setCurrentUser(user);
      localStorage.setItem("sniply_role", user.role);
      localStorage.setItem("sniply_onboarded", "true");
      if (user.role === "pro") {
        router.push("/pro/dashboard");
      } else {
        router.push("/browse");
      }
    } catch {
      setErrors({ general: "Incorrect username or password. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: brand + testimonial ── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #111E4A 0%, #1E3573 45%, #2E4A8B 80%, #3D5FA8 100%)" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Blobs */}
        <div className="absolute top-[-120px] right-[-120px] w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.04)", filter: "blur(60px)" }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.04)", filter: "blur(50px)" }} />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <ScissorsIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-2xl text-white">Sniply</span>
          </Link>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <svg className="w-8 h-8 mb-5" style={{ color: "rgba(255,255,255,0.25)" }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <p className="text-white/85 text-xl leading-relaxed font-light italic mb-8">
            &ldquo;{testimonial.quote}&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              {testimonial.initial}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{testimonial.author}</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{testimonial.role}</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>© 2026 Sniply, Inc.</p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden p-6" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2E4A8B, #4A6BC0)" }}>
              <ScissorsIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-bold text-xl" style={{ color: "#2E4A8B" }}>Sniply</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-[400px]">
            <div className="mb-9">
              <h1 className="font-heading font-bold text-gray-900 mb-2" style={{ fontSize: "32px", letterSpacing: "-0.02em" }}>
                Welcome back
              </h1>
              <p className="text-gray-500">Sign in to your Sniply account</p>
            </div>

            {errors.general && (
              <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 text-sm text-red-700 flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.general}
              </div>
            )}

            <div className="space-y-5">
              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  placeholder="Your username"
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                  className={`input-field ${errors.username ? "border-red-400 focus:border-red-400" : ""}`}
                  autoComplete="username"
                />
                {errors.username && (
                  <p className="text-xs text-red-500 mt-1.5">{errors.username}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <span className="text-xs text-gray-400 cursor-not-allowed select-none">Forgot password?</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                    className={`input-field pr-11 ${errors.password ? "border-red-400 focus:border-red-400" : ""}`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary w-full disabled:opacity-60"
                style={{ height: "52px", fontSize: "16px" }}
              >
                {submitting ? "Signing in…" : "Sign In"}
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-8">
              Don&apos;t have an account?{" "}
              <Link href="/signup/role-selection" className="font-semibold hover:underline" style={{ color: "#2E4A8B" }}>
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
