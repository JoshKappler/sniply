import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToBusinessHours, pool } from "@/lib/db";
import type { BusinessHours } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const row = await queryOne(
    `SELECT * FROM business_hours WHERE profile_id = $1`,
    [profileId]
  );
  return NextResponse.json(row ? rowToBusinessHours(row) : null);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.role !== "pro") return forbidden();

  const owner = await queryOne(
    `SELECT profile_id FROM users WHERE id = $1`,
    [session.userId]
  );
  if (!owner || owner.profile_id !== profileId) return forbidden();

  const hours = await req.json() as BusinessHours;

  await pool().query(
    `INSERT INTO business_hours (profile_id, open_time, close_time)
     VALUES ($1,$2,$3)
     ON CONFLICT (profile_id) DO UPDATE SET
       open_time  = EXCLUDED.open_time,
       close_time = EXCLUDED.close_time`,
    [profileId, hours.openTime ?? null, hours.closeTime ?? null]
  );

  return NextResponse.json(hours);
}
