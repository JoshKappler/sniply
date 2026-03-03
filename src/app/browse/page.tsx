"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import BarberCard from "@/components/BarberCard";
import FilterModal from "@/components/FilterModal";
import Navbar from "@/components/Navbar";
import { SkeletonGrid } from "@/components/SkeletonCard";
import MapView, { type MapBarber } from "@/components/MapView";
import type { Barber } from "@/lib/types";
import { apiGetBarbers, apiGetReviews, apiGetAvailability } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

type SortKey = "recommended" | "rating" | "reviews" | "price-low" | "price-high";
type ViewMode = "list" | "map";

interface CustomerProfile {
  hairType: string;
  stylePrefs: string[];
}

interface LocationPin {
  lat: number;
  lng: number;
  label: string;
}

const HAIR_TYPE_MAP: Record<string, string> = {
  straight: "Straight",
  wavy: "Wavy",
  curly: "Curly",
  coily: "Coily",
  kinky: "Kinky",
};

// ── Haversine distance (miles) ─────────────────────────────────────────────
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Geocode via Nominatim (OpenStreetMap, no API key needed) ───────────────
async function geocodeQuery(
  query: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name,
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      throw new Error("timeout");
    }
  }
  return null;
}

function computeMatchPercent(barber: Barber, profile: CustomerProfile | null): number | undefined {
  if (!profile) return undefined;
  const { hairType, stylePrefs = [] } = profile;
  const mappedHair = HAIR_TYPE_MAP[hairType] ?? null;
  const hairMatch = mappedHair
    ? barber.hairTypes.some((ht) => ht.toLowerCase() === mappedHair.toLowerCase())
    : null;
  const matchedStyles = stylePrefs.filter((pref) =>
    barber.specialties.some(
      (spec) =>
        spec.toLowerCase().includes(pref.toLowerCase()) ||
        pref.toLowerCase().includes(spec.toLowerCase())
    )
  ).length;
  if (stylePrefs.length === 0 && hairMatch === null) return undefined;
  if (stylePrefs.length === 0) return hairMatch ? 70 : 30;
  if (hairMatch === null) return Math.round((matchedStyles / stylePrefs.length) * 100);
  return Math.min(100, (hairMatch ? 40 : 0) + Math.round((matchedStyles / stylePrefs.length) * 60));
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Top Rated" },
  { value: "reviews", label: "Most Reviews" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
];

function getSortLabel(opt: { value: SortKey; label: string }, hasProfile: boolean): string {
  if (opt.value === "recommended" && !hasProfile) return "Top Rated";
  return opt.label;
}

const PAGE_SIZE = 9;
const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

// ── Next-available helpers ─────────────────────────────────────────────────
// IDs of seed barbers that use demo availability (not user-created)
const STATIC_BARBER_IDS = new Set(
  Array.from({ length: 22 }, (_, i) => String(i + 1))
);

function isoKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function demoFirstSlot(barberId: string, date: Date): string | null {
  const seed = barberId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const dow = date.getDay();
  const dayOff = (seed % 6) + 1;
  if (dow === 0 || dow === dayOff) return null;
  const variation = (seed + dow) % 4;
  return (["9:00 AM", "10:00 AM", "8:00 AM", "9:00 AM"] as const)[variation];
}

function computeNextAvail(barberId: string, preloadedAvail?: Record<string, unknown[]>): string | undefined {
  const isStatic = STATIC_BARBER_IDS.has(barberId);
  const availData: Record<string, unknown[]> = preloadedAvail ?? {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 0; d <= 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    let hasSlots = false;
    let firstSlot: string | null = null;
    if (isStatic) {
      firstSlot = demoFirstSlot(barberId, date);
      hasSlots = firstSlot !== null;
    } else {
      const blocks = availData[isoKey(date)];
      hasSlots = Array.isArray(blocks) && blocks.length > 0;
    }
    if (!hasSlots) continue;
    if (d === 0) return `Today${firstSlot ? ` ${firstSlot}` : ""}`;
    if (d === 1) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return undefined;
}

function applyFilters(pool: Barber[], search: string, activeFilters: Record<string, string[]>): Barber[] {
  let result = pool;
  const profileType = (activeFilters.profileType || [])[0];
  if (profileType === "Independent") result = result.filter((b) => b.type === "independent");
  else if (profileType === "Shop") result = result.filter((b) => b.type === "shop");

  const specFilters = activeFilters.specialty || [];
  if (specFilters.length > 0) {
    result = result.filter((b) =>
      specFilters.some((fs) =>
        b.specialties.some(
          (bs) =>
            bs.toLowerCase().includes(fs.toLowerCase()) ||
            fs.toLowerCase().includes(bs.toLowerCase())
        )
      )
    );
  }

  const hairFilters = activeFilters.hairType || [];
  if (hairFilters.length > 0) {
    result = result.filter((b) =>
      hairFilters.some((hf) => b.hairTypes.some((bh) => bh.toLowerCase() === hf.toLowerCase()))
    );
  }

  const priceFilter = (activeFilters.price || [])[0];
  if (priceFilter) {
    result = result.filter((b) => {
      const p = b.startingPrice;
      if (priceFilter === "Under $30") return p < 30;
      if (priceFilter === "$30–$60") return p >= 30 && p <= 60;
      if (priceFilter === "$60–$100") return p > 60 && p <= 100;
      if (priceFilter === "$100+") return p > 100;
      return true;
    });
  }

  const ratingFilter = (activeFilters.rating || [])[0];
  if (ratingFilter) {
    result = result.filter((b) => {
      if (ratingFilter === "4+ stars") return b.rating >= 4;
      if (ratingFilter === "4.5+ stars") return b.rating >= 4.5;
      if (ratingFilter === "5 stars only") return b.rating >= 5;
      return true;
    });
  }

  const langFilters = activeFilters.languages || [];
  if (langFilters.length > 0) {
    result = result.filter((b) => langFilters.some((lf) => b.languages.includes(lf)));
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        b.specialties.some((s) => s.toLowerCase().includes(q))
    );
  }

  return result;
}

function applySort(pool: Barber[], sortKey: SortKey): Barber[] {
  const sorted = [...pool];
  switch (sortKey) {
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "reviews":
      return sorted.sort((a, b) => b.reviewCount - a.reviewCount);
    case "price-low":
      return sorted.sort((a, b) => a.startingPrice - b.startingPrice);
    case "price-high":
      return sorted.sort((a, b) => b.startingPrice - a.startingPrice);
    default:
      return sorted.sort((a, b) => {
        const matchDiff = (b.matchPercent ?? 0) - (a.matchPercent ?? 0);
        if (matchDiff !== 0) return matchDiff;
        return b.rating - a.rating;
      });
  }
}

const BROWSE_SESSION_KEY = "sniply_browse_state";

function loadBrowseState() {
  try {
    const raw = sessionStorage.getItem(BROWSE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      search: string;
      sortBy: SortKey;
      activeFilters: Record<string, string[]>;
      locationQuery: string;
      locationPin: LocationPin | null;
      userGpsPin: { lat: number; lng: number } | null;
      searchRadius: number;
      viewMode: ViewMode;
    };
  } catch { return null; }
}

function BrowseContent() {
  const savedState = (() => { try { return loadBrowseState(); } catch { return null; } })();

  const [search, setSearch] = useState(savedState?.search ?? "");
  const [sortBy, setSortBy] = useState<SortKey>(savedState?.sortBy ?? "recommended");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(savedState?.activeFilters ?? {});
  const [allBarbers, setAllBarbers] = useState<Barber[]>([]);
  const [reviewOverrides, setReviewOverrides] = useState<Record<string, { rating: number; count: number }>>({});
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [nextAvailMap, setNextAvailMap] = useState<Record<string, string>>({});

  // Map / location state (restored from session)
  const [viewMode, setViewMode] = useState<ViewMode>(savedState?.viewMode ?? "list");
  const [locationQuery, setLocationQuery] = useState(savedState?.locationQuery ?? "");
  const [locationPin, setLocationPin] = useState<LocationPin | null>(savedState?.locationPin ?? null);
  const [userGpsPin, setUserGpsPin] = useState<{ lat: number; lng: number } | null>(savedState?.userGpsPin ?? null);
  const [searchRadius, setSearchRadius] = useState<number>(savedState?.searchRadius ?? 10);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Persist browse state to sessionStorage whenever key state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(BROWSE_SESSION_KEY, JSON.stringify({
        search, sortBy, activeFilters, locationQuery, locationPin, userGpsPin, searchRadius, viewMode,
      }));
    } catch {}
  }, [search, sortBy, activeFilters, locationQuery, locationPin, userGpsPin, searchRadius, viewMode]);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setUserRole(user.role);
      // Customer prefs are stored on the user object (Phase 5+) or in legacy localStorage
      if (user.hairType || user.stylePrefs?.length) {
        setCustomerProfile({ hairType: user.hairType ?? "", stylePrefs: user.stylePrefs ?? [] });
      } else {
        try {
          const profileRaw = localStorage.getItem("sniply_customer_profile");
          if (profileRaw) {
            const p = JSON.parse(profileRaw);
            setCustomerProfile({ hairType: p.hairType || "", stylePrefs: p.stylePrefs || [] });
          }
        } catch {}
      }
    }
    // Load all barbers from API (seed + user-created pros)
    apiGetBarbers()
      .then(({ barbers }) => { setAllBarbers(barbers); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!allBarbers.length) return;
    // Load review overrides from API to show accurate ratings including new reviews
    const overrides: Record<string, { rating: number; count: number }> = {};
    Promise.all(
      allBarbers.map((barber) =>
        apiGetReviews(barber.id).then((stored) => {
          if (!stored.length) return;
          const staticReviews = barber.reviews ?? [];
          const allRevs = [...stored, ...staticReviews];
          const rating = Math.round((allRevs.reduce((s, r) => s + r.rating, 0) / allRevs.length) * 10) / 10;
          overrides[barber.id] = { rating, count: allRevs.length };
        }).catch(() => {})
      )
    ).then(() => setReviewOverrides({ ...overrides }));
  }, [allBarbers]);

  const barbersWithMatch = useMemo(
    () => allBarbers.map((b) => ({ ...b, matchPercent: computeMatchPercent(b, customerProfile) })),
    [allBarbers, customerProfile]
  );

  // Apply location radius filter
  const locationFiltered = useMemo(() => {
    if (!locationPin) return barbersWithMatch;
    return barbersWithMatch.filter((b) => {
      if (b.lat == null || b.lng == null) return false;
      return haversineDistance(locationPin.lat, locationPin.lng, b.lat, b.lng) <= searchRadius;
    });
  }, [barbersWithMatch, locationPin, searchRadius]);

  const filtered = useMemo(
    () => applyFilters(locationFiltered, search, activeFilters),
    [locationFiltered, search, activeFilters]
  );

  const sorted = useMemo(() => applySort(filtered, sortBy), [filtered, sortBy]);

  useEffect(() => {
    if (loading) return;
    const userCreated = allBarbers.filter((b) => !STATIC_BARBER_IDS.has(b.id));
    // Fetch availability for user-created pros, then compute all next-avail labels
    Promise.all(
      userCreated.map((b) =>
        apiGetAvailability(b.id).then((data) => ({ id: b.id, data })).catch(() => ({ id: b.id, data: {} as Record<string, unknown[]> }))
      )
    ).then((results) => {
      const availCache = Object.fromEntries(results.map(({ id, data }) => [id, data as Record<string, unknown[]>]));
      const map: Record<string, string> = {};
      for (const barber of allBarbers) {
        const label = computeNextAvail(barber.id, availCache[barber.id]);
        if (label) map[barber.id] = label;
      }
      setNextAvailMap(map);
    });
  }, [allBarbers, loading]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, activeFilters, sortBy, locationPin, searchRadius]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;
  const filterCount = Object.values(activeFilters).flat().length;

  const activeEntries = Object.entries(activeFilters).flatMap(([k, vals]) =>
    vals.map((v) => ({ key: k, val: v }))
  );

  const removeFilter = (key: string, val: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev, [key]: (prev[key] || []).filter((v) => v !== val) };
      if (next[key].length === 0) delete next[key];
      return next;
    });
  };

  // ── Location helpers ───────────────────────────────────────────────────
  const handleGeoSearch = async (query: string) => {
    if (!query.trim()) return;
    setGeocoding(true);
    setGeoError(null);
    try {
      const result = await geocodeQuery(query);
      setGeocoding(false);
      if (result) {
        setLocationPin(result);
        setLocationQuery(result.label);
        if (viewMode === "list") setViewMode("map");
      } else {
        setGeoError("Location not found. Try a different city, zip code, or address.");
      }
    } catch (err) {
      setGeocoding(false);
      if ((err as Error).message === "timeout") {
        setGeoError("Location search timed out. Check your connection and try again.");
      } else {
        setGeoError("Location not found. Try a different city, zip code, or address.");
      }
    }
  };

  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGpsPin(pin);
        setLocationPin({ ...pin, label: "My Location" });
        setLocationQuery("My Location");
        setGeocoding(false);
        if (viewMode === "list") setViewMode("map");
      },
      () => {
        setGeocoding(false);
        setGeoError("Could not get your location. Please enable location access and try again.");
      }
    );
  };

  const clearLocation = () => {
    setLocationPin(null);
    setUserGpsPin(null);
    setLocationQuery("");
    setGeoError(null);
  };

  // Build MapBarber list (only barbers that have coordinates)
  const mapBarbers: MapBarber[] = useMemo(
    () =>
      sorted
        .filter((b) => b.lat != null && b.lng != null)
        .map((b) => ({
          id: b.id,
          name: b.name,
          location: b.location,
          rating: b.rating,
          reviewCount: b.reviewCount,
          startingPrice: b.startingPrice,
          type: b.type,
          lat: b.lat!,
          lng: b.lng!,
        })),
    [sorted]
  );

  return (
    <div className="min-h-screen bg-[#d6e4f7]">
      <Navbar />

      {/* Unified search sticky bar */}
      <div className="sticky top-[68px] z-30 bg-[#e4edf8] border-b border-[#2E4A8B]/15">
        <div className="max-w-[1200px] mx-auto px-6 py-3">
          <div className="flex items-center gap-3">

            {/* ── Unified search bar ─────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex items-stretch h-[44px] rounded-xl border border-[#2E4A8B]/15 bg-white overflow-hidden transition-colors focus-within:border-[#2E4A8B]">

              {/* Left: keyword — name / specialty / style */}
              <div className="flex items-center px-3 gap-2 flex-1 min-w-0">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Name, specialty, or style…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 text-sm bg-transparent focus:outline-none min-w-0 placeholder-gray-400 text-gray-900"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="shrink-0 text-gray-400 hover:text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="self-stretch w-px bg-gray-200 my-2 shrink-0" />

              {/* Right: location — GPS + text input + radius (when active) */}
              <div className="flex items-center px-2 gap-1.5 flex-1 min-w-0">
                {/* GPS button */}
                <button
                  onClick={handleGetGps}
                  disabled={geocoding}
                  title="Use my current location"
                  className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                    userGpsPin
                      ? "bg-[#2E4A8B] text-white"
                      : "text-gray-400 hover:text-[#2E4A8B]"
                  }`}
                >
                  {geocoding ? (
                    <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>

                {/* Location text input */}
                <input
                  type="text"
                  placeholder="City, zip, or address…"
                  value={locationQuery}
                  onChange={(e) => { setLocationQuery(e.target.value); setGeoError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleGeoSearch(locationQuery)}
                  className="flex-1 text-sm bg-transparent focus:outline-none min-w-0 placeholder-gray-400 text-gray-900"
                />

                {locationQuery && (
                  <button onClick={clearLocation} className="shrink-0 text-gray-400 hover:text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}

                {/* Radius selector — only when a location is active */}
                {locationPin && (
                  <>
                    <div className="self-stretch w-px bg-gray-200 my-2 shrink-0" />
                    <div className="relative shrink-0">
                      <select
                        value={searchRadius}
                        onChange={(e) => setSearchRadius(Number(e.target.value))}
                        className="appearance-none h-8 pl-2 pr-6 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:border-[#2E4A8B] cursor-pointer"
                      >
                        {RADIUS_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r} mi</option>
                        ))}
                      </select>
                      <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </>
                )}
              </div>

              {/* Blue search button (right edge — triggers location geocoding) */}
              <button
                onClick={() => handleGeoSearch(locationQuery)}
                disabled={geocoding || !locationQuery.trim()}
                className="shrink-0 self-stretch px-5 bg-[#2E4A8B] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#243A6F] transition-colors"
              >
                Search
              </button>
            </div>

            {/* Sort dropdown */}
            <div className="relative shrink-0 hidden sm:block">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="appearance-none h-[44px] pl-4 pr-9 rounded-xl border border-[#2E4A8B]/15 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:border-[#2E4A8B] focus:ring-2 focus:ring-[#2E4A8B]/20 cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{getSortLabel(o, !!customerProfile)}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Filters button */}
            <button
              onClick={() => setFilterOpen(true)}
              className={`flex items-center gap-2 px-4 h-[44px] rounded-xl border text-sm font-semibold transition-all shrink-0 ${
                filterCount > 0
                  ? "bg-[#2E4A8B] text-white border-[#2E4A8B] hover:bg-[#243A6F]"
                  : "bg-white text-gray-700 border-[#2E4A8B]/15 hover:border-[#2E4A8B]/40 hover:text-gray-900"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-6 9v5h-6v-5L3 4z" />
              </svg>
              Filters
              {filterCount > 0 && (
                <span className="bg-white text-[#2E4A8B] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                  {filterCount}
                </span>
              )}
            </button>

            {/* List / Map toggle */}
            <div className="flex shrink-0 rounded-xl border border-[#2E4A8B]/15 overflow-hidden h-[44px]">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-4 text-sm font-semibold transition-colors ${
                  viewMode === "list"
                    ? "bg-[#2E4A8B] text-white"
                    : "bg-white text-gray-600 hover:bg-[#e4edf8]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
              <div className="w-px bg-gray-200" />
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-4 text-sm font-semibold transition-colors ${
                  viewMode === "map"
                    ? "bg-[#2E4A8B] text-white"
                    : "bg-white text-gray-600 hover:bg-[#e4edf8]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Active filter pills */}
      {activeEntries.length > 0 && (
        <div className="bg-[#e4edf8] border-b border-[#2E4A8B]/15">
          <div className="max-w-[1200px] mx-auto px-6 py-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium shrink-0">Active:</span>
            {activeEntries.map(({ key, val }) => (
              <button
                key={`${key}-${val}`}
                onClick={() => removeFilter(key, val)}
                className="flex items-center gap-1.5 bg-[#2E4A8B]/10 text-[#2E4A8B] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#2E4A8B]/20 transition-colors"
              >
                {val}
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            ))}
            <button
              onClick={() => setActiveFilters({})}
              className="text-xs text-gray-400 hover:text-gray-700 ml-1 font-medium"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-[1200px] mx-auto px-6 py-8">

        {/* Geocoding error */}
        {geoError && (
          <div className="mb-5 flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{geoError}</p>
          </div>
        )}

        {/* Profile banners */}
        {!loading && userRole === "customer" && !customerProfile && !bannerDismissed && (
          <div className="mb-6 flex items-center gap-3 bg-[#2E4A8B]/6 border border-[#2E4A8B]/20 rounded-xl px-5 py-3.5">
            <svg className="w-5 h-5 text-[#2E4A8B] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#2E4A8B] flex-1">
              Get personalized matches →{" "}
              <Link href="/customer/profile-setup" className="font-semibold underline underline-offset-2 hover:opacity-80">
                Complete your hair profile
              </Link>
            </p>
            <button onClick={() => setBannerDismissed(true)} className="text-[#2E4A8B]/50 hover:text-[#2E4A8B] transition-colors shrink-0" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        {!loading && userRole === "customer" && customerProfile && (customerProfile.stylePrefs?.length ?? 0) === 0 && !bannerDismissed && (
          <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <p className="text-sm text-amber-700 flex-1">
              Add style preferences for better matches →{" "}
              <Link href="/customer/profile-setup" className="font-semibold underline underline-offset-2 hover:opacity-80">
                Update your profile
              </Link>
            </p>
            <button onClick={() => setBannerDismissed(true)} className="text-amber-400 hover:text-amber-600 transition-colors shrink-0" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonGrid count={9} />
        ) : (
          <>
            {/* Results count + clear */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{sorted.length}</span>{" "}
                {sorted.length === 1 ? "pro" : "pros"} found
                {locationPin && (
                  <span className="text-gray-400"> · within {searchRadius} mi</span>
                )}
                {(search || filterCount > 0) && (
                  <button
                    onClick={() => { setSearch(""); setActiveFilters({}); }}
                    className="ml-3 text-[#2E4A8B] font-medium hover:underline"
                  >
                    Clear search & filters
                  </button>
                )}
              </p>
              {/* Mobile sort */}
              <div className="relative sm:hidden">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-[#2E4A8B]/15 text-xs font-medium text-gray-700 bg-white focus:outline-none cursor-pointer"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{getSortLabel(o, !!customerProfile)}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* ── MAP VIEW ─────────────────────────────────────────────── */}
            {viewMode === "map" && (
              <div className="mb-8">
                <div style={{ height: "520px" }}>
                  <MapView
                    barbers={mapBarbers}
                    center={locationPin ? { lat: locationPin.lat, lng: locationPin.lng } : null}
                    userPin={userGpsPin}
                  />
                </div>
                {sorted.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Showing {mapBarbers.length} mapped pro{mapBarbers.length !== 1 ? "s" : ""} · Click a pin to see details
                  </p>
                )}
              </div>
            )}

            {/* ── GRID (shown in both modes) ──────────────────────────── */}
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  {locationPin && filterCount === 0 && !search ? (
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : filterCount > 0 ? (
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
                <h3 className="font-heading font-bold text-gray-900 text-xl mb-2">
                  {locationPin && filterCount === 0 && !search
                    ? "No pros in this area"
                    : filterCount > 0
                    ? "No pros match these filters"
                    : "No pros match your search"}
                </h3>
                <p className="text-gray-500 mb-6 max-w-sm">
                  {locationPin && filterCount === 0 && !search
                    ? `No barbers found within ${searchRadius} miles. Try expanding your radius.`
                    : locationPin
                    ? "Try removing some filters or expanding your search radius."
                    : filterCount > 0
                    ? "Try removing a filter or two — your perfect match might be just outside these criteria."
                    : "Try a different name, specialty, or location."}
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  {locationPin && (
                    <button onClick={clearLocation} className="btn-secondary">
                      Clear Location
                    </button>
                  )}
                  {(filterCount > 0 || search) && (
                    <button
                      onClick={() => { setSearch(""); setActiveFilters({}); }}
                      className="btn-secondary"
                    >
                      Clear Filters
                    </button>
                  )}
                  <button
                    onClick={() => { setSearch(""); setActiveFilters({}); clearLocation(); }}
                    className="btn-primary"
                  >
                    Show All Pros
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visible.map((barber) => {
                    const override = reviewOverrides[barber.id];
                    const dist = locationPin && barber.lat != null && barber.lng != null
                      ? haversineDistance(locationPin.lat, locationPin.lng, barber.lat, barber.lng)
                      : undefined;
                    return (
                      <BarberCard
                        key={barber.id}
                        id={barber.id}
                        name={barber.name}
                        rating={override?.rating ?? barber.rating}
                        reviewCount={override?.count ?? barber.reviewCount}
                        location={barber.location}
                        type={barber.type}
                        startingPrice={barber.startingPrice}
                        specialties={barber.specialties}
                        matchPercent={barber.matchPercent}
                        heroImage={barber.heroImage}
                        nextAvailable={nextAvailMap[barber.id]}
                        distance={dist}
                        isNew={barber.isNew}
                      />
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="text-center mt-12">
                    <button
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="btn-secondary"
                      style={{ minWidth: "200px" }}
                    >
                      Load More ({sorted.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {filterOpen && (
        <FilterModal
          onClose={() => setFilterOpen(false)}
          onApply={(f) => { setActiveFilters(f); setFilterOpen(false); }}
          initialFilters={activeFilters}
        />
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#d6e4f7]">
        <div className="max-w-[1200px] mx-auto px-6 py-8 mt-[144px]">
          <SkeletonGrid count={9} />
        </div>
      </div>
    }>
      <BrowseContent />
    </Suspense>
  );
}
