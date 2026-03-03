import { NextRequest, NextResponse } from "next/server";
import { queryOne, pool } from "@/lib/db";
import type { TimeBlock } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const row = await queryOne(
    `SELECT slots FROM availability WHERE barber_id = $1`,
    [barberId]
  );
  return NextResponse.json((row?.slots as Record<string, TimeBlock[]>) ?? {});
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.role !== "pro") return forbidden();

  const owner = await queryOne(
    `SELECT profile_id FROM users WHERE id = $1`,
    [session.userId]
  );
  if (!owner || owner.profile_id !== barberId) return forbidden();

  const slots = await req.json() as Record<string, TimeBlock[]>;

  await pool().query(
    `INSERT INTO availability (barber_id, slots)
     VALUES ($1, $2)
     ON CONFLICT (barber_id) DO UPDATE SET slots = EXCLUDED.slots`,
    [barberId, JSON.stringify(slots)]
  );

  return NextResponse.json(slots);
}
