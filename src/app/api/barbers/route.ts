import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { Barber, Shop } from "@/lib/types";

interface BarbersDb {
  barbers: Barber[];
  shops: Shop[];
}

export async function GET() {
  const db = readJson<BarbersDb>("barbers.json", { barbers: [], shops: [] });
  return NextResponse.json(db);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Barber;
  const db = readJson<BarbersDb>("barbers.json", { barbers: [], shops: [] });
  // Reject if ID already exists
  if (db.barbers.find((b) => b.id === body.id)) {
    return NextResponse.json({ error: "Barber ID already exists" }, { status: 409 });
  }
  db.barbers.push(body);
  writeJson("barbers.json", db);
  return NextResponse.json(body, { status: 201 });
}
