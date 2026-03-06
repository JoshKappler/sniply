import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToReview, pool } from "@/lib/db";
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

  const { reviewId, text } = await req.json() as { reviewId: number; text: string };
  if (!text || typeof text !== "string" || text.length > 2000) {
    return NextResponse.json({ error: "Reply text must be between 1 and 2000 characters." }, { status: 400 });
  }

  // Verify the review belongs to this barber before updating
  const existing = await queryOne(
    `SELECT id FROM reviews WHERE id = $1 AND barber_id = $2`,
    [reviewId, barberId]
  );
  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  await pool().query(`UPDATE reviews SET reply = $2 WHERE id = $1`, [reviewId, text]);

  const updated = await queryOne(`SELECT * FROM reviews WHERE id = $1`, [reviewId]);
  return NextResponse.json(rowToReview(updated!));
}
