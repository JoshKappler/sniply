"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) { setError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    setError("");
    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-page-bg)] px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <Link href="/login" className="text-sm font-medium hover:underline" style={{ color: "var(--color-primary)" }}>
            ← Back to login
          </Link>
        </div>

        <div className="bg-white border border-[var(--color-primary)]/12 rounded-2xl p-8">
          {submitted ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-heading font-bold text-gray-900 text-2xl mb-3">Check your email</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox (and spam folder).
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm font-semibold hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                Return to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-heading font-bold text-gray-900 text-2xl mb-2">Forgot password?</h1>
              <p className="text-gray-500 text-sm mb-7">Enter your email and we&apos;ll send you a reset link.</p>

              {error && (
                <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                    className="input-field"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="btn-primary w-full disabled:opacity-60"
                  style={{ height: "48px" }}
                >
                  {submitting ? "Sending…" : "Send Reset Link"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
