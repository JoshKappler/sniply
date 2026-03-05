import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToNotifPrefs, pool } from "@/lib/db";
import type { NotifPrefs } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== userId) return forbidden();

  const row = await queryOne(
    `SELECT * FROM notif_prefs WHERE user_id = $1`,
    [userId]
  );
  return NextResponse.json(row ? rowToNotifPrefs(row) : null);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== userId) return forbidden();

  const prefs = await req.json() as NotifPrefs;

  await pool().query(
    `INSERT INTO notif_prefs (user_id, booking_confirmations, booking_reminders, messages, promotions)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id) DO UPDATE SET
       booking_confirmations = EXCLUDED.booking_confirmations,
       booking_reminders     = EXCLUDED.booking_reminders,
       messages              = EXCLUDED.messages,
       promotions            = EXCLUDED.promotions`,
    [
      userId,
      prefs.bookingConfirmations ?? true,
      prefs.bookingReminders ?? true,
      prefs.messages ?? true,
      prefs.promotions ?? false,
    ]
  );

  return NextResponse.json(prefs);
}
