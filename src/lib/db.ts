// Postgres data layer — replaces the old JSON-file db.ts
// Uses a singleton Pool so connections are reused across Next.js hot requests.

import { Pool } from "pg";
import fs from "fs";
import path from "path";
import type { Barber, BarberService, Shop, User, Booking, StoredReview, MessageThread, MessageBubble, CustomerThreadRef, TimeBlock, BusinessHours, NotifPrefs } from "@/lib/types";

// ── Pool ──────────────────────────────────────────────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_URL?.includes("railway.app") ||
        process.env.DATABASE_URL?.includes("rlwy.net") ||
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });
    // Prevent unhandled 'error' events from crashing the Node process when
    // Railway (or any proxy) silently drops an idle connection.
    _pool.on("error", (err) => {
      console.error("[db] idle client error:", err.message);
    });
  }
  return _pool;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function queryOne<T extends object = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const res = await getPool().query(text, params);
  return (res.rows[0] as T) ?? null;
}

// ── Schema (DDL) ──────────────────────────────────────────────────────────────

const DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL,
    profile_id  TEXT,
    avatar      TEXT,
    hair_type   TEXT,
    hair_subtype TEXT,
    hair_texture TEXT,
    hair_color  TEXT,
    style_prefs TEXT[],
    concerns    TEXT[],
    notes       TEXT,
    gender      TEXT,
    location    TEXT
  );

  CREATE TABLE IF NOT EXISTS shops (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    address TEXT,
    city    TEXT,
    image   TEXT
  );

  CREATE TABLE IF NOT EXISTS barbers (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    username         TEXT,
    rating           NUMERIC DEFAULT 0,
    review_count     INT DEFAULT 0,
    location         TEXT,
    full_address     TEXT,
    lat              NUMERIC,
    lng              NUMERIC,
    type             TEXT DEFAULT 'independent',
    shop_id          TEXT,
    starting_price   INT DEFAULT 0,
    specialties      TEXT[],
    hair_types       TEXT[],
    bio              TEXT,
    experience       TEXT,
    languages        TEXT[],
    hero_image       TEXT,
    profile_image    TEXT,
    portfolio_images TEXT[],
    services         JSONB DEFAULT '[]',
    credentials      JSONB DEFAULT '[]',
    shop_name        TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id           TEXT PRIMARY KEY,
    barber_id    TEXT NOT NULL,
    barber_name  TEXT,
    barber_image TEXT,
    user_id      TEXT NOT NULL,
    user_name    TEXT,
    service      TEXT,
    date         TEXT,
    time         TEXT,
    end_time     TEXT,
    price        INT,
    duration     INT,
    status       TEXT DEFAULT 'upcoming',
    cancelled    BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    notes        TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id         SERIAL PRIMARY KEY,
    barber_id  TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    user_name  TEXT,
    rating     INT NOT NULL,
    text       TEXT,
    date       TEXT,
    reply      TEXT,
    photos     TEXT[]
  );

  CREATE TABLE IF NOT EXISTS threads (
    pro_id        TEXT NOT NULL,
    thread_id     TEXT NOT NULL,
    customer_id   TEXT,
    customer_name TEXT NOT NULL,
    preview       TEXT,
    ts            TIMESTAMPTZ,
    unread        BOOLEAN DEFAULT FALSE,
    messages      JSONB DEFAULT '[]',
    PRIMARY KEY (pro_id, thread_id)
  );

  CREATE TABLE IF NOT EXISTS customer_threads (
    customer_id    TEXT NOT NULL,
    thread_id      TEXT NOT NULL,
    pro_profile_id TEXT,
    pro_name       TEXT,
    pro_avatar     TEXT,
    last_message   TEXT,
    ts             TIMESTAMPTZ,
    unread         BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (customer_id, thread_id)
  );

  CREATE TABLE IF NOT EXISTS availability (
    barber_id TEXT PRIMARY KEY,
    slots     JSONB DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS business_hours (
    profile_id TEXT PRIMARY KEY,
    open_time  TEXT,
    close_time TEXT
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id   TEXT NOT NULL,
    barber_id TEXT NOT NULL,
    PRIMARY KEY (user_id, barber_id)
  );

  CREATE TABLE IF NOT EXISTS notif_prefs (
    user_id                TEXT PRIMARY KEY,
    booking_confirmations  BOOLEAN DEFAULT TRUE,
    booking_reminders      BOOLEAN DEFAULT TRUE,
    messages               BOOLEAN DEFAULT TRUE,
    promotions             BOOLEAN DEFAULT FALSE
  );
`;

// ── Migration + seed ──────────────────────────────────────────────────────────

let migrated = false;

export async function migrate(): Promise<void> {
  if (migrated) return;
  const db = getPool();
  await db.query(DDL);
  await db.query(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS shop_name TEXT`);

  const { rows } = await db.query("SELECT COUNT(*) FROM barbers");
  if (parseInt(rows[0].count, 10) === 0) {
    await seedBarbers(db);
  } else {
    await repairBarberImages(db);
  }

  migrated = true;
}

