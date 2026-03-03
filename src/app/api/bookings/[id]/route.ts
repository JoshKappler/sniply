import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { Booking } from "@/lib/types";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as Partial<Booking>;
  const bookings = readJson<Booking[]>("bookings.json", []);
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  bookings[idx] = { ...bookings[idx], ...body };
  writeJson("bookings.json", bookings);
  return NextResponse.json(bookings[idx]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bookings = readJson<Booking[]>("bookings.json", []);
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [removed] = bookings.splice(idx, 1);
  writeJson("bookings.json", bookings);
  return NextResponse.json(removed);
}
