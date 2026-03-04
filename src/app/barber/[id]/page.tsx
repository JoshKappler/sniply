"use client";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Barber, StoredReview } from "@/lib/types";
import { apiGetBarber, apiCreateBooking, apiDeleteBooking, apiGetBookings, apiGetReviews, apiPostReview, apiReplyToReview, apiGetFavorites, apiUpdateFavorites, apiGetThreads, apiUpdateThreads, apiGetCustomerThreads, apiUpdateCustomerThreads, apiGetAvailability, apiGetBusinessHours } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

// IDs of seed barbers that use demo availability (not user-created)
const STATIC_BARBER_IDS = new Set(Array.from({ length: 22 }, (_, i) => String(i + 1)));
import Navbar from "@/components/Navbar";
import { Stars } from "@/components/Stars";
import BarberCard from "@/components/BarberCard";

type TabKey = "portfolio" | "booking" | "reviews";

interface ProProfile extends Barber {
  certifications?: string[];
  credentials?: { text: string; fileName?: string; fileData?: string }[];
}


interface MessageThread {
  id: string;
  customerId?: string;
  customerName: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  messages: { from: "pro" | "customer"; text: string; time: string }[];
}

interface CustomerThreadRef {
  proProfileId: string;
  proName: string;
  proAvatar?: string;
  threadId: string;
  lastMessage?: string;
  timestamp: string;
  unread: boolean;
}

async function writeCustomerThreadRef(
  customerId: string,
  proId: string,
  proName: string,
  proAvatar: string | undefined,
  threadId: string,
  lastMessage: string,
  timestamp: string,
  unread: boolean
): Promise<void> {
  try {
    const refs = await apiGetCustomerThreads(customerId);
    const idx = refs.findIndex((r) => r.proProfileId === proId);
    const entry: CustomerThreadRef = { proProfileId: proId, proName, proAvatar, threadId, lastMessage, timestamp, unread };
    if (idx >= 0) refs[idx] = entry;
    else refs.unshift(entry);
    await apiUpdateCustomerThreads(customerId, refs);
  } catch (err) {
    console.error("sniply/barber: failed to write customer thread ref", err);
  }
}

// ── Schedule types ────────────────────────────────────────────────────────────
interface TimeBlock { id: string; start: string; end: string; }

function parseTimeToMinutes(t: string): number {
  const parts = t.trim().split(" ");
  const [hStr, mStr] = parts[0].split(":");
  const h = parseInt(hStr), m = parseInt(mStr || "0");
  return (h % 12 + (parts[1] === "PM" ? 12 : 0)) * 60 + m;
}
function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}


function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Interval { start: number; end: number; } // minutes since midnight

const SLOT_INCREMENT = 30; // minutes between bookable start times

function generateAvailableSlots(spans: TimeBlock[], booked: Interval[]): string[] {
  const slots: string[] = [];
  for (const span of spans) {
    const spanStart = parseTimeToMinutes(span.start);
    const spanEnd   = parseTimeToMinutes(span.end);
    for (let s = spanStart; s + SLOT_INCREMENT <= spanEnd; s += SLOT_INCREMENT) {
      const slotEnd = s + SLOT_INCREMENT;
      const isBlocked = booked.some(bk => bk.start < slotEnd && bk.end > s);
      if (!isBlocked) slots.push(minutesToTimeStr(s));
    }
  }
  // Deduplicate (contiguous spans can produce duplicates at boundaries)
  const seen = new Set<number>();
  return slots.filter(t => {
    const m = parseTimeToMinutes(t);
    return seen.has(m) ? false : (seen.add(m), true);
  });
}

function groupSlotsByPeriod(slots: string[]): { label: string; slots: string[] }[] {
  const morning: string[] = [], afternoon: string[] = [], evening: string[] = [];
  for (const t of slots) {
    const m = parseTimeToMinutes(t);
    if (m < 720) morning.push(t);
    else if (m < 1020) afternoon.push(t);
    else evening.push(t);
  }
  return [
    { label: "Morning", slots: morning },
    { label: "Afternoon", slots: afternoon },
    { label: "Evening", slots: evening },
  ].filter(g => g.slots.length > 0);
}