async function repairBarberImages(db: Pool): Promise<void> {
  try {
    const seedPath = path.join(process.cwd(), "data-seed", "barbers.json");
    const raw = fs.readFileSync(seedPath, "utf-8");
    const { barbers } = JSON.parse(raw) as { barbers: Barber[] };

    for (const b of barbers) {
      await db.query(
        `UPDATE barbers
         SET hero_image = $1, profile_image = $2, portfolio_images = $3
         WHERE id = $4
           AND (hero_image != $1 OR profile_image != $2)`,
        [b.heroImage ?? null, b.profileImage ?? null, b.portfolioImages ?? [], b.id]
      );
    }
  } catch (err) {
    console.warn("Sniply: could not repair barber images:", err);
  }
}

async function seedBarbers(db: Pool): Promise<void> {
  try {
    const seedPath = path.join(process.cwd(), "data-seed", "barbers.json");
    const raw = fs.readFileSync(seedPath, "utf-8");
    const { barbers, shops } = JSON.parse(raw) as { barbers: Barber[]; shops: Shop[] };

    for (const shop of shops ?? []) {
      await db.query(
        `INSERT INTO shops (id, name, address, city, image)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [shop.id, shop.name, shop.address ?? null, shop.city ?? null, shop.image ?? null]
      );
    }

    for (const b of barbers) {
      await db.query(
        `INSERT INTO barbers (
           id, name, username, rating, review_count, location, full_address,
           lat, lng, type, shop_id, starting_price, specialties, hair_types,
           bio, experience, languages, hero_image, profile_image,
           portfolio_images, services, credentials
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT DO NOTHING`,
        [
          b.id, b.name, b.username ?? null, b.rating ?? 0, b.reviewCount ?? 0,
          b.location ?? null, b.fullAddress ?? null, b.lat ?? null, b.lng ?? null,
          b.type ?? "independent", b.shopId ?? null, b.startingPrice ?? 0,
          b.specialties ?? [], b.hairTypes ?? [], b.bio ?? null, b.experience ?? null,
          b.languages ?? [], b.heroImage ?? null, b.profileImage ?? null,
          b.portfolioImages ?? [], JSON.stringify(b.services ?? []),
          JSON.stringify(b.credentials ?? []),
        ]
      );

      // Seed embedded reviews
      for (const r of b.reviews ?? []) {
        await db.query(
          `INSERT INTO reviews (barber_id, user_id, user_name, rating, text, date, photos)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [b.id, `seed-${b.id}`, r.name, r.rating, r.text, r.date, []]
        );
      }
    }

    console.log("Sniply: seeded barbers + reviews from data-seed/barbers.json");
  } catch (err) {
    console.warn("Sniply: could not seed barbers:", err);
  }
}

// ── Row → TypeScript mappers ──────────────────────────────────────────────────

type Row = Record<string, unknown>;

export function rowToUser(r: Row): User {
  return {
    id: r.id as string,
    username: r.username as string,
    password: r.password as string,
    name: r.name as string,
    role: r.role as "customer" | "pro",
    profileId: (r.profile_id as string) ?? undefined,
    avatar: (r.avatar as string) ?? undefined,
    hairType: (r.hair_type as string) ?? undefined,
    hairSubtype: (r.hair_subtype as string) ?? undefined,
    hairTexture: (r.hair_texture as string) ?? undefined,
    hairColor: (r.hair_color as string) ?? undefined,
    stylePrefs: (r.style_prefs as string[]) ?? undefined,
    concerns: (r.concerns as string[]) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    gender: (r.gender as string) ?? undefined,
    location: (r.location as string) ?? undefined,
  };
}

