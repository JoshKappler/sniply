"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

const roles = [
  {
    id: "customer",
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    iconGradient: "linear-gradient(135deg, var(--color-primary) 0%, #5B7FCC 100%)",
    iconShadow: "0 4px 16px rgba(var(--color-primary-rgb),0.30)",
    badgeBg: "rgba(var(--color-primary-rgb),0.08)",
    badgeColor: "var(--color-primary)",
    badgeLabel: "Most popular",
    accentColor: "var(--color-primary)",
    title: "Customer",
    description: "Find and book barbers that understand your hair type and style goals.",
    perks: ["Filter by specialty & hair type", "Browse real portfolio work", "Book instantly online"],
    href: "/customer/profile-setup",
    cta: "Join as Customer",
    ctaGradient: "linear-gradient(135deg, #3050A0 0%, #1E3573 100%)",
    ctaShadow: "0 4px 16px rgba(var(--color-primary-rgb),0.30)",
  },
  {
    id: "pro",
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="5" cy="7" r="2.5" strokeWidth={1.5} />
        <circle cx="5" cy="17" r="2.5" strokeWidth={1.5} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8L20 18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16L20 6" />
      </svg>
    ),
    iconGradient: "linear-gradient(135deg, #D97706 0%, #F59E0B 100%)",
    iconShadow: "0 4px 16px rgba(217,119,6,0.30)",
    badgeBg: "rgba(217,119,6,0.08)",
    badgeColor: "#B45309",
    badgeLabel: "For barbers & stylists",
    accentColor: "#D97706",
    title: "Professional",
    description: "Showcase your work, set your schedule, and grow your client base effortlessly.",
    perks: ["Portfolio & profile showcase", "Real-time booking calendar", "Built-in client messaging"],
    href: "/signup/professional",
    cta: "Join as Professional",
    ctaGradient: "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
    ctaShadow: "0 4px 16px rgba(217,119,6,0.30)",
  },
];

export default function RoleSelectionPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(var(--color-primary-rgb),0.035) 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute pointer-events-none"
          style={{ top: "-200px", left: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "rgba(var(--color-primary-rgb),0.05)", filter: "blur(80px)" }}
        />
        <div className="absolute pointer-events-none"
          style={{ bottom: "-150px", right: "-80px", width: "400px", height: "400px", borderRadius: "50%", background: "rgba(217,119,6,0.04)", filter: "blur(80px)" }}
        />

        <div className="relative w-full max-w-[840px]">
          <div className="text-center mb-12">
            <h1
              className="font-heading font-bold text-gray-900 mb-3"
              style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em" }}
            >
              Create your account
            </h1>
            <p className="text-gray-500 text-lg">How will you use Sniply?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((role) => (
              <div
                key={role.id}
                onClick={() => router.push(role.href)}
                className={`cursor-pointer rounded-2xl p-8 bg-white flex flex-col role-card role-card-${role.id}`}
                style={{ minHeight: "360px" }}
              >
                {/* Badge */}
                <div
                  className="self-start text-xs font-bold px-3 py-1 rounded-full mb-6"
                  style={{ background: role.badgeBg, color: role.badgeColor }}
                >
                  {role.badgeLabel}
                </div>

                {/* Icon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6"
                  style={{ background: role.iconGradient, boxShadow: role.iconShadow }}
                >
                  {role.icon}
                </div>

                {/* Title + description */}
                <h2 className="font-heading font-bold text-gray-900 text-xl mb-2">{role.title}</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">{role.description}</p>

                {/* Perks */}
                <ul className="space-y-2.5 mb-auto pb-7">
                  {role.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: role.badgeBg }}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: role.accentColor }}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      {perk}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <Link
                  href={role.href}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-center text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
                  style={{
                    background: role.ctaGradient,
                    boxShadow: role.ctaShadow,
                    fontSize: "15px",
                    display: "block",
                  }}
                >
                  {role.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
