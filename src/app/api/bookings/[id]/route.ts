import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToBooking, pool } from "@/lib/db";
import type { Booking } from "@/lib/types";
import { getSession, unauthorized, forbidden, type SessionPayload } from "@/lib/server-auth";

async function canMutateBooking(session: SessionPayload, booking: Booking): Promise<boolean> {
  if (session.userId === booking.userId) return true;
  if (session.role === "pro") {
    const row = await queryOne(
      `SELECT profile_id FROM users WHERE id = $1`,
      [session.userId]
    );
    if (row?.profile_id === booking.barberId) return true;
  }
  return false;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();

  const existing = await queryOne(`SELECT * FROM bookings WHERE id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const booking = rowToBooking(existing);
  if (!(await canMutateBooking(session, booking))) return forbidden();

  const body = await req.json() as Partial<Booking>;
  const merged: Booking = { ...booking, ...body };

  await pool().query(
    `UPDATE bookings SET
       barber_id    = $2, barber_name  = $3, barber_image = $4,
       user_id      = $5, user_name    = $6, service      = $7,
       date         = $8, time         = $9, end_time     = $10,
       price        = $11, duration    = $12, status      = $13,
       cancelled    = $14, notes       = $15
     WHERE id = $1`,
    [
      id,
      merged.barberId, merged.barberName ?? null, merged.barberImage ?? null,
      merged.userId, merged.userName ?? null, merged.service ?? null,
      merged.date ?? null, merged.time ?? null, merged.endTime ?? null,
      merged.price ?? 0, merged.duration ?? 0, merged.status ?? "upcoming",
      merged.cancelled ?? false, merged.notes ?? null,
    ]
  );

  const row = await queryOne(`SELECT * FROM bookings WHERE id = $1`, [id]);
  return NextResponse.json(rowToBooking(row!));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();

  const existing = await queryOne(`SELECT * FROM bookings WHERE id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const booking = rowToBooking(existing);
  if (!(await canMutateBooking(session, booking))) return forbidden();

  await pool().query(`DELETE FROM bookings WHERE id = $1`, [id]);
  return NextResponse.json(booking);
}