export function rowToBarber(r: Row): Barber {
  return {
    id: r.id as string,
    name: r.name as string,
    username: (r.username as string) ?? "",
    rating: Number(r.rating ?? 0),
    reviewCount: Number(r.review_count ?? 0),
    location: (r.location as string) ?? "",
    fullAddress: (r.full_address as string) ?? "",
    lat: r.lat != null ? Number(r.lat) : undefined,
    lng: r.lng != null ? Number(r.lng) : undefined,
    type: (r.type as "independent" | "shop") ?? "independent",
    shopId: (r.shop_id as string) ?? undefined,
    shopName: (r.shop_name as string) ?? undefined,
    startingPrice: Number(r.starting_price ?? 0),
    specialties: (r.specialties as string[]) ?? [],
    hairTypes: (r.hair_types as string[]) ?? [],
    bio: (r.bio as string) ?? "",
    experience: (r.experience as string) ?? "",
    languages: (r.languages as string[]) ?? [],
    heroImage: (r.hero_image as string) ?? "",
    profileImage: (r.profile_image as string) ?? "",
    portfolioImages: (r.portfolio_images as string[]) ?? [],
    services: (r.services as BarberService[]) ?? [],
    reviews: [],
    credentials: (r.credentials as { text: string; fileName?: string; fileData?: string }[]) ?? [],
  };
}

export function rowToShop(r: Row): Shop {
  return {
    id: r.id as string,
    name: r.name as string,
    address: (r.address as string) ?? "",
    city: (r.city as string) ?? "",
    image: (r.image as string) ?? "",
  };
}

export function rowToBooking(r: Row): Booking {
  return {
    id: r.id as string,
    barberId: r.barber_id as string,
    barberName: (r.barber_name as string) ?? "",
    barberImage: (r.barber_image as string) ?? "",
    userId: r.user_id as string,
    userName: (r.user_name as string) ?? undefined,
    service: (r.service as string) ?? "",
    date: ((r.date as string) ?? "").substring(0, 10),
    time: (r.time as string) ?? "",
    endTime: (r.end_time as string) ?? undefined,
    price: Number(r.price ?? 0),
    duration: Number(r.duration ?? 0),
    status: (r.status as "upcoming" | "past" | "cancelled") ?? "upcoming",
    cancelled: Boolean(r.cancelled),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : undefined,
    notes: (r.notes as string) ?? undefined,
  };
}

export function rowToReview(r: Row): StoredReview {
  return {
    id: r.id !== undefined ? Number(r.id) : undefined,
    userId: r.user_id as string,
    userName: (r.user_name as string) ?? "",
    rating: Number(r.rating),
    text: (r.text as string) ?? "",
    date: (r.date as string) ?? "",
    reply: (r.reply as string) ?? undefined,
    photos: (r.photos as string[]) ?? [],
  };
}

export function rowToThread(r: Row): MessageThread {
  return {
    id: r.thread_id as string,
    customerId: (r.customer_id as string) ?? undefined,
    customerName: (r.customer_name as string) ?? "",
    preview: (r.preview as string) ?? "",
    timestamp: r.ts ? new Date(r.ts as string).toISOString() : new Date().toISOString(),
    unread: Boolean(r.unread),
    messages: (r.messages as MessageBubble[]) ?? [],
  };
}

export function rowToCustomerThread(r: Row): CustomerThreadRef {
  return {
    proProfileId: (r.pro_profile_id as string) ?? "",
    proName: (r.pro_name as string) ?? "",
    proAvatar: (r.pro_avatar as string) ?? undefined,
    threadId: r.thread_id as string,
    lastMessage: (r.last_message as string) ?? undefined,
    timestamp: r.ts ? new Date(r.ts as string).toISOString() : new Date().toISOString(),
    unread: Boolean(r.unread),
  };
}

export function rowToBusinessHours(r: Row): BusinessHours {
  return {
    openTime: (r.open_time as string) ?? "9:00 AM",
    closeTime: (r.close_time as string) ?? "5:00 PM",
  };
}

export function rowToNotifPrefs(r: Row): NotifPrefs {
  return {
    bookingConfirmations: Boolean(r.booking_confirmations ?? true),
    bookingReminders: Boolean(r.booking_reminders ?? true),
    messages: Boolean(r.messages ?? true),
    promotions: Boolean(r.promotions ?? false),
  };
}

// Re-export pool getter for routes that need raw access
export { getPool as pool };

// Keep TimeBlock + availability helper for the availability route
export type { TimeBlock };
