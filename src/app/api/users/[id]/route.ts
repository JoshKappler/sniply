import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToUser, pool } from "@/lib/db";
import type { User } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";
import bcrypt from "bcryptjs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== id) return forbidden();

  const userRow = await queryOne(`SELECT profile_id FROM users WHERE id = $1`, [id]);
  if (!userRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profileId: string | null = (userRow.profile_id as string | null) ?? null;
  const client = await pool().connect();
  try {
    await client.query("BEGIN");

    // Common: delete all user-level data
    await client.query(`DELETE FROM notif_prefs       WHERE user_id    = $1`, [id]);
    await client.query(`DELETE FROM favorites         WHERE user_id    = $1`, [id]);
    await client.query(`DELETE FROM reviews           WHERE user_id    = $1`, [id]);
    await client.query(`DELETE FROM bookings          WHERE user_id    = $1`, [id]);
    await client.query(`DELETE FROM customer_threads  WHERE customer_id = $1`, [id]);
    await client.query(`DELETE FROM threads           WHERE customer_id = $1`, [id]);

    // Pro-only: cascade through barber profile
    if (profileId) {
      await client.query(`DELETE FROM customer_threads WHERE pro_profile_id = $1`, [profileId]);
      await client.query(`DELETE FROM threads          WHERE pro_id         = $1`, [profileId]);
      await client.query(`DELETE FROM bookings         WHERE barber_id      = $1`, [profileId]);
      await client.query(`DELETE FROM reviews          WHERE barber_id      = $1`, [profileId]);
      await client.query(`DELETE FROM availability     WHERE barber_id      = $1`, [profileId]);
      await client.query(`DELETE FROM business_hours   WHERE profile_id     = $1`, [profileId]);
      await client.query(`DELETE FROM barbers          WHERE id             = $1`, [profileId]);
    }

    await client.query(`DELETE FROM users WHERE id = $1`, [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== id) return forbidden();

  const row = await queryOne(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { password: _pw, ...safeUser } = rowToUser(row);
  return NextResponse.json(safeUser);
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

  let body: Partial<User> & { currentPassword?: string };
  try {
    body = await req.json() as Partial<User> & { currentPassword?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // If changing password, verify current password and hash the new one
  if (body.password !== undefined) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }
    let valid: boolean;
    try {
      valid = await bcrypt.compare(body.currentPassword, existing.password as string);
    } catch {
      return NextResponse.json({ error: "Authentication error." }, { status: 500 });
    }
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    try {
      body.password = await bcrypt.hash(body.password, 10);
    } catch {
      return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
    }
  }

  const { currentPassword: _cp, ...userPatch } = body;

  // Validate email uniqueness if it's being changed
  if (userPatch.email && userPatch.email !== (existing.email as string)) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userPatch.email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    const taken = await queryOne(
      `SELECT id FROM users WHERE lower(email) = lower($1) AND id != $2`,
      [userPatch.email, id]
    );
    if (taken) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
  }

  const merged: User = { ...rowToUser(existing), ...userPatch };
  merged.role = rowToUser(existing).role as "customer" | "pro";
  merged.profileId = rowToUser(existing).profileId;

  await pool().query(
    `UPDATE users SET
       email        = $2, password    = $3, name        = $4, role        = $5,
       profile_id   = $6, avatar      = $7, hair_type   = $8, hair_subtype = $9,
       hair_texture = $10, hair_color = $11, style_prefs = $12, concerns   = $13,
       notes        = $14, gender     = $15, location    = $16
     WHERE id = $1`,
    [
      id,
      merged.email, merged.password, merged.name, merged.role,
      merged.profileId ?? null, merged.avatar ?? null,
      merged.hairType ?? null, merged.hairSubtype ?? null,
      merged.hairTexture ?? null, merged.hairColor ?? null,
      merged.stylePrefs ?? null, merged.concerns ?? null,
      merged.notes ?? null, merged.gender ?? null, merged.location ?? null,
    ]
  );

  const { password: _pw, ...safeUser } = merged;
  return NextResponse.json(safeUser);
}
