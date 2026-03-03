import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { User } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json() as User;
  const users = readJson<User[]>("users.json", []);
  if (users.find((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
    return NextResponse.json(
      { error: "That username is already taken. Please choose another." },
      { status: 409 }
    );
  }
  users.push(body);
  writeJson("users.json", users);
  return NextResponse.json(body, { status: 201 });
}
