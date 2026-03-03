import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { TimeBlock } from "@/lib/types";

type AvailabilityDb = Record<string, Record<string, TimeBlock[]>>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const db = readJson<AvailabilityDb>("availability.json", {});
  return NextResponse.json(db[barberId] ?? {});
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const slots = await req.json() as Record<string, TimeBlock[]>;
  const db = readJson<AvailabilityDb>("availability.json", {});
  db[barberId] = slots;
  writeJson("availability.json", db);
  return NextResponse.json(slots);
}
