import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { StoredReview } from "@/lib/types";

type ReviewsDb = Record<string, StoredReview[]>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const db = readJson<ReviewsDb>("reviews.json", {});
  return NextResponse.json(db[barberId] ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const body = await req.json() as StoredReview;
  const db = readJson<ReviewsDb>("reviews.json", {});
  if (!db[barberId]) db[barberId] = [];
  db[barberId].push(body);
  writeJson("reviews.json", db);
  return NextResponse.json(body, { status: 201 });
}