// Compute contiguous free windows by subtracting booked intervals from spans
function computeFreeSegments(spans: TimeBlock[], booked: Interval[]): Interval[] {
  const segments: Interval[] = [];
  for (const span of spans) {
    const spanStart = parseTimeToMinutes(span.start);
    const spanEnd   = parseTimeToMinutes(span.end);
    const relevant  = booked
      .filter(bk => bk.start < spanEnd && bk.end > spanStart)
      .sort((a, b) => a.start - b.start);
    let cursor = spanStart;
    for (const bk of relevant) {
      const bkStart = Math.max(bk.start, spanStart);
      const bkEnd   = Math.min(bk.end, spanEnd);
      if (bkStart > cursor) segments.push({ start: cursor, end: bkStart });
      cursor = Math.max(cursor, bkEnd);
    }
    if (cursor < spanEnd) segments.push({ start: cursor, end: spanEnd });
  }
  return segments;
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

// Compact label for timeline tick marks: "9 AM", "12 PM", "3:30 PM"
function fmtHourLabel(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}


// Demo availability blocks for a single date (static barbers only — deterministic from barber ID)
// Produces 2–3 blocks per day, each ≤2 hours, with natural gaps between them
function getDemoBlocksForDate(barberId: string, date: Date): TimeBlock[] {
  const seed = barberId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const dow = date.getDay();
  const dayOff = (seed % 6) + 1; // one weekday off (1=Mon…6=Sat)
  if (dow === 0 || dow === dayOff) return []; // always off Sunday + one variable day

  const key = isoDate(date);
  const variation = (seed + dow) % 4;

  // All templates use realistic appointment-length slots (≤2h) with breaks between them
  const templates: { start: string; end: string }[][] = [
    [ // 9–11, 12–2, 3–5
      { start: "9:00 AM",  end: "11:00 AM" },
      { start: "12:00 PM", end: "2:00 PM"  },
      { start: "3:00 PM",  end: "5:00 PM"  },
    ],
    [ // 10–11:30, 1–3, 4–5:30
      { start: "10:00 AM", end: "11:30 AM" },
      { start: "1:00 PM",  end: "3:00 PM"  },
      { start: "4:00 PM",  end: "5:30 PM"  },
    ],
    [ // 8–10, 11–1, 2–4
      { start: "8:00 AM",  end: "10:00 AM" },
      { start: "11:00 AM", end: "1:00 PM"  },
      { start: "2:00 PM",  end: "4:00 PM"  },
    ],
    [ // lighter day: 9–11, 1–3
      { start: "9:00 AM",  end: "11:00 AM" },
      { start: "1:00 PM",  end: "3:00 PM"  },
    ],
  ];

  return templates[variation].map((t, i) => ({
    id: `demo-${key}-${i}`,
    start: t.start,
    end: t.end,
  }));
}


const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Booking Modal ─────────────────────────────────────────────────────────────
interface BookingModalProps {
  barber: ProProfile;
  selectedSlot: { date: Date; time: string } | null;
  preselectedService: string | null;
  spansForDate: TimeBlock[];
  bookedForDate: Interval[];
  onClose: () => void;
  onBooked?: () => void;
  rescheduleBookingId?: string | null;
  onRescheduled?: () => void;
  userBookings?: import("@/lib/types").Booking[];
}

function BookingModal({
  barber, selectedSlot, preselectedService,
  spansForDate, bookedForDate,
  onClose, onBooked, rescheduleBookingId, onRescheduled,
  userBookings = [],
}: BookingModalProps) {
  const [selectedService, setSelectedService] = useState(preselectedService ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const user = getCurrentUser();

  // Check if this user already has an active (not-yet-passed) booking with this barber
  // Exclude the booking being rescheduled so the guard doesn't block rescheduling
  const existingActiveBooking = (() => {
    if (!user) return null;
    const mine = userBookings.filter(b => b.id !== rescheduleBookingId);
    const now = new Date();
    for (const bk of mine) {
      const bkDay = new Date(bk.date);
      bkDay.setHours(0, 0, 0, 0);
      const endTime = (bk as { endTime?: string }).endTime;
      const endMins = endTime
        ? parseTimeToMinutes(endTime)
        : parseTimeToMinutes(bk.time) + (bk.duration ?? 60);
      const endMs = new Date(bkDay.getTime() + endMins * 60000);
      if (endMs > now) return bk;
    }
    return null;
  })();

  const selectedServiceObj = barber.services.find(s => s.name === selectedService);
  const serviceDuration = selectedServiceObj?.duration ?? 0;

  const startMins = selectedSlot ? parseTimeToMinutes(selectedSlot.time) : 0;
  const endMins   = startMins + serviceDuration;
  const computedEndTime = serviceDuration > 0 ? minutesToTimeStr(endMins) : null;

  // Only show services that can finish within the free window starting at the chosen slot.
  // We must consider both the span boundary AND the next booked appointment after startMins.
  const containingSpan = spansForDate.find(span => {
    const spanStart = parseTimeToMinutes(span.start);
    const spanEnd   = parseTimeToMinutes(span.end);
    return startMins >= spanStart && startMins < spanEnd;
  });
  const spanEndMins = containingSpan ? parseTimeToMinutes(containingSpan.end) : Infinity;
  const nextBookingStart = bookedForDate
    .filter(bk => bk.start > startMins)
    .sort((a, b) => a.start - b.start)[0]?.start ?? Infinity;
  const effectiveWindowEnd = Math.min(spanEndMins, nextBookingStart);
  const remainingMins = isFinite(effectiveWindowEnd) ? effectiveWindowEnd - startMins : Infinity;
  const bookableServices = barber.services.filter(s => s.duration <= remainingMins);

  const validateSlot = (): string | null => {
    if (!selectedSlot || serviceDuration === 0) return null;
    const fitsInSpan = spansForDate.some(span =>
      startMins >= parseTimeToMinutes(span.start) && endMins <= parseTimeToMinutes(span.end)
    );
    if (!fitsInSpan) return `${selectedService} (${serviceDuration} min) is too long for this slot. Choose an earlier time.`;
    const hasConflict = bookedForDate.some(bk => bk.start < endMins && bk.end > startMins);
    if (hasConflict) return "This time was just taken. Please select another slot.";
    return null;
  };

  const canConfirm = !!selectedService && !existingActiveBooking;

  const handleConfirm = async () => {
    if (!canConfirm || !selectedSlot || isConfirming) return;
    if (!user) { setValidationError("Please sign in to complete your booking."); return; }
    if (existingActiveBooking) return; // guard against race
    const error = validateSlot();
    if (error) { setValidationError(error); return; }
    setValidationError(null);
    const booking = {
      id: `booking-${Date.now()}`,
      barberId: barber.id,
      barberName: barber.name,
      barberImage: barber.profileImage,
      service: selectedService,
      duration: serviceDuration,
      date: isoDate(selectedSlot.date),
      time: selectedSlot.time,
      endTime: computedEndTime ?? selectedSlot.time,
      userId: user?.id ?? "guest",
      userName: user?.name ?? "Guest",
      status: "upcoming" as const,
      price: barber.services.find(s => s.name === selectedService)?.price ?? 0,
      createdAt: new Date().toISOString(),
      notes: bookingNotes.trim() || undefined,
    };
    setIsConfirming(true);
    try {
      // If rescheduling, delete old booking first
      if (rescheduleBookingId) {
        await apiDeleteBooking(rescheduleBookingId);
      }
      await apiCreateBooking(booking);
    } catch (err) {
      console.error("sniply/booking: failed to save booking", err);
      const msg = err instanceof Error ? err.message : "Booking could not be saved. Please try again.";
      setValidationError(msg);
      setIsConfirming(false);
      return;
    }
    setConfirmed(true);
    if (rescheduleBookingId) onRescheduled?.();
    else onBooked?.();
  };

  const dateStr = selectedSlot
    ? `${DAY_NAMES[selectedSlot.date.getDay()]}, ${MONTH_NAMES[selectedSlot.date.getMonth()]} ${selectedSlot.date.getDate()}`
    : "";

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--color-primary)] px-6 py-5">
          <h2 className="font-heading font-bold text-white text-xl">
            {confirmed ? (rescheduleBookingId ? "Rescheduled!" : "Booking Confirmed!") : (rescheduleBookingId ? "Reschedule Appointment" : "Book Appointment")}
          </h2>
          <p className="text-white/70 text-sm mt-1">{barber.name}</p>
        </div>

        {confirmed ? (
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-heading font-bold text-gray-900 text-xl mb-2">{rescheduleBookingId ? "Appointment rescheduled!" : "You're booked!"}</h3>
            <p className="text-gray-500 text-sm mb-1">{selectedService}</p>
            <p className="text-gray-500 text-sm mb-6">{dateStr} · {selectedSlot?.time}{computedEndTime ? ` – ${computedEndTime}` : ""}</p>
            <p className="text-xs text-gray-400 mb-6">
              {barber.name} will reach out to confirm your appointment.
            </p>
            <button onClick={onClose} className="btn-primary w-full" style={{ height: "44px" }}>
              Done
            </button>
          </div>
        ) : existingActiveBooking ? (
          <div className="px-6 py-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">You already have an upcoming appointment</p>
                  <p className="text-sm text-amber-700">
                    {existingActiveBooking.service} · {
                      (() => {
                        const d = new Date(existingActiveBooking.date);
                        return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
                      })()
                    } at {existingActiveBooking.time}
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    You can book another appointment once this one has passed.
                  </p>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn-primary w-full" style={{ height: "44px" }}>
              Got it
            </button>
          </div>
        ) : (
          <div className="px-6 py-6 space-y-5">
            {selectedSlot && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-[var(--color-primary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{dateStr}</p>
                  <p className="text-xs text-gray-500">
                    {selectedSlot.time}{computedEndTime ? ` – ${computedEndTime}` : ""}
                    {serviceDuration > 0 && <> · {serviceDuration} min</>}
                  </p>
                </div>
              </div>
            )}

            <div>
              {preselectedService && selectedServiceObj ? (
                /* Service already chosen — show summary only */
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Service</label>
                  <div className="flex items-center justify-between bg-[var(--color-primary)]/5 border-2 border-[var(--color-primary)]/30 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedService}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedServiceObj.duration} min</p>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-primary)]">${selectedServiceObj.price}</span>
                  </div>
                </div>
              ) : (
                /* No service pre-selected — show full picker */
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Service</label>
                  <div className="space-y-2">
                    {bookableServices.map((svc) => (
                      <label
                        key={svc.name}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedService === svc.name
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="bookingService"
                            value={svc.name}
                            checked={selectedService === svc.name}
                            onChange={() => setSelectedService(svc.name)}
                            className="accent-[var(--color-primary)]"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                            <p className="text-xs text-gray-400">{svc.duration} min</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-[var(--color-primary)]">${svc.price}</span>
                      </label>
                    ))}
                  </div>
                  {bookableServices.length < barber.services.length && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Some services aren&apos;t shown — they don&apos;t fit in the remaining window.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Optional booking notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Notes for {barber.name} <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="e.g. First time client, looking for a tapered fade with a hard part..."
                value={bookingNotes}
                onChange={(e) => { if (e.target.value.length <= 200) setBookingNotes(e.target.value); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
                style={{ height: "80px" }}
              />
              <span className="text-xs text-gray-400">{bookingNotes.length} / 200</span>
            </div>

            {!user && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <Link href="/login" className="font-medium underline">Sign in</Link> to save your booking to your account.
              </div>
            )}

            {validationError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {validationError}
              </div>
            )}

            <button
              onClick={() => void handleConfirm()}
              disabled={!canConfirm || isConfirming}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ height: "48px" }}
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Booking…
                </>
              ) : "Confirm Booking"}
            </button>
            <button onClick={onClose} className="w-full text-sm text-gray-400 hover:text-gray-600 text-center py-1">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Review Form ───────────────────────────────────────────────────────────────
interface ReviewFormProps {
  barber: ProProfile;
  existingReviews: StoredReview[];
  onSubmit: (review: StoredReview) => void;
  hasBooked?: boolean;
}

async function compressReviewPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ReviewForm({ barber, existingReviews, onSubmit, hasBooked = false }: ReviewFormProps) {
  const user = getCurrentUser();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  if (!user) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-600 text-sm mb-3">Sign in to leave a review</p>
        <Link href="/login" className="btn-primary inline-flex items-center" style={{ height: "40px", padding: "0 20px" }}>
          Sign In
        </Link>
      </div>
    );
  }

  // Check if user already reviewed this barber
  const alreadyReviewed = existingReviews.some((r) => r.userId === user.id);
  if (alreadyReviewed && !submitted) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-600 text-sm">You&apos;ve already reviewed this pro.</p>
      </div>
    );
  }

  if (!hasBooked && !submitted) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-600 text-sm mb-1 font-medium">Book first to leave a review</p>
        <p className="text-gray-400 text-xs">Only clients who have booked this pro can leave a review.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <svg className="w-8 h-8 text-green-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-green-800 font-semibold text-sm">Review submitted — thank you!</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!rating || !text.trim()) return;
    const review: StoredReview = {
      userId: user.id,
      userName: user.name,
      rating,
      text: text.trim(),
      date: "Just now",
      ...(reviewPhotos.length > 0 && { photos: reviewPhotos }),
    };
    try {
      await apiPostReview(barber.id, { userId: user.id, userName: user.name, rating, text: text.trim(), date: "Just now" });
    } catch (err) {
      console.error("sniply/review: failed to persist review to API", err);
    }
    onSubmit(review);
    setSubmitted(true);
  };

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - reviewPhotos.length);
    if (!files.length) return;
    setPhotoUploading(true);
    try {
      const compressed = await Promise.all(files.map(compressReviewPhoto));
      setReviewPhotos((prev) => [...prev, ...compressed].slice(0, 3));
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
      <h3 className="font-heading font-bold text-gray-900 text-base mb-4">Leave a Review</h3>

      {/* Star picker */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Your Rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="text-2xl leading-none transition-colors"
              style={{ color: star <= (hovered || rating) ? "var(--color-accent)" : "#D1D5DB" }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
        <textarea
          placeholder="Share your experience..."
          value={text}
          onChange={(e) => { if (e.target.value.length <= 500) setText(e.target.value); }}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
          style={{ height: "100px" }}
        />
        <span className="text-xs text-gray-400">{text.length} / 500</span>
      </div>

      {/* Photo upload */}
      <div className="mb-5">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Photos <span className="text-gray-400 font-normal">(optional · up to 3)</span>
        </p>
        <div className="flex gap-2 flex-wrap">
          {reviewPhotos.map((src, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
              <img src={src} alt={`Review photo ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setReviewPhotos((prev) => prev.filter((_, i) => i !== idx))}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {reviewPhotos.length < 3 && (
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)]/50 hover:bg-gray-50 transition-colors">
              {photoUploading ? (
                <div className="w-5 h-5 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px] text-gray-400">Add photo</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoAdd}
                disabled={photoUploading}
              />
            </label>
          )}
        </div>
      </div>

      <button
        onClick={() => void handleSubmit()}
        disabled={!rating || !text.trim()}
        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ height: "44px", padding: "0 24px" }}
      >
        Submit Review
      </button>
    </div>
  );
}

// ── Waitlist Prompt ───────────────────────────────────────────────────────────
function WaitlistPrompt({ barberName, date }: { barberName: string; date: Date }) {
  const [notified, setNotified] = useState(false);
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (notified) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 mb-1">You&apos;re on the waitlist!</p>
        <p className="text-sm text-gray-500">We&apos;ll notify you if {barberName} opens a slot on {dateLabel}.</p>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="font-semibold text-gray-700 mb-1">Fully booked on {dateLabel}</p>
      <p className="text-sm text-gray-400 mb-5">No available slots this day. Try a different date or join the waitlist.</p>
      <button
        onClick={() => setNotified(true)}
        className="btn-secondary flex items-center gap-2 mx-auto"
        style={{ height: "40px", paddingLeft: "20px", paddingRight: "20px" }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Notify me when a slot opens
      </button>
    </div>
  );
}

// ── Message Modal ─────────────────────────────────────────────────────────────
interface MessageModalProps {
  barber: ProProfile;
  currentUser: { id: string; name: string };
  onClose: () => void;
}

function MessageModal({ barber, currentUser, onClose }: MessageModalProps) {
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [draftText, setDraftText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load or create thread on mount
  useEffect(() => {
    apiGetThreads(barber.id).then(async (threads) => {
      let found = threads.find((t) => t.customerId === currentUser.id)
        ?? threads.find((t) => t.customerName === currentUser.name);
      if (!found) {
        found = {
          id: `thread-${Date.now()}`,
          customerId: currentUser.id,
          customerName: currentUser.name,
          preview: "",
          timestamp: new Date().toISOString(),
          unread: false,
          messages: [],
        };
        threads.push(found);
        await apiUpdateThreads(barber.id, threads);
        await writeCustomerThreadRef(currentUser.id, barber.id, barber.name, barber.profileImage, found.id, "", new Date().toISOString(), false);
      } else if (!found.customerId) {
        found.customerId = currentUser.id;
        const idx = threads.findIndex((t) => t.id === found!.id);
        if (idx >= 0) threads[idx] = found;
        await apiUpdateThreads(barber.id, threads);
        await writeCustomerThreadRef(currentUser.id, barber.id, barber.name, barber.profileImage, found.id, found.preview, found.timestamp, false);
      }
      setThread(found);
    }).catch(() => {});
  }, [barber, currentUser]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  const sendMessage = () => {
    if (!draftText.trim() || !thread) return;
    const msg = {
      from: "customer" as const,
      text: draftText.trim(),
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
    const updatedThread: MessageThread = {
      ...thread,
      messages: [...thread.messages, msg],
      preview: msg.text,
      timestamp: new Date().toISOString(),
      unread: true,
    };
    setThread(updatedThread);
    setDraftText("");
    void apiGetThreads(barber.id).then(async (threads) => {
      const idx = threads.findIndex((t) => t.id === thread.id);
      if (idx >= 0) threads[idx] = updatedThread;
      await apiUpdateThreads(barber.id, threads);
      await writeCustomerThreadRef(currentUser.id, barber.id, barber.name, barber.profileImage, thread.id, msg.text, new Date().toISOString(), false);
    });
  };

  const avatarInitial = barber.name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--color-primary)] px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {avatarInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-white text-base leading-tight truncate">{barber.name}</p>
            <p className="text-white/60 text-xs">Send a message</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[200px]" style={{ maxHeight: "340px" }}>
          {!thread || thread.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/8 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[var(--color-primary)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">Start a conversation</p>
              <p className="text-xs text-gray-400 mt-1">Ask about availability, styles, or anything else</p>
            </div>
          ) : (
            thread.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.from === "customer"
                      ? "bg-[var(--color-primary)] text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  <p>{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.from === "customer" ? "text-white/60" : "text-gray-400"}`}>{msg.time}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input row */}
        <div className="border-t border-gray-100 px-4 py-3 flex gap-2 items-end shrink-0">
          <textarea
            value={draftText}
            onChange={(e) => { if (e.target.value.length <= 500) setDraftText(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Message ${barber.name.split(" ")[0]}…`}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
            style={{ minHeight: "40px", maxHeight: "120px" }}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!draftText.trim()}
            className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-[#243A6F] transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BarberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  // Seed barbers use demo availability; user-created pros use real availability data
  const isStaticBarber = STATIC_BARBER_IDS.has(id);
  const [barber, setBarber] = useState<ProProfile | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("portfolio");
  const [saved, setSaved] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<{ date: Date; time: string } | null>(null);
  const [preselectedService, setPreselectedService] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [expandedSegIdx, setExpandedSegIdx] = useState<number | null>(null);
  const [extraReviews, setExtraReviews] = useState<StoredReview[]>([]);
  const [reviewReplies, setReviewReplies] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [proAvailData, setProAvailData] = useState<Record<string, TimeBlock[]> | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleOriginalService, setRescheduleOriginalService] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const reviewFormRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  // Maps ISO date key → booked intervals {start, end} in minutes for this barber
  const [bookedIntervalMap, setBookedIntervalMap] = useState<Record<string, Interval[]>>({});
  // Current user's bookings with this barber (for double-booking guard + review eligibility)
  const [userBookings, setUserBookings] = useState<import("@/lib/types").Booking[]>([]);
  const [availRefreshKey, setAvailRefreshKey] = useState(0);
  // Calendar state for the availability tab
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  // Business hours for the availability indicator (real pros only)
  const [businessHours, setBusinessHours] = useState<{ open: number; close: number } | null>(null);
  const [similarBarbers, setSimilarBarbers] = useState<Barber[]>([]);

  useEffect(() => {
    // Load barber from unified API (seed + user-created pros)
    apiGetBarber(id).then(b => {
      setBarber(b as ProProfile);
    }).catch(() => {
      // Barber not found
    }).finally(() => setLoading(false));

    // Load availability from API (user-created pros only; seed barbers use demo availability)
    if (!isStaticBarber) {
      apiGetAvailability(id).then((slots) => {
        if (Object.keys(slots).length > 0) setProAvailData(slots as Record<string, TimeBlock[]>);
        else setProAvailData(null);
      }).catch(() => {});
      apiGetBusinessHours(id).then((bh) => {
        const h = bh as unknown as { openTime?: string; closeTime?: string } | null;
        if (h?.openTime && h?.closeTime) {
          setBusinessHours({
            open: parseTimeToMinutes(h.openTime),
            close: parseTimeToMinutes(h.closeTime),
          });
        }
      }).catch(() => {});
    }

    // Load current user info + their bookings with this barber
    const user = getCurrentUser();
    if (user) {
      setCurrentUserId(user.id);
      setCurrentUserProfileId(user.profileId ?? null);
      setCurrentUser({ id: user.id, name: user.name });
      apiGetBookings({ userId: user.id, barberId: id }).then(setUserBookings).catch(() => {});
    }
  }, [id, isStaticBarber]);

  // Load similar barbers from API once main barber is known
  useEffect(() => {
    if (!barber) return;
    import("@/lib/api").then(({ apiGetBarbers }) => {
      apiGetBarbers().then(({ barbers: all }) => {
        const similar = all
          .filter((b) => b.id !== id)
          .map((b) => {
            const specOverlap = b.specialties.filter((s) =>
              barber.specialties.some(
                (bs) => bs.toLowerCase() === s.toLowerCase() ||
                  bs.toLowerCase().includes(s.toLowerCase()) ||
                  s.toLowerCase().includes(bs.toLowerCase())
              )
            ).length;
            const sameCity = b.location.split(",")[1]?.trim() === barber.location.split(",")[1]?.trim();
            return { barber: b, score: specOverlap * 2 + (sameCity ? 1 : 0) };
          })
          .filter(({ score }) => score > 0)
          .sort((a, b2) => b2.score - a.score)
          .slice(0, 3)
          .map(({ barber: b }) => b);
        setSimilarBarbers(similar);
      }).catch(() => {});
    });
  }, [id, barber]);

  // Load booked intervals from API — blocks already-booked slots in booking calendar
  useEffect(() => {
    apiGetBookings({ barberId: id }).then((bookings) => {
      const map: Record<string, Interval[]> = {};
      for (const b of bookings) {
        const dateKey = isoDate(new Date(b.date));
        if (!map[dateKey]) map[dateKey] = [];
        const startMins = parseTimeToMinutes(b.time);
        const endTime = (b as { endTime?: string }).endTime;
        let endMins: number;
        if (endTime) {
          endMins = parseTimeToMinutes(endTime);
        } else if (b.duration) {
          endMins = startMins + b.duration;
        } else {
          endMins = startMins + 60;
        }
        map[dateKey].push({ start: startMins, end: endMins });
      }
      setBookedIntervalMap(map);
    }).catch(() => {});
  }, [id, availRefreshKey]);

  // Keep availability in sync: poll every 10s for user-created pros
  useEffect(() => {
    if (isStaticBarber) return;
    const interval = setInterval(() => {
      apiGetAvailability(id).then((slots) => {
        if (Object.keys(slots).length > 0) setProAvailData(slots as Record<string, TimeBlock[]>);
        else setProAvailData(null);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id, isStaticBarber]);


  // Handle URL params: ?review=1, ?tab=, ?service=, ?reschedule=
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    // ?tab= param (used by bookings "Book again" link)
    const tabParam = params.get("tab");
    if (tabParam === "booking" || tabParam === "portfolio" || tabParam === "reviews") {
      setTab(tabParam as TabKey);
    }

    // ?service= param (pre-select service when reboooking)
    const serviceParam = params.get("service");
    if (serviceParam) setPreselectedService(decodeURIComponent(serviceParam));

    // ?review=1 — jump to reviews tab and scroll to the review form
    if (params.get("review") === "1") {
      setTab("reviews");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          reviewFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }

    // ?reschedule=${bookingId} — jump to booking tab with reschedule context
    const rescheduleParam = params.get("reschedule");
    if (rescheduleParam) {
      setRescheduleBookingId(rescheduleParam);
      setTab("booking");
      const user = getCurrentUser();
      if (user) {
        apiGetBookings({ userId: user.id, barberId: id }).then((bks) => {
          const found = bks.find((b) => b.id === rescheduleParam);
          if (found) {
            setRescheduleOriginalService(found.service);
            setPreselectedService(found.service);
          }
        }).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset expanded segment when the selected date changes
  useEffect(() => { setExpandedSegIdx(null); }, [selectedDate]);

  // Load reviews and favorites from API
  useEffect(() => {
    // Reviews
    apiGetReviews(id).then((reviews) => {
      setExtraReviews(reviews.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        rating: r.rating,
        text: r.text,
        date: r.date,
        reply: r.reply,
      })));
      // Build reply map from reviews — keyed by userId_date to match render logic
      const replies: Record<string, string> = {};
      reviews.forEach((r) => { if (r.reply) replies[`${r.userId}_${r.date}`] = r.reply; });
      setReviewReplies(replies);
    }).catch(() => {});

    // Favorites
    const user = getCurrentUser();
    if (user) {
      apiGetFavorites(user.id).then((ids) => setSaved(ids.includes(id))).catch(() => {});
    }
  }, [id]);

  const toggleSaved = async () => {
    const user = getCurrentUser();
    if (!user) { router.push("/login"); return; }
    const newSaved = !saved;
    setSaved(newSaved);
    try {
      const ids = await apiGetFavorites(user.id);
      const updated = newSaved ? [...ids.filter(x => x !== id), id] : ids.filter(x => x !== id);
      await apiUpdateFavorites(user.id, updated);
    } catch { setSaved(!newSaved); } // revert on error
  };

  // ── Availability computation ────────────────────────────────────────────────
  // spansMap: raw barber-defined spans (used for confirm-time validation)
  // slotsMap: discrete 30-min start times (drives UI display) — auto-recomputes
  //           whenever bookedIntervalMap changes, so cancellations restore slots instantly.
  const spansMap: Record<string, TimeBlock[]> = (() => {
    if (!barber) return {};
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const map: Record<string, TimeBlock[]> = {};
    for (let d = 1; d <= 180; d++) {
      const date = new Date(base);
      date.setDate(base.getDate() + d);
      const key = isoDate(date);
      const blocks: TimeBlock[] = proAvailData
        ? (proAvailData[key] ?? [])
        : isStaticBarber && barber
        ? getDemoBlocksForDate(barber.id, date)
        : [];
      if (blocks.length > 0) map[key] = blocks;
    }
    return map;
  })();

  const slotsMap: Record<string, string[]> = (() => {
    const map: Record<string, string[]> = {};
    for (const [key, spans] of Object.entries(spansMap)) {
      const slots = generateAvailableSlots(spans, bookedIntervalMap[key] ?? []);
      if (slots.length > 0) map[key] = slots;
    }
    return map;
  })();

  // Calendar month navigation helpers
  const goToPrevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const handleBookService = (serviceName: string) => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setPreselectedService(serviceName);
    setSelectedDate(null);
    setBookingSlot(null);
    setTab("booking");
    setTimeout(() => {
      calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleSlotClick = (date: Date, slotTime: string) => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setBookingSlot({ date, time: slotTime });
  };

  // Combine extra (localStorage) reviews with static reviews
  const allReviews = [...extraReviews, ...(barber?.reviews ?? [])];

  // Calculate effective rating from actual reviews
  const effectiveRating =
    allReviews.length > 0
      ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10
      : barber?.rating ?? 0;
  const effectiveCount = allReviews.length;

  // Is the current user the owner of this profile? (pro viewing their own profile)
  const isOwnProfile = !!currentUserProfileId && currentUserProfileId === id;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <h1 className="font-heading font-bold text-3xl text-gray-900 mb-4">Pro not found</h1>
          <p className="text-gray-500 mb-6">We couldn&apos;t find that professional.</p>
          <Link href="/browse" className="btn-primary">Browse Pros</Link>
        </div>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: "portfolio", label: "Portfolio" },
    { key: "booking", label: "Booking" },
    { key: "reviews", label: `Reviews (${effectiveCount})` },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Shared Navbar (always shows profile button) */}
      <Navbar showBack onBack={() => router.back()} />


      {/* Profile header */}
      <div ref={heroRef} className="bg-[var(--color-section-bg)] dark:bg-[#141414] border-b border-[var(--color-primary)]/15">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="relative w-24 h-24 shrink-0">
              <Image
                src={barber.profileImage}
                alt={barber.name}
                fill
                className="object-cover rounded-full border-4 border-white shadow-lg"
                sizes="96px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-gray-900" style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>
                {barber.name}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Stars rating={effectiveRating} />
                <span className="text-sm text-gray-500">
                  {effectiveRating.toFixed(1)} ({effectiveCount} reviews)
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${barber.type === "independent" ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-700"}`}>
                  {barber.type === "independent" ? "Independent" : "Shop"}
                </span>
                {barber.matchPercent && (
                  <span className="text-xs font-bold bg-[var(--color-accent)] text-white px-2.5 py-1 rounded-full">
                    {barber.matchPercent}% match
                  </span>
                )}
              </div>
              <p className="text-gray-500 mt-3 leading-relaxed max-w-[700px] text-sm">{barber.bio}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {barber.experience}
                </span>
                <span>·</span>
                <span>{barber.languages.join(", ")}</span>
                {/* Business hours for real pros */}
                {businessHours && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {(() => {
                        const fmt = (m: number) => {
                          const h = Math.floor(m / 60), min = m % 60;
                          const period = h >= 12 ? "PM" : "AM";
                          const hour = h % 12 || 12;
                          return min === 0 ? `${hour} ${period}` : `${hour}:${min.toString().padStart(2,"0")} ${period}`;
                        };
                        return `${fmt(businessHours.open)} – ${fmt(businessHours.close)}`;
                      })()}
                    </span>
                  </>
                )}
              </div>
              {/* Share button — below details */}
              {!isOwnProfile && (
                <button
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      navigator.share({ title: `${barber.name} on Sniply`, url });
                    } else {
                      navigator.clipboard.writeText(url).then(() => alert("Link copied!"));
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share profile
                </button>
              )}
            </div>
            {/* Right column: price + action buttons */}
            <div className="w-full sm:w-auto sm:shrink-0 flex flex-col items-start sm:items-end gap-3">
              <div className="text-left sm:text-right">
                <p className="text-xs text-gray-400">Starting from</p>
                <p className="font-bold text-2xl text-[var(--color-primary)]">${barber.startingPrice}</p>
              </div>
              {!isOwnProfile && (
                <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
                  {/* Book Now button */}
                  <button
                    onClick={() => {
                      setTab("booking");
                      setTimeout(() => {
                        calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 80);
                    }}
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[#243A6F] transition-colors px-5 h-11 rounded-xl shadow-sm w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Book Now
                  </button>
                  {/* Message button */}
                  <button
                    onClick={() => {
                      const user = getCurrentUser();
                      if (!user) { router.push("/login"); return; }
                      setShowMessageModal(true);
                    }}
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[#243A6F] transition-colors px-5 h-11 rounded-xl shadow-sm w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Message
                  </button>
                  {/* Save button */}
                  <button
                    onClick={() => void toggleSaved()}
                    className={`flex items-center justify-center gap-2 text-sm font-semibold h-11 px-5 rounded-xl border-2 transition-all w-full sm:w-auto ${
                      saved
                        ? "text-[var(--color-accent)] border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 hover:bg-[var(--color-accent)]/15"
                        : "text-gray-600 border-gray-200 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] bg-white"
                    }`}
                  >
                    <svg className="w-4 h-4" fill={saved ? "var(--color-accent)" : "none"} stroke={saved ? "var(--color-accent)" : "currentColor"} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    {saved ? "Saved" : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Shop info for shop-based barbers */}
          {barber.type === "shop" && barber.shopName && barber.shopImage && (
            <div className="mt-6">
              <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 transition-all cursor-pointer group">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0">
                  <Image src={barber.shopImage} alt={barber.shopName} fill className="object-cover" sizes="80px" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Works at</p>
                  <p className="font-heading font-bold text-gray-900 text-base group-hover:text-[var(--color-primary)] transition-colors">
                    {barber.shopName}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {barber.shopAddress}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-[var(--color-primary)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 ml-1">Shop profile coming soon</p>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="sticky top-[68px] z-30 bg-[var(--color-section-bg)] dark:bg-[#111111] border-b border-[var(--color-primary)]/15">
        <div className="max-w-[1200px] mx-auto px-6 flex overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 sm:px-5 py-3 sm:py-4 text-sm sm:text-[15px] font-semibold whitespace-nowrap border-b-[3px] transition-all duration-200 ${
                tab === key
                  ? "text-gray-900 border-[var(--color-primary)]"
                  : "text-gray-400 border-transparent hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-gray-50 min-h-[600px] pb-16">
        <div className="max-w-[1200px] mx-auto px-6 py-10">

          {/* ── PORTFOLIO (with About info at top) ── */}
          {tab === "portfolio" && (
            <div>
              {/* About info at top of portfolio */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 max-w-[800px]">
                <h2 className="font-heading font-bold text-gray-900 text-lg mb-4">About {barber.name}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Experience", value: barber.experience },
                    { label: "Hair Types Specialized In", value: barber.hairTypes.join(", ") },
                    { label: "Specialties", value: barber.specialties.join(", ") },
                    { label: "Languages", value: barber.languages.join(", ") },
                    ...(barber.type === "independent"
                      ? [{ label: "Location", value: barber.fullAddress }]
                      : [{ label: "Shop", value: `${barber.shopName} — ${barber.shopAddress}` }]),
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                      <p className="text-gray-800 text-sm">{value}</p>
                    </div>
                  ))}
                </div>
                {(barber.credentials ?? (barber as ProProfile).certifications) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Credentials</p>
                    <ul className="space-y-1">
                      {barber.credentials
                        ? barber.credentials.filter(c => c.text).map((c, i) => (
                          <li key={i} className="text-sm text-gray-800 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                            <span className="flex-1">{c.text}</span>
                            {c.fileData && (
                              <button
                                onClick={() => { const w = window.open(); if (w) { w.document.write(`<iframe src="${c.fileData}" style="width:100%;height:100vh;border:none;"></iframe>`); } }}
                                className="text-xs font-semibold text-[var(--color-primary)] hover:underline shrink-0 ml-1"
                              >
                                View
                              </button>
                            )}
                          </li>
                        ))
                        : ((barber as ProProfile).certifications ?? []).filter(Boolean).map((cert, i) => (
                          <li key={i} className="text-sm text-gray-800 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                            {cert}
                          </li>
                        ))
                      }
                    </ul>
                  </div>
                )}
              </div>

              {/* Portfolio grid */}
              {barber.portfolioImages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {barber.portfolioImages.map((src, i) => (
                    <div
                      key={i}
                      className="aspect-square relative overflow-hidden rounded-xl cursor-pointer group"
                      onClick={() => setLightbox(src)}
                    >
                      <Image
                        src={src}
                        alt={`Portfolio ${i + 1}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">📷</div>
                  <p className="text-gray-500 font-medium">No portfolio images yet</p>
                </div>
              )}
            </div>
          )}

          {/* ── BOOKING (Services + Schedule) ── */}
          {tab === "booking" && (
            <div className="max-w-[680px]">
              {/* Reschedule banner */}
              {rescheduleBookingId && (
                <div className="mb-6 bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20 rounded-xl px-5 py-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-primary)]">Rescheduling your appointment</p>
                    <p className="text-xs text-[var(--color-primary)]/70 mt-0.5">
                      Select a new date and time below.{rescheduleOriginalService && <> Your current <strong>{rescheduleOriginalService}</strong> appointment</>} will be cancelled when you confirm.
                    </p>
                  </div>
                </div>
              )}
              {/* Services — with Book Now per service */}
              <h2 className="font-heading font-bold text-gray-900 text-xl mb-5">Services</h2>
              <div className="space-y-4 mb-8">
                {barber.services.map((svc) => {
                  const svcImages = (svc as { images?: string[] }).images ?? [];
                  return (
                    <div key={svc.name} className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading font-bold text-gray-900 text-base">{svc.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{svc.description}</p>
                          <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {svc.duration} min
                            <span className="mx-1.5 text-gray-300">·</span>
                            <span className="text-[var(--color-primary)] font-bold">${svc.price}</span>
                          </div>
                        </div>
                        {!isOwnProfile && (
                          <button
                            onClick={() => handleBookService(svc.name)}
                            className="btn-primary w-full sm:w-auto shrink-0 text-sm flex items-center justify-center gap-1.5"
                            style={{ height: "44px", paddingLeft: "16px", paddingRight: "16px" }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Book Now
                          </button>
                        )}
                      </div>
                      {svcImages.length > 0 && (
                        <div className="flex gap-2 mt-3 overflow-x-auto">
                          {svcImages.map((img, i) => (
                            <div
                              key={i}
                              className="w-20 h-20 rounded-lg overflow-hidden shrink-0 cursor-pointer"
                              onClick={() => setLightbox(img)}
                            >
                              <img src={img} alt={`${svc.name} example ${i + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {barber.services.length === 0 && (
                  <p className="text-gray-500 text-center py-10">Services and pricing coming soon</p>
                )}
              </div>

              {barber.services.length > 0 && <div className="border-t border-gray-200 mb-8" />}

              {/* No schedule set yet (real pro profile only) */}
              {!proAvailData && !isStaticBarber ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-700 mb-1">Availability not set yet</p>
                  <p className="text-sm text-gray-400">This pro hasn&apos;t published their schedule yet. Check back soon or send them a message.</p>
                </div>
              ) : (
                <>
                  <div ref={calendarRef} style={{ scrollMarginTop: "130px" }}>
                  <h2 className="font-heading font-bold text-gray-900 text-xl mb-1">Select a Date and Time</h2>
                  {preselectedService && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-gray-500">Booking:</span>
                      <span className="text-sm font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/8 px-3 py-1 rounded-full">{preselectedService}</span>
                      <button
                        onClick={() => setPreselectedService(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mb-5">Choose a date and available time slot to book your appointment</p>

                  {/* ── Monthly Calendar ── */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={goToPrevMonth}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <h3 className="font-semibold text-gray-900 text-base">{FULL_MONTH_NAMES[calMonth]} {calYear}</h3>
                      <button
                        onClick={goToNextMonth}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>

                    {/* Weekday headers (Mon–Sun) */}
                    <div className="grid grid-cols-7 mb-1">
                      {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                        <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
                      ))}
                    </div>

                    {/* Day grid */}
                    {(() => {
                      const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
                      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                      const calToday = new Date(); calToday.setHours(0, 0, 0, 0);
                      return (
                        <div className="grid grid-cols-7 gap-0.5">
                          {Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)}
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const date = new Date(calYear, calMonth, day);
                            const dateKey = isoDate(date);
                            const isPast = date < calToday;
                            const isCalToday = date.getTime() === calToday.getTime();
                            const hasSlots = !!slotsMap[dateKey]?.length;
                            const isSelected = selectedDate ? isoDate(selectedDate) === dateKey : false;
                            return (
                              <button
                                key={day}
                                disabled={isPast || !hasSlots}
                                onClick={() => setSelectedDate(date)}
                                className={`h-9 rounded-lg text-sm font-medium transition-all w-full
                                  ${isSelected ? "bg-[var(--color-primary)] text-white shadow-sm" : ""}
                                  ${!isSelected && hasSlots && !isPast ? "hover:bg-[var(--color-primary)]/10 text-gray-800" : ""}
                                  ${isPast ? "text-gray-300 cursor-not-allowed" : ""}
                                  ${!hasSlots && !isPast ? "text-gray-300 cursor-not-allowed" : ""}
                                  ${isCalToday && !isSelected ? "ring-2 ring-[var(--color-primary)]/50 font-bold" : ""}
                                `}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Legend */}
                    <div className="flex items-center gap-5 mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] inline-block" />
                        Available
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />
                        Unavailable
                      </span>
                    </div>
                  </div>

                  {/* ── Fluid timeline for selected date ── */}
                  {selectedDate && (spansMap[isoDate(selectedDate)] ?? []).length > 0 ? (() => {
                    const dateKey   = isoDate(selectedDate);
                    const spans     = spansMap[dateKey] ?? [];
                    const booked    = bookedIntervalMap[dateKey] ?? [];
                    // Clip availability spans to the pro's business hours so customers
                    // never see or book outside the hours the pro has configured.
                    const clippedSpans = businessHours
                      ? spans
                          .map(s => ({
                            ...s,
                            start: minutesToTimeStr(Math.max(parseTimeToMinutes(s.start), businessHours.open)),
                            end:   minutesToTimeStr(Math.min(parseTimeToMinutes(s.end),   businessHours.close)),
                          }))
                          .filter(s => parseTimeToMinutes(s.start) < parseTimeToMinutes(s.end))
                      : spans;
                    const freeSegs  = computeFreeSegments(clippedSpans, booked);
                    const dayStart  = clippedSpans.length > 0 ? Math.min(...clippedSpans.map(s => parseTimeToMinutes(s.start))) : 0;
                    const dayEnd    = clippedSpans.length > 0 ? Math.max(...clippedSpans.map(s => parseTimeToMinutes(s.end)))   : 0;
                    const dayLen    = dayEnd - dayStart || 1;

                    const preServiceObj = preselectedService ? barber.services.find(s => s.name === preselectedService) : null;
                    const preServiceDur = preServiceObj?.duration ?? 0;
                    const maxFreeLen    = freeSegs.length > 0 ? Math.max(...freeSegs.map(s => s.end - s.start)) : 1;

                    return (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-4">
                          {DAY_NAMES[selectedDate.getDay()]}, {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}
                        </p>

                        {/* Proportional timeline bar */}
                        {(() => {
                          // Use configured business hours for the range if available,
                          // otherwise fall back to the span-derived range.
                          const iStart = businessHours?.open  ?? dayStart;
                          const iEnd   = businessHours?.close ?? dayEnd;
                          const iLen   = iEnd - iStart || 1;

                          // Generate an hourly tick for every whole hour in the range
                          const firstHour = Math.ceil(iStart / 60) * 60;
                          const hourTicks: number[] = [];
                          for (let m = firstHour; m <= iEnd; m += 60) hourTicks.push(m);

                          // Show a label every N hours so they don't crowd each other
                          const hourCount = Math.round(iLen / 60);
                          const labelStep = hourCount > 8 ? 2 : 1;

                          return (
                            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 shadow-sm">
                              {/* Bar */}
                              <div className="relative h-9 rounded-lg overflow-hidden bg-gray-200">
                                {/* Free segments — brand blue */}
                                {freeSegs.map((seg, i) => {
                                  const left  = (seg.start - iStart) / iLen * 100;
                                  const width = (seg.end - seg.start) / iLen * 100;
                                  return (
                                    <div
                                      key={i}
                                      className="absolute inset-y-0 bg-[var(--color-primary)]"
                                      style={{ left: `${left}%`, width: `${width}%` }}
                                    />
                                  );
                                })}
                                {/* Booked segments — rose red */}
                                {booked.map((bk, i) => {
                                  const s = Math.max(bk.start, iStart);
                                  const e = Math.min(bk.end, iEnd);
                                  if (e <= s) return null;
                                  const left  = (s - iStart) / iLen * 100;
                                  const width = (e - s) / iLen * 100;
                                  return (
                                    <div
                                      key={i}
                                      className="absolute inset-y-0 bg-rose-400 flex items-center justify-center"
                                      style={{ left: `${left}%`, width: `${width}%` }}
                                    >
                                      {width > 8 && <span className="text-[8px] text-white font-bold tracking-wide">booked</span>}
                                    </div>
                                  );
                                })}
                                {/* Hourly grid lines */}
                                {hourTicks.map((m) => {
                                  const pct = (m - iStart) / iLen * 100;
                                  if (pct <= 0 || pct >= 100) return null;
                                  return (
                                    <div
                                      key={m}
                                      className="absolute inset-y-0 w-px bg-white/50 pointer-events-none"
                                      style={{ left: `${pct}%` }}
                                    />
                                  );
                                })}
                              </div>

                              {/* Time labels below bar */}
                              <div className="relative mt-1.5" style={{ height: "14px" }}>
                                {/* Edge labels */}
                                <span className="absolute text-[9px] font-medium text-gray-400 whitespace-nowrap" style={{ left: 0 }}>
                                  {fmtHourLabel(iStart)}
                                </span>
                                <span className="absolute text-[9px] font-medium text-gray-400 whitespace-nowrap" style={{ right: 0 }}>
                                  {fmtHourLabel(iEnd)}
                                </span>
                                {/* Hour labels (skip if too close to edges) */}
                                {hourTicks.map((m, idx) => {
                                  const pct = (m - iStart) / iLen * 100;
                                  if (pct <= 4 || pct >= 96) return null;
                                  if (idx % labelStep !== 0) return null;
                                  return (
                                    <span
                                      key={m}
                                      className="absolute text-[9px] font-medium text-gray-400 whitespace-nowrap"
                                      style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                                    >
                                      {fmtHourLabel(m)}
                                    </span>
                                  );
                                })}
                              </div>

                              {/* Legend */}
                              <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-gray-100 text-[10px] text-gray-400">
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block w-3 h-3 rounded-sm bg-[var(--color-primary)]" />Free
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block w-3 h-3 rounded-sm bg-rose-400" />Booked
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" />Unavailable
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Free segment tiles */}
                        {freeSegs.length === 0 ? (
                          <div className="text-center py-10 text-gray-400">
                            <p className="font-medium text-gray-600">Fully booked today</p>
                            <p className="text-sm mt-1">Try selecting a different date</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {preServiceDur > 0 && (
                              <p className="text-xs text-gray-400 mb-2">
                                Booking <span className="font-semibold text-[var(--color-primary)]">{preselectedService}</span> ({preServiceDur} min) —
                                only windows long enough are open below.
                              </p>
                            )}
                            {freeSegs.map((seg, segIdx) => {
                              const segDur    = seg.end - seg.start;
                              const fits      = preServiceDur === 0 || segDur >= preServiceDur;
                              const isOpen    = expandedSegIdx === segIdx;

                              // Start times within this free window at 30-min increments,
                              // clamped so the chosen service still finishes before seg.end.
                              // When no service is pre-selected, use the barber's shortest service
                              // duration so we never show a start time that no service can fill.
                              const minServiceDur = barber.services && barber.services.length > 0
                                ? Math.min(...barber.services.map(s => s.duration))
                                : SLOT_INCREMENT;
                              const effectiveMinDur = preServiceDur > 0 ? preServiceDur : minServiceDur;
                              const latestStart = seg.end - effectiveMinDur;
                              const startTimes: string[] = [];
                              for (let s = seg.start; s <= latestStart; s += SLOT_INCREMENT) {
                                startTimes.push(minutesToTimeStr(s));
                              }

                              return (
                                <div
                                  key={segIdx}
                                  className={`rounded-2xl border-2 transition-all overflow-hidden ${
                                    !fits
                                      ? "border-gray-200 bg-gray-50/80 opacity-60 cursor-not-allowed"
                                      : isOpen
                                      ? "border-[var(--color-primary)] bg-white shadow-md"
                                      : "border-gray-200 bg-white hover:border-[var(--color-primary)]/50 hover:shadow-sm cursor-pointer"
                                  }`}
                                >
                                  {/* Tile header */}
                                  <button
                                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
                                    onClick={() => fits && setExpandedSegIdx(isOpen ? null : segIdx)}
                                    disabled={!fits}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-gray-900">
                                        {minutesToTimeStr(seg.start)} – {minutesToTimeStr(seg.end)}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {/* Proportional width bar */}
                                        <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${fits ? "bg-[var(--color-primary)]/50" : "bg-gray-300"}`}
                                            style={{ width: `${Math.min(100, segDur / maxFreeLen * 100)}%` }}
                                          />
                                        </div>
                                        <p className={`text-xs font-medium ${fits ? "text-[var(--color-primary)]" : "text-gray-400"}`}>
                                          {fmtDuration(segDur)} free
                                        </p>
                                        {!fits && preServiceDur > 0 && (
                                          <p className="text-xs text-gray-400">· need {fmtDuration(preServiceDur)}</p>
                                        )}
                                      </div>
                                    </div>
                                    {fits && (
                                      <svg
                                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    )}
                                  </button>

                                  {/* Expanded: start-time chips */}
                                  {isOpen && fits && (
                                    <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                                        {preServiceDur > 0 ? `Start times (${preServiceDur} min service)` : "Pick a start time"}
                                      </p>
                                      {startTimes.length === 0 ? (
                                        <p className="text-xs text-gray-400">Window too short for this service.</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {startTimes.map((slotTime) => (
                                            <button
                                              key={slotTime}
                                              onClick={() => handleSlotClick(selectedDate, slotTime)}
                                              className="px-4 py-2 min-h-[44px] sm:min-h-0 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all"
                                            >
                                              {slotTime}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })() : selectedDate ? (
                    <WaitlistPrompt barberName={barber.name} date={selectedDate} />
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Select a date from the calendar above</p>
                    </div>
                  )}
                  </div>{/* /calendarRef */}
                </>
              )}
            </div>
          )}

          {/* ── REVIEWS ── */}
          {tab === "reviews" && (
            <div className="space-y-4 max-w-[700px]">
              {allReviews.length > 0 ? (
                <>
                  {allReviews.map((rev, i) => {
                    const revName = 'userName' in rev ? rev.userName : rev.name;
                    const replyKey = `${(rev as StoredReview).userId || revName}_${rev.date}`;
                    const existingReply = reviewReplies[replyKey];
                    const isReplying = replyingTo === replyKey;
                    return (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-1">
                          <Stars rating={rev.rating} />
                          <span className="text-[var(--color-accent)] font-bold text-sm ml-1">{rev.rating}.0</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          <span className="font-semibold text-gray-700">{revName}</span>
                          {" · "}{rev.date}
                        </p>
                        <p className="text-gray-700 mt-3 leading-relaxed text-sm">&ldquo;{rev.text}&rdquo;</p>
                        {(rev as StoredReview).photos && (rev as StoredReview).photos!.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {(rev as StoredReview).photos!.map((src, pi) => (
                              <button
                                key={pi}
                                type="button"
                                onClick={() => setLightbox(src)}
                                className="w-20 h-20 rounded-lg overflow-hidden border border-gray-100 hover:opacity-90 transition-opacity"
                              >
                                <img src={src} alt={`Review photo ${pi + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Pro reply */}
                        {existingReply && !isReplying && (
                          <div className="mt-3 pl-4 border-l-2 border-[var(--color-primary)]/20 bg-[var(--color-primary)]/4 rounded-r-lg p-3">
                            <p className="text-xs font-bold text-[var(--color-primary)] mb-1">Response from {barber.name.split(" ")[0]}</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{existingReply}</p>
                          </div>
                        )}

                        {/* Reply input (own profile only, DB reviews only — not static seed reviews) */}
                        {isOwnProfile && i < extraReviews.length && (
                          isReplying ? (
                            <div className="mt-3 space-y-2">
                              <textarea
                                autoFocus
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                                placeholder="Write a response to this review…"
                                rows={3}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/30 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (!replyDraft.trim()) return;
                                    const replyText = replyDraft.trim();
                                    const updated = { ...reviewReplies, [replyKey]: replyText };
                                    setReviewReplies(updated);
                                    const revId = (rev as StoredReview).id;
                                    if (revId != null) void apiReplyToReview(id, revId, replyText);
                                    setReplyingTo(null);
                                    setReplyDraft("");
                                  }}
                                  className="btn-primary text-xs"
                                  style={{ height: 32, padding: "0 14px", fontSize: 13 }}
                                >
                                  Post Response
                                </button>
                                <button
                                  onClick={() => { setReplyingTo(null); setReplyDraft(""); }}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setReplyingTo(replyKey); setReplyDraft(existingReply ?? ""); }}
                              className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                            >
                              {existingReply ? "Edit response" : "Reply"}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-16">
                  <p className="text-gray-500 font-medium mb-1">No reviews yet</p>
                  <p className="text-sm text-gray-400">Be the first to leave a review!</p>
                </div>
              )}

              {!isOwnProfile && (
                <div ref={reviewFormRef}>
                  <ReviewForm
                    barber={barber}
                    existingReviews={extraReviews}
                    onSubmit={(review) => setExtraReviews((prev) => [review, ...prev])}
                    hasBooked={userBookings.length > 0}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Similar Pros */}
      {similarBarbers.length > 0 && (
        <div className="bg-gray-50 border-t border-gray-200 py-10">
          <div className="max-w-[1200px] mx-auto px-6">
            <h2 className="font-heading font-bold text-gray-900 text-xl mb-6">Similar Pros</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarBarbers.map((b) => (
                <BarberCard
                  key={b.id}
                  id={b.id}
                  name={b.name}
                  rating={b.rating}
                  reviewCount={b.reviewCount}
                  location={b.location}
                  type={b.type}
                  startingPrice={b.startingPrice}
                  specialties={b.specialties}
                  heroImage={b.heroImage}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
            onClick={() => setLightbox(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="relative w-full max-w-3xl"
            style={{ height: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox}
              alt="Portfolio full size"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        </div>
      )}


      {/* Booking Modal */}
      {bookingSlot && (
        <BookingModal
          barber={barber}
          selectedSlot={bookingSlot}
          preselectedService={preselectedService}
          spansForDate={spansMap[isoDate(bookingSlot.date)] ?? []}
          bookedForDate={bookedIntervalMap[isoDate(bookingSlot.date)] ?? []}
          onClose={() => { setBookingSlot(null); setPreselectedService(null); }}
          onBooked={() => { setAvailRefreshKey((k) => k + 1); const u = getCurrentUser(); if (u) apiGetBookings({ userId: u.id, barberId: id }).then(setUserBookings).catch(() => {}); }}
          rescheduleBookingId={rescheduleBookingId}
          onRescheduled={() => { setRescheduleBookingId(null); setRescheduleOriginalService(null); setAvailRefreshKey((k) => k + 1); const u = getCurrentUser(); if (u) apiGetBookings({ userId: u.id, barberId: id }).then(setUserBookings).catch(() => {}); }}
          userBookings={userBookings}
        />
      )}

      {/* Message Modal */}
      {showMessageModal && currentUser && (
        <MessageModal
          barber={barber}
          currentUser={currentUser}
          onClose={() => setShowMessageModal(false)}
        />
      )}
    </div>
  );
}
