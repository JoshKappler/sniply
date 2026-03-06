import { NextRequest, NextResponse } from "next/server";
import { queryOne, pool } from "@/lib/db";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Always return 200 to prevent user enumeration
  const user = await queryOne(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email]);
  if (user) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool().query(
      `INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, user.id, expiresAt.toISOString()]
    );

    const resetLink = `${origin}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(email, resetLink);
    } catch (err) {
      console.error("[forgot-password] Failed to send email:", err);
    }
  }

  return NextResponse.json({ success: true });
}
