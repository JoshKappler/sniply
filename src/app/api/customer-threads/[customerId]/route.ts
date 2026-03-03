import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { CustomerThreadRef } from "@/lib/types";

type CustomerThreadsDb = Record<string, CustomerThreadRef[]>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const db = readJson<CustomerThreadsDb>("customer-threads.json", {});
  return NextResponse.json(db[customerId] ?? []);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const threads = await req.json() as CustomerThreadRef[];
  const db = readJson<CustomerThreadsDb>("customer-threads.json", {});
  db[customerId] = threads;
  writeJson("customer-threads.json", db);
  return NextResponse.json(threads);
}
