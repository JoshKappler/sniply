import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { Barber, Shop } from "@/lib/types";

interface BarbersDb {
  barbers: Barber[];
  shops: Shop[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = readJson<BarbersDb>("barbers.json", { barbers: [], shops: [] });
  const barber = db.barbers.find((b) => b.id === id);
  if (!barber) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(barber);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as Partial<Barber>;
  const db = readJson<BarbersDb>("barbers.json", { barbers: [], shops: [] });
  const idx = db.barbers.findIndex((b) => b.id === id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  db.barbers[idx] = { ...db.barbers[idx], ...body };
  writeJson("barbers.json", db);
  return NextResponse.json(db.barbers[idx]);
}
