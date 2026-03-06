import { NextRequest, NextResponse } from "next/server";
import { queryOne, pool } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json() as { token: string; newPassword: string };

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const row = await queryOne(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND expires_at > NOW() AND used = FALSE`,
    [token]
  );
  if (!row) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashedPassword, row.user_id]);
    await client.query(`UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`, [token]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true });
}
