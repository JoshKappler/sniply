"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import BarberCard from "@/components/BarberCard";
import type { Barber } from "@/lib/types";
import { apiGetFavorites, apiUpdateFavorites, apiGetBarbers } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading saved pros...</p>
      </div>
    </div>
  );
}

export default function SavedPage() {
  const router = useRouter();
  const [savedBarbers, setSavedBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "customer") {
      router.replace("/");
      return;
    }

    Promise.all([
      apiGetFavorites(user.id),
      apiGetBarbers(),
    ]).then(([favIds, { barbers }]) => {
      const found = favIds
        .map((id) => barbers.find((b) => b.id === id))
        .filter(Boolean) as Barber[];
      setSavedBarbers(found);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  const removeFavorite = (barberId: string) => {
    const user = getCurrentUser();
    if (!user) return;
    const next = savedBarbers.filter((b) => b.id !== barberId);
    setSavedBarbers(next);
    void apiUpdateFavorites(user.id, next.map((b) => b.id));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] dark:bg-black">
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="font-heading font-bold text-gray-900 text-3xl">Saved Pros</h1>
            <p className="text-gray-500 mt-1">
              {savedBarbers.length === 0
                ? "You haven't saved any pros yet"
                : `${savedBarbers.length} saved pro${savedBarbers.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/browse" className="btn-secondary text-sm" style={{ height: "40px", padding: "0 16px", display: "flex", alignItems: "center" }}>
            Browse Pros
          </Link>
        </div>

        {savedBarbers.length === 0 ? (
          <div className="bg-white border border-[var(--color-primary)]/12 rounded-2xl p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/8 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-primary)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h2 className="font-heading font-bold text-gray-900 text-xl mb-2">No saved pros yet</h2>
            <p className="text-gray-500 mb-6">
              Browse pros and tap the bookmark icon to save your favorites here.
            </p>
            <Link href="/browse" className="btn-primary">
              Find Pros
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {savedBarbers.map((barber) => (
              <div key={barber.id} className="relative group">
                <BarberCard
                  id={barber.id}
                  name={barber.name}
                  rating={barber.rating}
                  reviewCount={barber.reviewCount}
                  location={barber.location}
                  type={barber.type}
                  startingPrice={barber.startingPrice}
                  specialties={barber.specialties}
                  matchPercent={barber.matchPercent}
                  heroImage={barber.heroImage}
                />
                {/* Remove from favorites */}
                <button
                  onClick={() => removeFavorite(barber.id)}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors z-10 group/btn"
                  title="Remove from saved"
                >
                  <svg className="w-4 h-4 text-[var(--color-accent)] group-hover/btn:text-gray-400 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
