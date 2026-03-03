import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/db";
import type { User } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username: string; password: string };
  const users = readJson<User[]>("users.json", []);
  const user = users.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password
  );
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  return NextResponse.json(user);
}
