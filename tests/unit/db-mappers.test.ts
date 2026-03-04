import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock pg so importing db.ts never tries to connect
vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({ query: vi.fn() })),
}));

// Mock fs to avoid reading data-seed at import time
vi.mock("fs", () => ({
  default: { readFileSync: vi.fn().mockReturnValue('{"barbers":[],"shops":[]}') },
  readFileSync: vi.fn().mockReturnValue('{"barbers":[],"shops":[]}'),
}));

import {
  rowToUser,
  rowToBarber,
  rowToShop,
  rowToBooking,
  rowToReview,
  rowToThread,
  rowToCustomerThread,
  rowToBusinessHours,
  rowToNotifPrefs,
} from "@/lib/db";

describe("rowToUser", () => {
  it("maps all basic fields", () => {
    const row = {
      id: "u1",
      username: "alice",
      password: "hashed",
      name: "Alice",
      role: "customer",
      profile_id: null,
      avatar: null,
      hair_type: "curly",
      hair_subtype: null,
      hair_texture: "coarse",
      hair_color: "black",
      style_prefs: ["fades", "tapers"],
      concerns: ["dryness"],
      notes: "no notes",
      gender: "female",
      location: "Atlanta, GA",
    };
    const user = rowToUser(row);
    expect(user.id).toBe("u1");
    expect(user.username).toBe("alice");
    expect(user.role).toBe("customer");
    expect(user.hairType).toBe("curly");
    expect(user.stylePrefs).toEqual(["fades", "tapers"]);
    expect(user.concerns).toEqual(["dryness"]);
    expect(user.location).toBe("Atlanta, GA");
  });

  it("leaves optional fields as undefined when null", () => {
    const row = { id: "u2", username: "bob", password: "pw", name: "Bob", role: "pro",
      profile_id: null, avatar: null, hair_type: null, hair_subtype: null,
      hair_texture: null, hair_color: null, style_prefs: null, concerns: null,
      notes: null, gender: null, location: null };
    const user = rowToUser(row);
    expect(user.hairType).toBeUndefined();
    expect(user.stylePrefs).toBeUndefined();
    expect(user.profileId).toBeUndefined();
  });

  it("maps profileId from profile_id column", () => {
    const row = { id: "u3", username: "pro1", password: "pw", name: "Pro",
      role: "pro", profile_id: "barber-9", avatar: null, hair_type: null,
      hair_subtype: null, hair_texture: null, hair_color: null,
      style_prefs: null, concerns: null, notes: null, gender: null, location: null };
    expect(rowToUser(row).profileId).toBe("barber-9");
  });
});

describe("rowToBarber", () => {
  const baseRow = {
    id: "b1", name: "Marcus", username: "marcus", rating: "4.8",
    review_count: "12", location: "Atlanta, GA", full_address: "123 Peach St",
    lat: "33.749", lng: "-84.388", type: "independent", shop_id: null,
    starting_price: "40", specialties: ["Fades", "Tapers"],
    hair_types: ["Curly", "Coily"], bio: "Expert barber", experience: "5 years",
    languages: ["English", "Spanish"], hero_image: "https://ex.com/hero.jpg",
    profile_image: "https://ex.com/profile.jpg", portfolio_images: ["img1"],
    services: [{ name: "Fade", description: "", duration: 30, price: 40 }],
    credentials: [],
  };

  it("maps all fields with correct types", () => {
    const barber = rowToBarber(baseRow);
    expect(barber.id).toBe("b1");
    expect(barber.rating).toBe(4.8);
    expect(barber.reviewCount).toBe(12);
    expect(barber.lat).toBe(33.749);
    expect(barber.lng).toBe(-84.388);
    expect(barber.startingPrice).toBe(40);
    expect(barber.specialties).toEqual(["Fades", "Tapers"]);
    expect(barber.hairTypes).toEqual(["Curly", "Coily"]);
    expect(barber.type).toBe("independent");
    expect(barber.reviews).toEqual([]); // always empty from DB mapper
  });

  it("returns undefined for lat/lng when null", () => {
    const barber = rowToBarber({ ...baseRow, lat: null, lng: null });
    expect(barber.lat).toBeUndefined();
    expect(barber.lng).toBeUndefined();
  });

  it("defaults to empty arrays when columns are null", () => {
    const barber = rowToBarber({ ...baseRow, specialties: null, hair_types: null,
      languages: null, portfolio_images: null, services: null, credentials: null });
    expect(barber.specialties).toEqual([]);
    expect(barber.hairTypes).toEqual([]);
    expect(barber.languages).toEqual([]);
    expect(barber.portfolioImages).toEqual([]);
    expect(barber.services).toEqual([]);
    expect(barber.credentials).toEqual([]);
  });
});

describe("rowToShop", () => {
  it("maps all fields", () => {
    const shop = rowToShop({ id: "s1", name: "Cuts R Us", address: "1 Main", city: "NYC", image: "img.jpg" });
    expect(shop).toEqual({ id: "s1", name: "Cuts R Us", address: "1 Main", city: "NYC", image: "img.jpg" });
  });

  it("defaults address/city/image to empty string when null", () => {
    const shop = rowToShop({ id: "s2", name: "Shop", address: null, city: null, image: null });
    expect(shop.address).toBe("");
    expect(shop.city).toBe("");
    expect(shop.image).toBe("");
  });
});

