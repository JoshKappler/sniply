import { NextRequest, NextResponse } from "next/server";
import { query, rowToReview, pool } from "@/lib/db";
import type { StoredReview } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";
import type { PoolClient } from "pg";

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

  // Prevent duplicate reviews from the same user for the same barber
  const alreadyReviewed = await query(
    `SELECT id FROM reviews WHERE barber_id = $1 AND user_id = $2 AND user_id NOT LIKE 'seed-%'`,
    [barberId, session.userId]
  );
  if (alreadyReviewed.length > 0) {
    return NextResponse.json({ error: "You have already reviewed this barber." }, { status: 409 });
  }

  // Insert the review and update the barber's aggregate atomically
  const client: PoolClient = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO reviews (barber_id, user_id, user_name, rating, text, date, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        barberId, body.userId, body.userName ?? null, body.rating,
        body.text ?? null, body.date ?? null, body.photos ?? [],
      ]
    );
    await client.query(
      `UPDATE barbers SET
         review_count = review_count + 1,
         rating = (
           SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE barber_id = $1
         )
       WHERE id = $1`,
      [barberId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json(body, { status: 201 });
}
