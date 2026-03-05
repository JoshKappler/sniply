import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, rowToBooking, pool } from "@/lib/db";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";
import type { Booking } from "@/lib/types";
import { randomUUID } from "crypto";

function parseTime12h(t: string): number {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return h * 60 + m;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const barberId = searchParams.get("barberId");

  // Customers can only fetch their own bookings by userId
  if (userId && userId !== session.userId) return forbidden();

  let sql = `SELECT * FROM bookings`;
  const values: string[] = [];

  if (userId && barberId) {
    sql += ` WHERE user_id = $1 AND barber_id = $2`;
    values.push(userId, barberId);
  } else if (userId) {
    sql += ` WHERE user_id = $1`;
    values.push(userId);
  } else if (barberId) {
    sql += ` WHERE barber_id = $1`;
    values.push(barberId);

    // Only the owning pro gets full booking details; everyone else gets scheduling-only data
    const rows = await query(sql + ` ORDER BY created_at DESC`, values);
    const bookings = rows.map(rowToBooking);

    const isOwner =
      session.role === "pro" &&
      (await queryOne(`SELECT profile_id FROM users WHERE id = $1`, [session.userId]))
        ?.profile_id === barberId;

    if (!isOwner) {
      // Strip PII — only expose the time-blocking fields needed to show availability
      return NextResponse.json(
        bookings.map(({ id, barberId: bId, date, time, endTime, status, cancelled, duration }) => ({
          id, barberId: bId, date, time, endTime, status, cancelled, duration,
        }))
      );
    }

    return NextResponse.json(bookings);
  } else {
    // No filter — scope to the requesting user's own bookings
    sql += ` WHERE user_id = $1`;
    values.push(session.userId);
  }

  sql += ` ORDER BY created_at DESC`;
  const rows = await query(sql, values);
  return NextResponse.json(rows.map(rowToBooking));
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return unauthorized();

  let body: Booking;
  try {
    body = await req.json() as Booking;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Only allow booking under the authenticated user's own ID
  if (body.userId !== session.userId) return forbidden();

  // Validate time ordering
  if (body.time && body.endTime) {
    const start = parseTime12h(body.time);
    const end = parseTime12h(body.endTime);
    if (start >= 0 && end >= 0 && start >= end) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }
  }

  // Wrap conflict check + insert in a transaction to prevent race-condition double bookings
  const client = await pool().connect();
  try {
    await client.query("BEGIN");

    // Acquire a per-(barber, date) advisory lock to serialize concurrent booking requests.
    // FOR UPDATE only locks existing rows; when the slot is empty it acquires no lock,
    // allowing two concurrent transactions to both pass the conflict check and double-book.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1 || ',' || $2))`,
      [body.barberId, body.date ?? ""]
    );

    const conflict = await client.query(
      `SELECT id FROM bookings
       WHERE barber_id = $1
         AND date = $2
         AND NOT cancelled
         AND to_timestamp(time, 'HH:MI AM')::time     < to_timestamp($4, 'HH:MI AM')::time
         AND to_timestamp(end_time, 'HH:MI AM')::time > to_timestamp($3, 'HH:MI AM')::time
       FOR UPDATE`,
      [body.barberId, body.date ?? null, body.time ?? null, body.endTime ?? null]
    );

    if (conflict.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "That time slot is no longer available." }, { status: 409 });
    }

    const id = randomUUID();

    await client.query(
      `INSERT INTO bookings (
         id, barber_id, barber_name, barber_image, user_id, user_name,
         service, date, time, end_time, price, duration, status, cancelled, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id, body.barberId, body.barberName ?? null, body.barberImage ?? null,
        body.userId, body.userName ?? null, body.service ?? null,
        body.date ?? null, body.time ?? null, body.endTime ?? null,
        body.price ?? 0, body.duration ?? 0,
        // Always enforce server-side defaults — never trust client for these
        "upcoming", false, body.notes ?? null,
      ]
    );

    await client.query("COMMIT");

    const row = await queryOne(`SELECT * FROM bookings WHERE id = $1`, [id]);
    return NextResponse.json(rowToBooking(row!), { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
