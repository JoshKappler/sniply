import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { MessageThread } from "@/lib/types";

type ThreadsDb = Record<string, MessageThread[]>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ proId: string }> }
) {
  const { proId } = await params;
  const db = readJson<ThreadsDb>("threads.json", {});
  return NextResponse.json(db[proId] ?? []);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ proId: string }> }
) {
  const { proId } = await params;
  const threads = await req.json() as MessageThread[];
  const db = readJson<ThreadsDb>("threads.json", {});
  db[proId] = threads;
  writeJson("threads.json", db);
  return NextResponse.json(threads);
}
