import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, rowToReview, pool } from "@/lib/db";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.role !== "pro") return forbidden();

  // Verify this pro owns the barber profile
  const owner = await queryOne(
    `SELECT profile_id FROM users WHERE id = $1`,
    [session.userId]
  );
  if (!owner || owner.profile_id !== barberId) return forbidden();

  const { reviewIdx, text } = await req.json() as { reviewIdx: number; text: string };

  // Get reviews in insertion order; find the one at the given index
  const rows = await query(
    `SELECT * FROM reviews WHERE barber_id = $1 ORDER BY id ASC`,
    [barberId]
  );
  if (!rows[reviewIdx]) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const reviewId = rows[reviewIdx].id as number;
  await pool().query(`UPDATE reviews SET reply = $2 WHERE id = $1`, [reviewId, text]);

  const updated = await queryOne(`SELECT * FROM reviews WHERE id = $1`, [reviewId]);
  return NextResponse.json(rowToReview(updated!));
}
