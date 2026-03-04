import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToBarber, pool } from "@/lib/db";
import type { Barber } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await queryOne(`SELECT * FROM barbers WHERE id = $1`, [id]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rowToBarber(row));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.role !== "pro") return forbidden();

  // Verify this pro owns the barber profile
  const owner = await queryOne(
    `SELECT profile_id FROM users WHERE id = $1`,
    [session.userId]
  );
  if (!owner || owner.profile_id !== id) return forbidden();

  const existing = await queryOne(`SELECT * FROM barbers WHERE id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as Partial<Barber>;
  const merged: Barber = { ...rowToBarber(existing), ...body };

  await pool().query(
    `UPDATE barbers SET
       name             = $2, username         = $3, rating           = $4,
       review_count     = $5, location         = $6, full_address     = $7,
       lat              = $8, lng              = $9, type             = $10,
       shop_id          = $11, starting_price  = $12, specialties     = $13,
       hair_types       = $14, bio             = $15, experience      = $16,
       languages        = $17, hero_image      = $18, profile_image   = $19,
       portfolio_images = $20, services        = $21, credentials     = $22
     WHERE id = $1`,
    [
      id,
      merged.name, merged.username ?? null, merged.rating ?? 0, merged.reviewCount ?? 0,
      merged.location ?? null, merged.fullAddress ?? null, merged.lat ?? null, merged.lng ?? null,
      merged.type ?? "independent", merged.shopId ?? null, merged.startingPrice ?? 0,
      merged.specialties ?? [], merged.hairTypes ?? [], merged.bio ?? null,
      merged.experience ?? null, merged.languages ?? [], merged.heroImage ?? null,
      merged.profileImage ?? null, merged.portfolioImages ?? [],
      JSON.stringify(merged.services ?? []), JSON.stringify(merged.credentials ?? []),
    ]
  );

  const row = await queryOne(`SELECT * FROM barbers WHERE id = $1`, [id]);
  return NextResponse.json(rowToBarber(row!));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.role !== "pro") return forbidden();

  // Verify this pro owns the barber profile
  const owner = await queryOne(
    `SELECT profile_id FROM users WHERE id = $1`,
    [session.userId]
  );
  if (!owner || owner.profile_id !== id) return forbidden();

  const existing = await queryOne(`SELECT id FROM barbers WHERE id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await pool().query(`DELETE FROM barbers WHERE id = $1`, [id]);
  return NextResponse.json({ success: true });
}
