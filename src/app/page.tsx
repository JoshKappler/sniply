"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BarberCard from "@/components/BarberCard";
import type { Barber } from "@/lib/types";
import { apiGetBarbers, apiGetReviews } from "@/lib/api";
import { Stars } from "@/components/Stars";

const FEATURED_IDS = ["2", "5", "7"];

interface LiveTestimonial { userName: string; rating: number; text: string; }

export default function HomePage() {
  const [userRole, setUserRole] = useState<"pro" | "customer" | null>(null);
  const [featuredBarbers, setFeaturedBarbers] = useState<Barber[]>([]);
  const [liveTestimonials, setLiveTestimonials] = useState<LiveTestimonial[]>([]);

  useEffect(() => {
    const role = localStorage.getItem("sniply_role");
    if (role === "pro") setUserRole("pro");
    else if (role === "customer") setUserRole("customer");
    apiGetBarbers()
      .then(async ({ barbers }) => {
        const featured = barbers.filter((b) => FEATURED_IDS.includes(b.id));
        setFeaturedBarbers(featured.length > 0 ? featured : barbers.slice(0, 3));
        const collected: LiveTestimonial[] = [];
        await Promise.allSettled(
          barbers.map((b) =>
            apiGetReviews(b.id).then((revs) => {
              for (const r of revs) {
                if (r.text?.trim()) collected.push({ userName: r.userName, rating: r.rating, text: r.text });
              }
            })
          )
        );
        collected.sort((a, b) => b.rating - a.rating);
        setLiveTestimonials(collected.slice(0, 3));
      })
      .catch((err) => console.error("sniply/home: failed to load barbers", err));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-page-bg)] dark:bg-black">
      <Navbar />

      <main className="flex-1 relative overflow-hidden">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Dot grid backdrop */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(var(--color-primary-rgb),0.045) 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Floating blobs */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "-180px",
              left: "-120px",
              width: "560px",
              height: "560px",
              borderRadius: "50%",
              background: "rgba(var(--color-primary-rgb),0.07)",
              filter: "blur(90px)",
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              top: "-80px",
              right: "-100px",
              width: "480px",
              height: "480px",
              borderRadius: "50%",
              background: "rgba(91,127,204,0.06)",
              filter: "blur(100px)",
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: "-60px",
              left: "40%",
              width: "320px",
              height: "320px",
              borderRadius: "50%",
              background: "rgba(var(--color-primary-rgb),0.04)",
              filter: "blur(70px)",
            }}
          />

          <div className="relative max-w-[960px] mx-auto px-4 pt-16 pb-16 md:px-6 md:pt-24 md:pb-24 text-center">
            {/* Badge pill */}
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(var(--color-primary-rgb),0.07)",
                border: "1px solid rgba(var(--color-primary-rgb),0.14)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--color-primary)" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
                Barber &amp; stylist marketplace
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-heading font-bold text-gray-900 mb-6"
              style={{
                fontSize: "clamp(42px, 6.5vw, 78px)",
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
              }}
            >
              Find the right hands
              <br />
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, var(--color-primary) 0%, #5B7FCC 55%, #7B8FCC 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                for your hair.
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-gray-500 max-w-[500px] mx-auto mb-10 leading-relaxed"
              style={{ fontSize: "clamp(16px, 2vw, 19px)" }}
            >
              Browse barbers and stylists near you, filter by specialty, and connect with the right pro for your look.
            </p>

            {/* CTAs */}
            {userRole === "pro" ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <Link
                  href="/pro/dashboard"
                  className="btn-primary"
                  style={{ height: "56px", padding: "0 40px", fontSize: "17px" }}
                >
                  View Pro Dashboard
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link href="/browse" className="text-sm text-gray-400 hover:text-[var(--color-primary)] transition-colors mt-1">
                  Browse as customer →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3">
                <Link
                  href="/browse"
                  className="btn-primary"
                  style={{ height: "56px", padding: "0 40px", fontSize: "17px" }}
                >
                  Browse Barbers
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                {userRole !== "customer" && (
                  <Link href="/signup/professional" className="text-sm text-gray-400 hover:text-[var(--color-primary)] transition-colors mt-1">
                    Join as a professional →
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Featured pros ── */}
        {userRole !== "pro" && (
          <section
            className="relative"
            style={{ borderTop: "1px solid rgba(var(--color-primary-rgb),0.08)" }}
          >
            <div className="absolute inset-0 pointer-events-none section-bg-gradient"
            style={{ background: "linear-gradient(180deg, var(--color-section-bg) 0%, var(--color-page-bg) 100%)" }}
            />
            <div className="relative max-w-[1100px] mx-auto px-6 py-16">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-10">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-px" style={{ background: "rgba(var(--color-primary-rgb),0.35)" }} />
                    <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(var(--color-primary-rgb),0.6)" }}>
                      Top-rated professionals
                    </span>
                    <span className="w-6 h-px" style={{ background: "rgba(var(--color-primary-rgb),0.35)" }} />
                  </div>
                  <h2 className="font-heading font-bold text-gray-900 text-3xl">
                    Meet some of our pros
                  </h2>
                </div>
                <Link
                  href="/browse"
                  className="text-sm font-semibold flex items-center gap-1.5 shrink-0 ml-4 transition-colors hover:opacity-80"
                  style={{ color: "var(--color-primary)" }}
                >
                  Browse all pros
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {featuredBarbers.map((barber) => (
                  <BarberCard
                    key={barber.id}
                    id={barber.id}
                    name={barber.name}
                    rating={barber.rating}
                    reviewCount={barber.reviewCount}
                    location={barber.location}
                    type={barber.type}
                    startingPrice={barber.startingPrice}
                    specialties={barber.specialties}
                    heroImage={barber.heroImage}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Testimonials (live reviews only — hidden when none exist) ── */}
        {userRole !== "pro" && liveTestimonials.length > 0 && (
          <section className="section-bg-gradient" style={{ borderTop: "1px solid rgba(var(--color-primary-rgb),0.08)", background: "linear-gradient(180deg, #e8f0fa 0%, var(--color-page-bg) 100%)" }}>
            <div className="max-w-[1100px] mx-auto px-6 py-16">
              <div className="text-center mb-10">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="w-6 h-px" style={{ background: "rgba(var(--color-primary-rgb),0.35)" }} />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(var(--color-primary-rgb),0.6)" }}>
                    Client reviews
                  </span>
                  <span className="w-6 h-px" style={{ background: "rgba(var(--color-primary-rgb),0.35)" }} />
                </div>
                <h2 className="font-heading font-bold text-gray-900 text-3xl">What clients are saying</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {liveTestimonials.map((t, i) => {
                  const initials = t.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-2xl p-7"
                      style={{ border: "1px solid rgba(var(--color-primary-rgb),0.10)", boxShadow: "0 4px 24px rgba(var(--color-primary-rgb),0.05)" }}
                    >
                      {/* Stars */}
                      <div className="mb-4">
                        <Stars rating={t.rating} size="sm" />
                      </div>
                      {/* Quote */}
                      <p className="text-gray-600 text-sm leading-relaxed mb-6">&#8220;{t.text}&#8221;</p>
                      {/* Author */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)" }}
                        >
                          {initials}
                        </div>
                        <p className="font-semibold text-gray-900 text-sm">{t.userName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Built for both sides ── */}
        {userRole !== "pro" && (
        <section className="section-bg-gradient" style={{ borderTop: "1px solid rgba(var(--color-primary-rgb),0.08)", background: "linear-gradient(180deg, var(--color-section-bg) 0%, var(--color-page-bg) 100%)" }}>
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="w-6 h-px" style={{ background: "rgba(var(--color-primary-rgb),0.35)" }} />
                <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(var(--color-primary-rgb),0.6)" }}>
                  Built for both sides
                </span>
                <span className="w-6 h-px" style={{ background: "rgba(var(--color-primary-rgb),0.35)" }} />
              </div>
              <h2 className="font-heading font-bold text-gray-900 text-3xl md:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                One platform. Two powerful experiences.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── For Clients ── */}
              <div
                className="rounded-2xl p-8 relative overflow-hidden"
                style={{
                  background: "white",
                  border: "1px solid rgba(var(--color-primary-rgb),0.12)",
                  boxShadow: "0 4px 28px rgba(var(--color-primary-rgb),0.07)",
                }}
              >
                {/* Top accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
                  style={{ background: "linear-gradient(90deg, var(--color-primary), var(--color-primary-light))" }}
                />

                {/* Card header */}
                <div className="flex items-center gap-3 mb-8">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-light))", boxShadow: "0 4px 12px rgba(var(--color-primary-rgb),0.28)" }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>For Clients</span>
                    <p className="font-heading font-bold text-gray-900 text-lg leading-tight">Find your perfect match</p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-5">
                  {[
                    {
                      icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
                      label: "Smart Matching",
                      desc: "Get paired with pros who specialize in your exact hair type and style goals.",
                    },
                    {
                      icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                      label: "Map Discovery",
                      desc: "Search by location and radius — find top-rated pros in your area on an interactive map.",
                    },
                    {
                      icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
                      label: "Verified Reviews",
                      desc: "Read real client feedback and browse portfolios before committing to any booking.",
                    },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "rgba(var(--color-primary-rgb),0.08)", color: "var(--color-primary)" }}
                      >
                        {icon}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{label}</p>
                        <p className="text-gray-500 text-sm leading-relaxed mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(var(--color-primary-rgb),0.08)" }}>
                  <Link
                    href="/browse"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Start browsing
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* ── For Pros ── */}
              <div
                className="rounded-2xl p-8 relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #111827 0%, #1e2a3a 100%)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 4px 28px rgba(0,0,0,0.22)",
                }}
              >
                {/* Subtle dot grid */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />

                {/* Card header */}
                <div className="relative flex items-center gap-3 mb-8">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">For Pros</span>
                    <p className="font-heading font-bold text-white text-lg leading-tight">Grow your business</p>
                  </div>
                </div>

                {/* Features */}
                <div className="relative space-y-5">
                  {[
                    {
                      icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
                      label: "Full Dashboard",
                      desc: "Manage your services, drag-and-drop schedule, and client conversations in one place.",
                    },
                    {
                      icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
                      label: "Business Analytics",
                      desc: "Track your bookings, revenue, and best-performing services with a real-time dashboard.",
                    },
                    {
                      icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
                      label: "Direct Messaging",
                      desc: "Build lasting client relationships with a built-in messaging thread for every customer.",
                    },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-white"
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.09)" }}
                      >
                        {icon}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{label}</p>
                        <p className="text-white/45 text-sm leading-relaxed mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <Link
                    href="/signup/professional"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors"
                  >
                    Join as a pro
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>
        )}

        {/* ── Pre-footer CTA (non-pro) ── */}
        {userRole !== "pro" && (
          <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1A2F70 0%, var(--color-primary) 55%, #3D5FA8 100%)" }}>
            {/* Decorative blobs */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: "-100px", right: "-80px",
                width: "360px", height: "360px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
                filter: "blur(40px)",
              }}
            />
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: "-80px", left: "-60px",
                width: "280px", height: "280px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                filter: "blur(40px)",
              }}
            />
            {/* Dot grid */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative max-w-[720px] mx-auto px-6 py-14 md:py-24 text-center">
              <h2
                className="font-heading font-bold text-white mb-5"
                style={{ fontSize: "clamp(28px, 4vw, 50px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
              >
                Your perfect cut is waiting.
              </h2>
              <p className="text-white/60 mb-10 max-w-[420px] mx-auto leading-relaxed" style={{ fontSize: "18px" }}>
                Find the right barber the first time — no guessing, no wasted appointments.
              </p>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2.5 bg-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 cta-browse-btn"
                style={{
                  color: "var(--color-primary)",
                  fontSize: "16px",
                }}
              >
                Browse Barbers
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </section>
        )}

      </main>

      <Footer />
    </div>
  );
}
