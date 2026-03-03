import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, rowToBooking, pool } from "@/lib/db";
import type { Booking } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const barberId = searchParams.get("barberId");

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
  }

  sql += ` ORDER BY created_at DESC`;
  const rows = await query(sql, values.length ? values : undefined);
  return NextResponse.json(rows.map(rowToBooking));
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Booking;

  await pool().query(
    `INSERT INTO bookings (
       id, barber_id, barber_name, barber_image, user_id, user_name,
       service, date, time, end_time, price, duration, status, cancelled, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      body.id, body.barberId, body.barberName ?? null, body.barberImage ?? null,
      body.userId, body.userName ?? null, body.service ?? null,
      body.date ?? null, body.time ?? null, body.endTime ?? null,
      body.price ?? 0, body.duration ?? 0,
      body.status ?? "upcoming", body.cancelled ?? false, body.notes ?? null,
    ]
  );

  const row = await queryOne(`SELECT * FROM bookings WHERE id = $1`, [body.id]);
  return NextResponse.json(rowToBooking(row!), { status: 201 });
}
