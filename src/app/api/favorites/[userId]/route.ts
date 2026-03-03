import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";

type FavoritesDb = Record<string, string[]>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const db = readJson<FavoritesDb>("favorites.json", {});
  return NextResponse.json(db[userId] ?? []);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const ids = await req.json() as string[];
  const db = readJson<FavoritesDb>("favorites.json", {});
  db[userId] = ids;
  writeJson("favorites.json", db);
  return NextResponse.json(ids);
}
