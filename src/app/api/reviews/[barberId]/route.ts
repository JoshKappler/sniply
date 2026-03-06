import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, rowToReview, pool } from "@/lib/db";
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

  let body: StoredReview;
  try {
    body = await req.json() as StoredReview;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (body.userId !== session.userId) return forbidden();
  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }
  if (body.text && body.text.length > 2000) {
    return NextResponse.json({ error: "Review text must be 2000 characters or fewer." }, { status: 400 });
  }

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
  let insertedId: number;
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO reviews (barber_id, user_id, user_name, rating, text, date, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        barberId, body.userId, body.userName ?? null, body.rating,
        body.text ?? null, body.date ?? null, body.photos ?? [],
      ]
    );
    insertedId = inserted.rows[0].id as number;
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
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }

  // Return the persisted row (with DB-generated id) rather than the raw request body
  const row = await queryOne(`SELECT * FROM reviews WHERE id = $1`, [insertedId]);
  return NextResponse.json(rowToReview(row!), { status: 201 });
}
