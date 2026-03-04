import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== userId) return forbidden();

  const rows = await query(
    `SELECT barber_id FROM favorites WHERE user_id = $1 ORDER BY barber_id`,
    [userId]
  );
  return NextResponse.json(rows.map((r) => r.barber_id as string));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== userId) return forbidden();

  const ids = await req.json() as string[];

  // Replace all favorites for this user
  await pool().query(`DELETE FROM favorites WHERE user_id = $1`, [userId]);

  for (const barberId of ids) {
    await pool().query(
      `INSERT INTO favorites (user_id, barber_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [userId, barberId]
    );
  }

  return NextResponse.json(ids);
}
