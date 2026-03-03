import { NextRequest, NextResponse } from "next/server";
import { query, rowToReview, pool } from "@/lib/db";
import type { StoredReview } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const rows = await query(
    `SELECT * FROM reviews WHERE barber_id = $1 ORDER BY id ASC`,
    [barberId]
  );
  return NextResponse.json(rows.map(rowToReview));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();

  const body = await req.json() as StoredReview;
  if (body.userId !== session.userId) return forbidden();

  await pool().query(
    `INSERT INTO reviews (barber_id, user_id, user_name, rating, text, date, photos)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      barberId, body.userId, body.userName ?? null, body.rating,
      body.text ?? null, body.date ?? null, body.photos ?? [],
    ]
  );

  // Update barber's aggregate rating + review count
  await pool().query(
    `UPDATE barbers SET
       review_count = review_count + 1,
       rating = (
         SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE barber_id = $1
       )
     WHERE id = $1`,
    [barberId]
  );

  return NextResponse.json(body, { status: 201 });
}
