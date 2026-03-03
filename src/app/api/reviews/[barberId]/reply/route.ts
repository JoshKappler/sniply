import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { StoredReview } from "@/lib/types";

type ReviewsDb = Record<string, StoredReview[]>;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params;
  const { reviewIdx, text } = await req.json() as { reviewIdx: number; text: string };
  const db = readJson<ReviewsDb>("reviews.json", {});
  if (!db[barberId] || !db[barberId][reviewIdx]) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  db[barberId][reviewIdx].reply = text;
  writeJson("reviews.json", db);
  return NextResponse.json(db[barberId][reviewIdx]);
}
