"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { apiGetBookings, apiUpdateBooking } from "@/lib/api";
import type { Booking } from "@/lib/types";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading bookings...</p>
      </div>
    </div>
  );
}

function isWithin24Hours(dateStr: string, timeStr: string): boolean {
  try {
    const appt = new Date(dateStr);
    const [time, period] = timeStr.split(" ");
    const [hStr, mStr] = time.split(":");
    let h = parseInt(hStr);
    const m = parseInt(mStr || "0");
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    appt.setHours(h, m, 0, 0);
    return (appt.getTime() - Date.now()) < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function getRelativeLabel(dateStr: string): string | null {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appt = new Date(dateStr);
    appt.setHours(0, 0, 0, 0);
    const diff = appt.getTime() - today.getTime();
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1 && days <= 7) return `In ${days} days`;
    return null;
  } catch {
    return null;
  }
}

function getCancellationDeadline(dateStr: string, timeStr: string): string {
  try {
    const appt = new Date(dateStr);
    const [time, period] = timeStr.split(" ");
    const [hStr, mStr] = time.split(":");
    let h = parseInt(hStr);
    const m = parseInt(mStr || "0");
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    appt.setHours(h, m, 0, 0);
    const deadline = new Date(appt.getTime() - 24 * 60 * 60 * 1000);
    return deadline.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " by " + deadline.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "24 hours before";
  }
}

