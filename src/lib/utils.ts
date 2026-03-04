import type { Barber } from "@/lib/types";

export interface CustomerProfile {
  hairType: string;
  stylePrefs: string[];
}

const HAIR_TYPE_MAP: Record<string, string> = {
  straight: "Straight",
  wavy: "Wavy",
  curly: "Curly",
  coily: "Coily",
  kinky: "Kinky",
};

/** Haversine great-circle distance in miles. */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

/**
 * Compute a 0–100 match score between a barber and a customer's hair profile.
 * Returns undefined if there is not enough profile data to score.
 * Weighting: hair type 40%, style preferences 60%.
 */
export function computeMatchScore(barber: Barber, profile: CustomerProfile | null): number | undefined {
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
