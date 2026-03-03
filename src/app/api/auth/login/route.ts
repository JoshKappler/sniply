import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToUser } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/server-auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username: string; password: string };

  const row = await queryOne(
    `SELECT * FROM users WHERE lower(username) = lower($1)`,
    [username]
  );
  if (!row || !(await bcrypt.compare(password, row.password as string))) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const user = rowToUser(row);
  const token = signSession(user.id, user.role);
  const res = NextResponse.json(user);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
