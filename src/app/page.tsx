"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BarberCard from "@/components/BarberCard";
import type { Barber } from "@/lib/types";
import { apiGetBarbers } from "@/lib/api";

const FEATURED_IDS = ["2", "5", "7"];

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    initials: "MT",
    location: "Oakland, CA",
    quote: "I've been going to the same barber for years, but he moved away. Found someone even better on Sniply in about 10 minutes. The portfolio feature sealed it — I could see his actual work before booking.",
  },
  {
    name: "Priya S.",
    initials: "PS",
    location: "San Francisco, CA",
    quote: "Finally found someone who actually knows how to work with my curly hair. The specialty filter is a game changer — I narrowed it down to exactly who I needed.",
  },
  {
    name: "DeShawn W.",
    initials: "DW",
    location: "Los Angeles, CA",
    quote: "Booking was stupid simple. Saw the availability, picked a time, showed up. No back-and-forth texts, no waiting. Exactly what I needed.",
  },
];

export default function HomePage() {
  const [userRole, setUserRole] = useState<"pro" | "customer" | null>(null);
  const [featuredBarbers, setFeaturedBarbers] = useState<Barber[]>([]);

  useEffect(() => {
    const role = localStorage.getItem("sniply_role");
    if (role === "pro") setUserRole("pro");
    else if (role === "customer") setUserRole("customer");
    apiGetBarbers().then(({ barbers }) => {
      setFeaturedBarbers(barbers.filter((b) => FEATURED_IDS.includes(b.id)));
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#d6e4f7] dark:bg-black">
      <Navbar />

      <main className="flex-1 relative overflow-hidden">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Dot grid backdrop */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(46,74,139,0.045) 1.5px, transparent 1.5px)",
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
              background: "rgba(46,74,139,0.07)",
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
              background: "rgba(46,74,139,0.04)",
              filter: "blur(70px)",
            }}
          />

          <div className="relative max-w-[960px] mx-auto px-4 pt-16 pb-16 md:px-6 md:pt-24 md:pb-24 text-center">
            {/* Badge pill */}
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(46,74,139,0.07)",
                border: "1px solid rgba(46,74,139,0.14)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#2E4A8B" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2E4A8B" }}>
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
                  backgroundImage: "linear-gradient(135deg, #2E4A8B 0%, #5B7FCC 55%, #7B8FCC 100%)",
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
                <Link href="/browse" className="text-sm text-gray-400 hover:text-[#2E4A8B] transition-colors mt-1">
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
                  <Link href="/signup/professional" className="text-sm text-gray-400 hover:text-[#2E4A8B] transition-colors mt-1">
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
            style={{ borderTop: "1px solid rgba(46,74,139,0.08)" }}
          >
            <div className="absolute inset-0 pointer-events-none section-bg-gradient"
            style={{ background: "linear-gradient(180deg, #e4edf8 0%, #d6e4f7 100%)" }}
            />
            <div className="relative max-w-[1100px] mx-auto px-6 py-16">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-10">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-px" style={{ background: "rgba(46,74,139,0.35)" }} />
                    <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(46,74,139,0.6)" }}>
                      Top-rated professionals
                    </span>
                    <span className="w-6 h-px" style={{ background: "rgba(46,74,139,0.35)" }} />
                  </div>
                  <h2 className="font-heading font-bold text-gray-900 text-3xl">
                    Meet some of our pros
                  </h2>
                </div>
                <Link
                  href="/browse"
                  className="text-sm font-semibold flex items-center gap-1.5 shrink-0 ml-4 transition-colors hover:opacity-80"
                  style={{ color: "#2E4A8B" }}
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

        {/* ── Testimonials ── */}
        {userRole !== "pro" && (
          <section className="section-bg-gradient" style={{ borderTop: "1px solid rgba(46,74,139,0.08)", background: "linear-gradient(180deg, #e8f0fa 0%, #d6e4f7 100%)" }}>
            <div className="max-w-[1100px] mx-auto px-6 py-16">
              <div className="text-center mb-10">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="w-6 h-px" style={{ background: "rgba(46,74,139,0.35)" }} />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(46,74,139,0.6)" }}>
                    Client stories
                  </span>
                  <span className="w-6 h-px" style={{ background: "rgba(46,74,139,0.35)" }} />
                </div>
                <h2 className="font-heading font-bold text-gray-900 text-3xl">What clients are saying</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TESTIMONIALS.map((t) => (
                  <div
                    key={t.name}
                    className="bg-white rounded-2xl p-7"
                    style={{ border: "1px solid rgba(46,74,139,0.10)", boxShadow: "0 4px 24px rgba(46,74,139,0.05)" }}
                  >
                    {/* Stars */}
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4" fill="#FF9500" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    {/* Quote */}
                    <p className="text-gray-600 text-sm leading-relaxed mb-6">&#8220;{t.quote}&#8221;</p>
                    {/* Author */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #2E4A8B 0%, #4A6BC0 100%)" }}
                      >
                        {t.initials}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.location}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── How it works ── */}
        <section className="section-bg-gradient" style={{ borderTop: "1px solid rgba(46,74,139,0.08)", background: "linear-gradient(180deg, #e4edf8 0%, #d6e4f7 100%)" }}>
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <span
                className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-4"
                style={{ color: "rgba(46,74,139,0.55)" }}
              >
                How Sniply Works
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  icon: (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  ),
                  title: "Filter by specialty",
                  desc: "Find pros who specialize in your hair type and preferred styles — curly, locs, fades, color, and more.",
                },
                {
                  step: "02",
                  icon: (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: "Browse their portfolio",
                  desc: "See real work before you commit — no surprises. Every pro showcases their best cuts and styles.",
                },
                {
                  step: "03",
                  icon: (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: "Book instantly",
                  desc: "Connect directly with your chosen pro and lock in your appointment in seconds.",
                },
              ].map(({ step, icon, title, desc }) => (
                <div
                  key={step}
                  className="relative rounded-2xl p-8 overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-white"
                  style={{
                    border: "1px solid rgba(46,74,139,0.10)",
                    boxShadow: "0 4px 24px rgba(46,74,139,0.05)",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.boxShadow = "0 8px 40px rgba(46,74,139,0.09)";
                    el.style.borderColor = "rgba(46,74,139,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.04)";
                    el.style.borderColor = "rgba(0,0,0,0.06)";
                  }}
                >
                  {/* Large faint step number */}
                  <span
                    className="absolute bottom-3 right-4 font-heading font-bold leading-none select-none pointer-events-none"
                    style={{ fontSize: "88px", color: "rgba(46,74,139,0.035)" }}
                  >
                    {step}
                  </span>

                  {/* Icon with gradient bg */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6"
                    style={{ background: "linear-gradient(135deg, #2E4A8B 0%, #4A6BC0 100%)", boxShadow: "0 4px 16px rgba(46,74,139,0.25)" }}
                  >
                    {icon}
                  </div>

                  <h3 className="font-heading font-bold text-gray-900 text-xl mb-2.5">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pre-footer CTA (non-pro) ── */}
        {userRole !== "pro" && (
          <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1A2F70 0%, #2E4A8B 55%, #3D5FA8 100%)" }}>
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
                Join thousands of clients who discovered their ideal barber or stylist on Sniply.
              </p>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2.5 bg-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  color: "#2E4A8B",
                  fontSize: "16px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(0,0,0,0.25)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.18)";
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