export default function BookingsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("sniply_storage_warn_dismissed") === "1") {
        setStorageWarningDismissed(true);
      }
    } catch (err) {
      console.error("sniply/bookings: failed to read storage warning state", err);
    }
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role === "pro") {
      router.replace("/pro/dashboard");
      return;
    }

    apiGetBookings({ userId: user.id })
      .then((bks) => setBookings(bks))
      .catch((err) => console.error("sniply/bookings: failed to load bookings", err))
      .finally(() => setLoading(false));
  }, [router]);

  const handleCancel = async (bookingId: string, barberName: string) => {
    try {
      await apiUpdateBooking(bookingId, { cancelled: true, status: "cancelled" });
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      addToast(`Booking with ${barberName} cancelled.`, "info");
    } catch {
      addToast("Failed to cancel booking. Please try again.", "error");
    }
  };

  if (loading) return <LoadingSpinner />;

  const upcoming = bookings.filter((b) => new Date(b.date) >= new Date());
  const past = bookings.filter((b) => new Date(b.date) < new Date());

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] dark:bg-black">
      <Navbar />
      <main className="max-w-[720px] mx-auto px-6 py-10 animate-fade-in-up">
        <h1 className="font-heading font-bold text-gray-900 text-2xl sm:text-3xl mb-6">My Bookings</h1>

        {/* localStorage volatility warning (one-time) */}
        {!storageWarningDismissed && (
          <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-700 flex-1">
              Your data is saved locally in this browser. Use the same browser and device to access your bookings.
            </p>
            <button
              onClick={() => {
                setStorageWarningDismissed(true);
                try { localStorage.setItem("sniply_storage_warn_dismissed", "1"); } catch (err) { console.error("sniply/bookings: failed to persist storage warning dismissed state", err); }
              }}
              className="text-amber-400 hover:text-amber-600 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="bg-white border border-[var(--color-primary)]/12 rounded-2xl p-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/8 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-primary)]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-heading font-bold text-gray-900 text-xl mb-2">No bookings yet</h2>
            <p className="text-gray-500 text-sm mb-6">Browse pros and book your first appointment.</p>
            <Link href="/browse" className="btn-primary" style={{ display: "inline-flex", height: "44px", alignItems: "center", padding: "0 24px" }}>
              Browse Pros
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  Upcoming
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {upcoming.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} booking={b} isUpcoming onCancel={handleCancel} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  Past
                  <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {past.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {past.map((b) => (
                    <BookingCard key={b.id} booking={b} isUpcoming={false} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function BookingCard({
  booking: b,
  isUpcoming,
  onCancel,
}: {
  booking: Booking;
  isUpcoming: boolean;
  onCancel?: (id: string, barberName: string) => void;
}) {
  const [cancelPending, setCancelPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const date = new Date(b.date);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const isoDateStr = date.toISOString().split("T")[0];
  const relativeLabel = isUpcoming ? getRelativeLabel(b.date) : null;

  // Use booking's stored price/duration directly
  const serviceDuration = b.duration;
  const servicePrice = b.price;

  const mapsUrl = null; // address not stored in booking; users can search by barber name

  const cancellationDeadline = isUpcoming ? getCancellationDeadline(b.date, b.time) : null;
  const cancelLocked = isUpcoming && isWithin24Hours(b.date, b.time);

  return (
    <div className="bg-white border border-[var(--color-primary)]/12 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      {/* Main row */}
      <div
        className="p-5 flex items-center gap-4 cursor-pointer"
        onClick={() => setExpanded((x) => !x)}
      >
        {/* Date block */}
        <div className="w-14 h-14 rounded-xl bg-[var(--color-primary)]/8 flex flex-col items-center justify-center shrink-0">
          <p className="text-xs font-bold text-[var(--color-primary)] uppercase">
            {date.toLocaleDateString("en-US", { month: "short" })}
          </p>
          <p className="text-xl font-bold text-[var(--color-primary)] leading-none tabular-nums">
            {date.getDate()}
          </p>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{b.barberName}</p>
          <p className="text-sm text-gray-500">{b.service}</p>
          <time dateTime={`${isoDateStr}T${b.time}`} className="text-xs text-gray-400 mt-0.5 block">
            {dateStr} · {b.time}{b.endTime ? ` – ${b.endTime}` : ""}
          </time>
          {relativeLabel && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              {relativeLabel}
            </span>
          )}
        </div>

        {/* Right side: status + expand toggle */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              isUpcoming
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isUpcoming ? "Upcoming" : "Completed"}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[var(--color-primary)]/08 pt-4 space-y-4">
          {/* Service details */}
          {(serviceDuration || servicePrice) && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/8 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Service</p>
                <p className="text-sm text-gray-800 mt-0.5">{b.service}</p>
                <p className="text-xs text-gray-500">
                  {serviceDuration ? `${serviceDuration} min` : ""}
                  {serviceDuration && servicePrice ? " · " : ""}
                  {servicePrice ? <span className="font-semibold text-[var(--color-primary)]">${servicePrice}</span> : ""}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {b.notes && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/8 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Your Notes</p>
                <p className="text-sm text-gray-800 mt-0.5">{b.notes}</p>
              </div>
            </div>
          )}

          {/* Cancellation deadline */}
          {isUpcoming && (
            cancelLocked ? (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span><span className="font-semibold">Cancellation unavailable</span> — appointment is within 24 hours</span>
              </div>
            ) : cancellationDeadline ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span><span className="font-semibold">Cancel by</span> {cancellationDeadline} for a full refund</span>
              </div>
            ) : null
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 gap-y-2 pt-1">
            {/* Message barber */}
            <Link
              href={`/barber/${b.barberId}?tab=booking`}
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:text-[#243A6F] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              View Profile
            </Link>

            {/* Reschedule */}
            {isUpcoming && onCancel && (
              <Link
                href={`/barber/${b.barberId}?reschedule=${b.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Reschedule
              </Link>
            )}

            {/* Cancel */}
            {isUpcoming && onCancel && !cancelLocked && (
              <div className="ml-auto">
                {cancelPending ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onCancel(b.id, b.barberName)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Confirm cancel
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      onClick={() => setCancelPending(false)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCancelPending(true)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Cancel booking
                  </button>
                )}
              </div>
            )}

            {/* Book again + Review for past bookings */}
            {!isUpcoming && (
              <>
                <Link
                  href={`/barber/${b.barberId}?tab=booking&service=${encodeURIComponent(b.service)}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Book again
                </Link>
                <Link
                  href={`/barber/${b.barberId}?review=1`}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Leave a review
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
