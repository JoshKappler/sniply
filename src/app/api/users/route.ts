import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToUser } from "@/lib/db";
import { pool } from "@/lib/db";
import type { User } from "@/lib/types";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/server-auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const body = await req.json() as User;

  const existing = await queryOne(
    `SELECT id FROM users WHERE lower(username) = lower($1)`,
    [body.username]
  );
  if (existing) {
    return NextResponse.json(
      { error: "That username is already taken. Please choose another." },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(body.password, 10);

  await pool().query(
    `INSERT INTO users (
       id, username, password, name, role, profile_id, avatar,
       hair_type, hair_subtype, hair_texture, hair_color,
       style_prefs, concerns, notes, gender, location
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      body.id, body.username, hashedPassword, body.name, body.role,
      body.profileId ?? null, body.avatar ?? null,
      body.hairType ?? null, body.hairSubtype ?? null,
      body.hairTexture ?? null, body.hairColor ?? null,
      body.stylePrefs ?? null, body.concerns ?? null,
      body.notes ?? null, body.gender ?? null, body.location ?? null,
    ]
  );

  const row = await queryOne(`SELECT * FROM users WHERE id = $1`, [body.id]);
  const user = rowToUser(row!);

  // Set session cookie so the new user is immediately authenticated
  const token = signSession(user.id, user.role);
  const res = NextResponse.json(user, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
