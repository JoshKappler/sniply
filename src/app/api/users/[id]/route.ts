import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { User } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const users = readJson<User[]>("users.json", []);
  const user = users.find((u) => u.id === id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as Partial<User>;
  const users = readJson<User[]>("users.json", []);
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  users[idx] = { ...users[idx], ...body };
  writeJson("users.json", users);
  return NextResponse.json(users[idx]);
}
