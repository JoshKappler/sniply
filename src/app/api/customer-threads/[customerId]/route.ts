import { NextRequest, NextResponse } from "next/server";
import { query, rowToCustomerThread, pool } from "@/lib/db";
import type { CustomerThreadRef } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const rows = await query(
    `SELECT * FROM customer_threads WHERE customer_id = $1 ORDER BY ts DESC NULLS LAST`,
    [customerId]
  );
  return NextResponse.json(rows.map(rowToCustomerThread));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.userId !== customerId) return forbidden();

  const threads = await req.json() as CustomerThreadRef[];

  // Delete existing and re-insert (simple replace semantics matching original behavior)
  await pool().query(`DELETE FROM customer_threads WHERE customer_id = $1`, [customerId]);

  for (const t of threads) {
    await pool().query(
      `INSERT INTO customer_threads
         (customer_id, thread_id, pro_profile_id, pro_name, pro_avatar, last_message, ts, unread)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        customerId, t.threadId, t.proProfileId ?? null, t.proName ?? null,
        t.proAvatar ?? null, t.lastMessage ?? null,
        t.timestamp ? new Date(t.timestamp) : null,
        t.unread ?? false,
      ]
    );
  }

  // Return fresh from DB
  const rows = await query(
    `SELECT * FROM customer_threads WHERE customer_id = $1 ORDER BY ts DESC NULLS LAST`,
    [customerId]
  );
  return NextResponse.json(rows.map(rowToCustomerThread));
}