describe("rowToBooking", () => {
  const baseRow = {
    id: "book1", barber_id: "b1", barber_name: "Marcus", barber_image: "img",
    user_id: "u1", user_name: "Alice", service: "Fade", date: "2026-03-10",
    time: "10:00 AM", end_time: "10:30 AM", price: 40, duration: 30,
    status: "upcoming", cancelled: false, created_at: "2026-03-01T00:00:00Z", notes: "none",
  };

  it("maps all fields with correct types", () => {
    const booking = rowToBooking(baseRow);
    expect(booking.id).toBe("book1");
    expect(booking.barberId).toBe("b1");
    expect(booking.price).toBe(40);
    expect(booking.duration).toBe(30);
    expect(booking.status).toBe("upcoming");
    expect(booking.cancelled).toBe(false);
    expect(booking.createdAt).toMatch(/2026-03-01/);
  });

  it("converts status correctly for 'cancelled'", () => {
    const booking = rowToBooking({ ...baseRow, status: "cancelled", cancelled: true });
    expect(booking.status).toBe("cancelled");
    expect(booking.cancelled).toBe(true);
  });
});

describe("rowToReview", () => {
  it("maps all fields", () => {
    const row = { user_id: "u1", user_name: "Alice", rating: 5, text: "Great!",
      date: "2026-01-01", reply: "Thanks!", photos: ["ph1"] };
    const review = rowToReview(row);
    expect(review.userId).toBe("u1");
    expect(review.rating).toBe(5);
    expect(review.reply).toBe("Thanks!");
    expect(review.photos).toEqual(["ph1"]);
  });

  it("leaves reply undefined when null", () => {
    const row = { user_id: "u2", user_name: "Bob", rating: 4, text: "Good",
      date: "2026-01-02", reply: null, photos: [] };
    expect(rowToReview(row).reply).toBeUndefined();
  });
});

describe("rowToThread", () => {
  it("maps all fields", () => {
    const row = {
      thread_id: "t1", customer_id: "u1", customer_name: "Alice",
      preview: "Hey there", ts: "2026-02-01T12:00:00Z", unread: true,
      messages: [{ from: "customer", text: "Hi", time: "12:00 PM" }],
    };
    const thread = rowToThread(row);
    expect(thread.id).toBe("t1");
    expect(thread.customerName).toBe("Alice");
    expect(thread.unread).toBe(true);
    expect(thread.messages).toHaveLength(1);
    expect(thread.timestamp).toMatch(/2026-02-01/);
  });

  it("defaults messages to empty array when null", () => {
    const row = { thread_id: "t2", customer_id: null, customer_name: "Bob",
      preview: "", ts: null, unread: false, messages: null };
    const thread = rowToThread(row);
    expect(thread.messages).toEqual([]);
    expect(thread.customerId).toBeUndefined();
  });
});

describe("rowToCustomerThread", () => {
  it("maps all fields", () => {
    const row = { customer_id: "c1", thread_id: "t1", pro_profile_id: "pro-5",
      pro_name: "Marcus", pro_avatar: "avatar.jpg", last_message: "See you then",
      ts: "2026-01-15T10:00:00Z", unread: false };
    const ref = rowToCustomerThread(row);
    expect(ref.proProfileId).toBe("pro-5");
    expect(ref.proName).toBe("Marcus");
    expect(ref.threadId).toBe("t1");
    expect(ref.unread).toBe(false);
  });
});

describe("rowToBusinessHours", () => {
  it("maps open/close times", () => {
    const bh = rowToBusinessHours({ open_time: "8:00 AM", close_time: "6:00 PM" });
    expect(bh).toEqual({ openTime: "8:00 AM", closeTime: "6:00 PM" });
  });

  it("defaults to 9:00 AM / 5:00 PM when columns are null", () => {
    const bh = rowToBusinessHours({ open_time: null, close_time: null });
    expect(bh.openTime).toBe("9:00 AM");
    expect(bh.closeTime).toBe("5:00 PM");
  });
});

describe("rowToNotifPrefs", () => {
  it("maps all boolean flags", () => {
    const prefs = rowToNotifPrefs({
      user_id: "u1", booking_confirmations: true, booking_reminders: false,
      messages: true, promotions: false,
    });
    expect(prefs).toEqual({
      bookingConfirmations: true,
      bookingReminders: false,
      messages: true,
      promotions: false,
    });
  });

  it("defaults confirmations/reminders/messages to true and promotions to false when null", () => {
    const prefs = rowToNotifPrefs({
      user_id: "u1", booking_confirmations: null, booking_reminders: null,
      messages: null, promotions: null,
    });
    // Implementation: Boolean(null ?? true) = true for most; Boolean(null ?? false) = false for promotions
    expect(prefs.bookingConfirmations).toBe(true);
    expect(prefs.bookingReminders).toBe(true);
    expect(prefs.messages).toBe(true);
    expect(prefs.promotions).toBe(false);
  });
});
