import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

/**
 * Temporary cleanup endpoint — removes duplicate barber rows that share the same name.
 * For each duplicated name, keeps the row referenced by a user's profile_id (or the
 * earliest-created row as a fallback). Hit once on the deployed URL, then delete this file.
 */
export async function GET() {
  const dupes = await query<{ name: string }>(
    `SELECT name FROM barbers GROUP BY name HAVING COUNT(*) > 1`
  );

  const deleted: { name: string; deletedIds: string[] }[] = [];

  for (const { name } of dupes) {
    const canonical = await queryOne<{ profile_id: string }>(
      `SELECT profile_id FROM users WHERE profile_id IN (
         SELECT id FROM barbers WHERE name = $1
       ) LIMIT 1`,
      [name]
    );

    let keepId: string;
    if (canonical?.profile_id) {
      keepId = canonical.profile_id;
    } else {
      const first = await queryOne<{ id: string }>(
        `SELECT id FROM barbers WHERE name = $1 ORDER BY id ASC LIMIT 1`,
        [name]
      );
      keepId = first!.id;
    }

    const toDelete = await query<{ id: string }>(
      `SELECT id FROM barbers WHERE name = $1 AND id != $2`,
      [name, keepId]
    );
    const idsToDelete = toDelete.map((r) => r.id);

    if (idsToDelete.length > 0) {
      await query(`DELETE FROM barbers WHERE id = ANY($1::text[])`, [idsToDelete]);
      deleted.push({ name, deletedIds: idsToDelete });
    }
  }

  return NextResponse.json({
    message: deleted.length === 0 ? "No duplicates found" : "Duplicates removed",
    deleted,
  });
}
