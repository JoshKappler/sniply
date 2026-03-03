import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { BusinessHours } from "@/lib/types";

type BusinessHoursDb = Record<string, BusinessHours>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const db = readJson<BusinessHoursDb>("business-hours.json", {});
  return NextResponse.json(db[profileId] ?? null);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const hours = await req.json() as BusinessHours;
  const db = readJson<BusinessHoursDb>("business-hours.json", {});
  db[profileId] = hours;
  writeJson("business-hours.json", db);
  return NextResponse.json(hours);
}
