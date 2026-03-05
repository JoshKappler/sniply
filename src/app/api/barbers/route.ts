import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, rowToBarber, rowToShop, pool } from "@/lib/db";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";
import type { Barber } from "@/lib/types";
import { randomUUID } from "crypto";

export async function GET() {
  const [barberRows, shopRows] = await Promise.all([
    query(`SELECT * FROM barbers ORDER BY id`),
    query(`SELECT * FROM shops ORDER BY id`),
  ]);
  return NextResponse.json({
    barbers: barberRows.map(rowToBarber),
    shops: shopRows.map(rowToShop),
  });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.role !== "pro") return forbidden();

  // Prevent duplicate barber profiles for the same authenticated user
  const user = await queryOne<{ profile_id: string | null }>(
    `SELECT profile_id FROM users WHERE id = $1`,
    [session.userId]
  );
  if (user?.profile_id) {
    const existingBarber = await queryOne(`SELECT id FROM barbers WHERE id = $1`, [user.profile_id]);
    if (existingBarber) {
      return NextResponse.json({ error: "Barber profile already exists" }, { status: 409 });
    }
    // stale profile_id — barber is gone, allow recreation
  }

  const body = await req.json() as Omit<Barber, "id">;
  const id = randomUUID();

  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO barbers (
         id, name, username, rating, review_count, location, full_address,
         lat, lng, type, shop_id, shop_name, starting_price, specialties, hair_types,
         bio, experience, languages, hero_image, profile_image,
         portfolio_images, services, credentials
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        id, body.name, body.username ?? null, body.rating ?? 0, body.reviewCount ?? 0,
        body.location ?? null, body.fullAddress ?? null, body.lat ?? null, body.lng ?? null,
        body.type ?? "independent", body.shopId ?? null, body.shopName ?? null, body.startingPrice ?? 0,
        body.specialties ?? [], body.hairTypes ?? [], body.bio ?? null, body.experience ?? null,
        body.languages ?? [], body.heroImage ?? null, body.profileImage ?? null,
        body.portfolioImages ?? [], JSON.stringify(body.services ?? []),
        JSON.stringify(body.credentials ?? []),
      ]
    );
    await client.query(`UPDATE users SET profile_id = $1 WHERE id = $2`, [id, session.userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const row = await queryOne(`SELECT * FROM barbers WHERE id = $1`, [id]);
  return NextResponse.json(rowToBarber(row!), { status: 201 });
}
