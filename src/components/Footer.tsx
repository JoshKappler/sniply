import Link from "next/link";

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

const links = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export default function Footer() {
  return (
    <footer style={{ background: "#13162A" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Top row: logo + links */}
        <div
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #2E4A8B 0%, #4A6BC0 100%)" }}
              >
                <ScissorsIcon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-heading font-bold text-xl text-white">Sniply</span>
            </div>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.30)" }}>Your barber. Discovered.</p>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-7 flex-wrap">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="footer-nav-link"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom row */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
            © 2026 Sniply, Inc. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.16)" }}>
            Built for barbers, by barbers.
          </p>
        </div>
      </div>
    </footer>
  );
}
