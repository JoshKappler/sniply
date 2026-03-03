import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToUser, pool } from "@/lib/db";
import type { User } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await queryOne(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rowToUser(row));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== id) return forbidden();

  const existing = await queryOne(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as Partial<User>;
  const merged: User = { ...rowToUser(existing), ...body };

  await pool().query(
    `UPDATE users SET
       username     = $2, password    = $3, name        = $4, role        = $5,
       profile_id   = $6, avatar      = $7, hair_type   = $8, hair_subtype = $9,
       hair_texture = $10, hair_color = $11, style_prefs = $12, concerns   = $13,
       notes        = $14, gender     = $15, location    = $16
     WHERE id = $1`,
    [
      id,
      merged.username, merged.password, merged.name, merged.role,
      merged.profileId ?? null, merged.avatar ?? null,
      merged.hairType ?? null, merged.hairSubtype ?? null,
      merged.hairTexture ?? null, merged.hairColor ?? null,
      merged.stylePrefs ?? null, merged.concerns ?? null,
      merged.notes ?? null, merged.gender ?? null, merged.location ?? null,
    ]
  );

  return NextResponse.json(merged);
}
