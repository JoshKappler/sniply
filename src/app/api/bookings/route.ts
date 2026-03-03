import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/db";
import type { Booking } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const barberId = searchParams.get("barberId");
  let bookings = readJson<Booking[]>("bookings.json", []);
  if (userId) bookings = bookings.filter((b) => b.userId === userId);
  if (barberId) bookings = bookings.filter((b) => b.barberId === barberId);
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Booking;
  const bookings = readJson<Booking[]>("bookings.json", []);
  bookings.push(body);
  writeJson("bookings.json", bookings);
  return NextResponse.json(body, { status: 201 });
}
