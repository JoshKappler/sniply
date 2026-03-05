import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, rowToThread, pool } from "@/lib/db";
import type { MessageThread } from "@/lib/types";
import { getSession, unauthorized, forbidden } from "@/lib/server-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> }
) {
  const { proId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();

  // Customers can only read threads they're a participant in; pros must own the profile
  if (session.role === "pro") {
    const owner = await queryOne(
      `SELECT profile_id FROM users WHERE id = $1`,
      [session.userId]
    );
    if (!owner || owner.profile_id !== proId) return forbidden();
  }
  // Customers: allowed — they'll only see threads where they're customer_id (filtered below)

  const rows = session.role === "pro"
    ? await query(
        `SELECT * FROM threads WHERE pro_id = $1 ORDER BY ts DESC NULLS LAST`,
        [proId]
      )
    : await query(
        `SELECT * FROM threads WHERE pro_id = $1 AND customer_id = $2 ORDER BY ts DESC NULLS LAST`,
        [proId, session.userId]
      );

  return NextResponse.json(rows.map(rowToThread));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> }
) {
  const { proId } = await params;
  const session = getSession(req);
  if (!session) return unauthorized();

  let incoming: MessageThread[];
  try {
    incoming = await req.json() as MessageThread[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (session.role === "pro") {
    // Pro must own this profile
    const owner = await queryOne(
      `SELECT profile_id FROM users WHERE id = $1`,
      [session.userId]
    );
    if (!owner || owner.profile_id !== proId) return forbidden();

    // Upsert all incoming threads, delete ones that were removed — atomically
    const incomingIds = incoming.map((t) => t.id);
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      for (const t of incoming) {
        await client.query(
          `INSERT INTO threads (pro_id, thread_id, customer_id, customer_name, preview, ts, unread, messages)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (pro_id, thread_id) DO UPDATE SET
             customer_id   = EXCLUDED.customer_id,
             customer_name = EXCLUDED.customer_name,
             preview       = EXCLUDED.preview,
             ts            = EXCLUDED.ts,
             unread        = EXCLUDED.unread,
             messages      = EXCLUDED.messages`,
          [
            proId, t.id, t.customerId ?? null, t.customerName,
            t.preview ?? null,
            t.timestamp ? new Date(t.timestamp) : null,
            t.unread ?? false, JSON.stringify(t.messages ?? []),
          ]
        );
      }
      if (incomingIds.length > 0) {
        await client.query(
          `DELETE FROM threads WHERE pro_id = $1 AND thread_id != ALL($2::text[])`,
          [proId, incomingIds]
        );
      } else {
        await client.query(`DELETE FROM threads WHERE pro_id = $1`, [proId]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    // Customer: only upsert threads that belong to this customer — atomically
    const customerThreads = incoming.filter((t) => t.customerId === session.userId);
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      for (const t of customerThreads) {
        await client.query(
          `INSERT INTO threads (pro_id, thread_id, customer_id, customer_name, preview, ts, unread, messages)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (pro_id, thread_id) DO UPDATE SET
             customer_name = EXCLUDED.customer_name,
             preview       = EXCLUDED.preview,
             ts            = EXCLUDED.ts,
             unread        = EXCLUDED.unread,
             messages      = EXCLUDED.messages`,
          [
            proId, t.id, t.customerId ?? null, t.customerName,
            t.preview ?? null,
            t.timestamp ? new Date(t.timestamp) : null,
            t.unread ?? false, JSON.stringify(t.messages ?? []),
          ]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Return threads: pros see all; customers only see their own
  const rows = session.role === "pro"
    ? await query(
        `SELECT * FROM threads WHERE pro_id = $1 ORDER BY ts DESC NULLS LAST`,
        [proId]
      )
    : await query(
        `SELECT * FROM threads WHERE pro_id = $1 AND customer_id = $2 ORDER BY ts DESC NULLS LAST`,
        [proId, session.userId]
      );
  return NextResponse.json(rows.map(rowToThread));
}
