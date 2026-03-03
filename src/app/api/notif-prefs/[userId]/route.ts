import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { NotifPrefs } from "@/lib/types";

type NotifPrefsDb = Record<string, NotifPrefs>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const db = readJson<NotifPrefsDb>("notif-prefs.json", {});
  return NextResponse.json(db[userId] ?? null);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const prefs = await req.json() as NotifPrefs;
  const db = readJson<NotifPrefsDb>("notif-prefs.json", {});
  db[userId] = prefs;
  writeJson("notif-prefs.json", db);
  return NextResponse.json(prefs);
}
