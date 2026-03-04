import { describe, it, expect } from "vitest";
import { haversineDistance, computeMatchScore } from "@/lib/utils";
import type { Barber } from "@/lib/types";

// Minimal Barber stub — only the fields computeMatchScore uses
function makeBarber(hairTypes: string[], specialties: string[]): Barber {
  return {
    id: "1", name: "Test", username: "test", rating: 5, reviewCount: 0,
    location: "", fullAddress: "", type: "independent", startingPrice: 0,
    hairTypes, specialties, bio: "", experience: "", languages: [],
    heroImage: "", profileImage: "", portfolioImages: [], services: [], reviews: [],
  };
}

describe("haversineDistance", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("returns ~2451 miles between NYC and LAX", () => {
    // NYC: 40.7128, -74.006   LAX: 34.0522, -118.2437
    const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(2440);
    expect(dist).toBeLessThan(2470);
  });

  it("is symmetric — A→B equals B→A", () => {
    const ab = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    const ba = haversineDistance(48.8566, 2.3522, 51.5074, -0.1278);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });
});

describe("computeMatchScore", () => {
  it("returns undefined when profile is null", () => {
    const barber = makeBarber(["Curly"], ["Fades"]);
    expect(computeMatchScore(barber, null)).toBeUndefined();
  });

  it("returns undefined when profile has no hair type and no style prefs", () => {
    const barber = makeBarber(["Curly"], ["Fades"]);
    expect(computeMatchScore(barber, { hairType: "", stylePrefs: [] })).toBeUndefined();
  });

  it("returns 70 when only hair type matches and no style prefs", () => {
    const barber = makeBarber(["Curly"], ["Fades"]);
    expect(computeMatchScore(barber, { hairType: "curly", stylePrefs: [] })).toBe(70);
  });

  it("returns 30 when only hair type does not match and no style prefs", () => {
    const barber = makeBarber(["Straight"], ["Fades"]);
    expect(computeMatchScore(barber, { hairType: "curly", stylePrefs: [] })).toBe(30);
  });

  it("returns 100 for a perfect match (hair type + all styles)", () => {
    const barber = makeBarber(["Curly"], ["Fades", "Tapers"]);
    const score = computeMatchScore(barber, { hairType: "curly", stylePrefs: ["Fades", "Tapers"] });
    expect(score).toBe(100);
  });

  it("returns 40 for hair type match only with style prefs present", () => {
    const barber = makeBarber(["Curly"], ["Box Cuts"]);
    // hair match = true (40pts), styles matched = 0/2 (0pts)
    const score = computeMatchScore(barber, { hairType: "curly", stylePrefs: ["Fades", "Tapers"] });
    expect(score).toBe(40);
  });

  it("returns 0 when no hair type and no style prefs match", () => {
    const barber = makeBarber(["Straight"], ["Box Cuts"]);
    // hairMatch = false (0pts), styles matched = 0/2 (0pts)
    const score = computeMatchScore(barber, { hairType: "curly", stylePrefs: ["Fades", "Tapers"] });
    expect(score).toBe(0);
  });

  it("uses style-only score when hair type is unknown", () => {
    const barber = makeBarber(["Curly"], ["Fades"]);
    // hairType "unknown" → not in HAIR_TYPE_MAP → hairMatch is null
    // only style score = 1/1 * 100 = 100
    const score = computeMatchScore(barber, { hairType: "unknown", stylePrefs: ["Fades"] });
    expect(score).toBe(100);
  });

  it("is capped at 100", () => {
    const barber = makeBarber(["Curly"], ["Fades", "Tapers", "Waves"]);
    const score = computeMatchScore(barber, { hairType: "curly", stylePrefs: ["Fades", "Tapers", "Waves"] });
    expect(score).toBeLessThanOrEqual(100);
  });
});
