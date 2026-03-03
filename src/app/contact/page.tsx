"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type FormState = { name: string; email: string; subject: string; message: string };
type Errors = Partial<FormState>;

const SUBJECTS = [
  "General question",
  "Booking issue",
  "Account help",
  "Billing & payments",
  "Report a problem",
  "Pro (barber/stylist) inquiry",
  "Other",
];

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.name.trim())    next.name    = "Please enter your name.";
    if (!form.email.trim())   next.email   = "Please enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Please enter a valid email.";
    if (!form.subject)        next.subject = "Please select a subject.";
    if (!form.message.trim()) next.message = "Please enter a message.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-gray-100 py-20 text-center px-6">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#2E4A8B] mb-5">Get in touch</p>
        <h1 className="font-heading text-4xl md:text-5xl text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
          We&apos;re here to help. Send us a message and we&apos;ll get back to you within one business day.
        </p>
      </section>

      <main className="flex-1 py-16 px-6">
        <div className="max-w-[760px] mx-auto">
          <div className="grid md:grid-cols-[1fr_280px] gap-12">

            {/* Form */}
            <div>
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-[#2E4A8B]/8 flex items-center justify-center text-[#2E4A8B] mx-auto mb-5">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <h2 className="font-heading text-2xl text-gray-900 mb-2">Message sent</h2>
                  <p className="text-gray-500 leading-relaxed">Thanks for reaching out, {form.name.split(" ")[0]}. We&apos;ll reply to <strong className="font-medium text-gray-700">{form.email}</strong> within one business day.</p>
                  <button
                    onClick={() => { setForm({ name: "", email: "", subject: "", message: "" }); setSubmitted(false); }}
                    className="mt-6 text-sm text-[#2E4A8B] font-medium hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="Your name"
                        className={`input-field ${errors.name ? "border-red-400 focus:border-red-400" : ""}`}
                      />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="you@example.com"
                        className={`input-field ${errors.email ? "border-red-400 focus:border-red-400" : ""}`}
                      />
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                    <select
                      value={form.subject}
                      onChange={(e) => update("subject", e.target.value)}
                      className={`select-field ${errors.subject ? "border-red-400 focus:border-red-400" : ""}`}
                    >
                      <option value="">Select a topic…</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder="Describe your issue or question…"
                      rows={6}
                      className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-900 resize-none outline-none transition-all focus:ring-2 focus:ring-[#2E4A8B]/20 focus:border-[#2E4A8B] ${errors.message ? "border-red-400 focus:border-red-400 focus:ring-red-100" : "border-gray-200"}`}
                    />
                    {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
                  </div>

                  <button type="submit" className="btn-primary w-full">
                    Send message
                  </button>
                </form>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              <div>
                <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#2E4A8B] mb-3">Email</p>
                <div className="w-6 h-[2px] bg-[#2E4A8B] mb-3" />
                <a href="mailto:support@sniply.com" className="text-sm text-gray-700 hover:text-[#2E4A8B] transition-colors">
                  support@sniply.com
                </a>
                <p className="text-xs text-gray-400 mt-1">Response within 1 business day</p>
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#2E4A8B] mb-3">Hours</p>
                <div className="w-6 h-[2px] bg-[#2E4A8B] mb-3" />
                <p className="text-sm text-gray-700">Monday – Friday</p>
                <p className="text-sm text-gray-700">9 AM – 6 PM ET</p>
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#2E4A8B] mb-3">Are you a Pro?</p>
                <div className="w-6 h-[2px] bg-[#2E4A8B] mb-3" />
                <p className="text-sm text-gray-500 leading-relaxed">
                  For Pro-specific inquiries — payouts, profile help, or onboarding — email us at{" "}
                  <a href="mailto:pros@sniply.com" className="text-[#2E4A8B] hover:underline">pros@sniply.com</a>.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
