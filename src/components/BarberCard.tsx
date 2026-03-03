import Link from "next/link";
import Image from "next/image";
import { Stars } from "@/components/Stars";

interface BarberCardProps {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  location: string;
  type: "independent" | "shop";
  startingPrice: number;
  specialties: string[];
  matchPercent?: number;
  heroImage?: string;
  nextAvailable?: string;
  distance?: number;
  isNew?: boolean;
}

export default function BarberCard({
  id, name, rating, reviewCount, location, type, startingPrice, specialties,
  matchPercent, heroImage, nextAvailable, distance, isNew,
}: BarberCardProps) {
  return (
    <Link href={`/barber/${id}`} className="block group">
      <div className="barber-card bg-white rounded-2xl overflow-hidden h-full flex flex-col transition-transform duration-300 group-hover:-translate-y-1.5">
        {/* Hero Image */}
        <div className="relative bg-gray-100" style={{ height: "220px" }}>
          {heroImage ? (
            <Image
              src={heroImage}
              alt={`${name}'s portfolio`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(46,74,139,0.06) 0%, rgba(91,127,204,0.08) 100%)" }}
            >
              <svg className="w-14 h-14 text-[#2E4A8B]/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          {/* Gradient fade at bottom of image */}
          <div
            className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.18), transparent)" }}
          />
          {/* New badge */}
          {isNew && (
            <div className="absolute top-3 left-3">
              <span
                className="text-white text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  boxShadow: "0 2px 8px rgba(16,185,129,0.35)",
                }}
              >
                New
              </span>
            </div>
          )}
          {matchPercent && (
            <div className="absolute top-3 right-3 group/match">
              <div
                className="text-white text-xs font-bold px-2.5 py-1 rounded-full cursor-default"
                style={{
                  background: "linear-gradient(135deg, #FF9500, #FF6B00)",
                  boxShadow: "0 2px 8px rgba(255,107,0,0.35)",
                }}
              >
                {matchPercent}% match
              </div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 opacity-0 group-hover/match:opacity-100 transition-opacity pointer-events-none z-20 leading-relaxed shadow-xl">
                Based on your hair type &amp; style preferences
                <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-heading font-bold text-gray-900 text-lg leading-snug">{name}</h3>

          <div className="flex items-center gap-1.5 mt-1.5">
            <Stars rating={rating} size="sm" />
            <span className="text-sm text-gray-500">{rating} <span className="text-gray-400">({reviewCount})</span></span>
          </div>

          <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {location}
            {distance != null && (
              <span className="ml-1 text-[#2E4A8B] font-medium">· {distance.toFixed(1)} mi</span>
            )}
          </p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {type === "independent" ? (
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full text-white"
                style={{ background: "linear-gradient(135deg, #2E4A8B, #4A6BC0)", boxShadow: "0 1px 4px rgba(46,74,139,0.3)" }}
              >
                Independent
              </span>
            ) : (
              <span className="text-xs font-semibold px-3 py-1 rounded-full badge-shop">
                Shop
              </span>
            )}
            <span className="text-sm font-semibold text-gray-800">From ${startingPrice}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 flex-1">
            {specialties.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                style={{
                  color: "#2E4A8B",
                  background: "rgba(46,74,139,0.07)",
                  border: "1px solid rgba(46,74,139,0.14)",
                }}
              >
                {s}
              </span>
            ))}
          </div>

          {/* Next available + arrow */}
          <div className="mt-4 flex items-center justify-between">
            {nextAvailable ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                {nextAvailable}
              </span>
            ) : (
              <span />
            )}
            <span className="flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2" style={{ color: "#2E4A8B" }}>
              <span className="hidden sm:inline">View profile</span>
              <svg className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
