"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Stars } from "@/components/Stars";
import { getCurrentUser, type User } from "@/lib/auth";
import { apiGetBarber, apiUpdateBarber, apiGetBookings, apiUpdateBooking, apiGetReviews, apiReplyToReview, apiGetThreads, apiUpdateThreads, apiGetAvailability, apiUpdateAvailability, apiGetBusinessHours, apiUpdateBusinessHours } from "@/lib/api";

type TabKey = "profile" | "services" | "appointments" | "messages" | "analytics";

interface ProProfile {
  id: string;
  name: string;
  bio?: string;
  gender?: string;
  location?: string;
  fullAddress?: string;
  shopName?: string;
  type?: "independent" | "shop";
  experience?: string;
  specialties?: string[];
  hairTypes?: string[];
  languages?: string[];
  credentials?: { text: string; fileName?: string; fileData?: string }[];
  services?: { name: string; description: string; price: number; duration: number; images?: string[] }[];
  startingPrice?: number;
  portfolioImages?: (string | null)[];
  profileImage?: string;
}

interface Booking {
  id: string;
  barberId: string;
  barberName: string;
  service: string;
  date: string;
  time: string;
  duration?: number;
  userId: string;
  userName?: string;
  createdAt?: string;
}

interface MessageThread {
  id: string;
  customerName: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  messages: { from: "pro" | "customer"; text: string; time: string }[];
}

interface StoredReview {
  userId: string;
  name: string;
  rating: number;
  text: string;
  date: string;
}

// ── Image compression (for service photos) ─────────────────────────────────────
async function compressImage(file: File, maxDim = 800, quality = 0.80): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  let srcW: number, srcH: number;
  try {
    const bm = await createImageBitmap(file);
    source = bm; srcW = bm.width; srcH = bm.height;
  } catch {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Unsupported image format."));
        el.src = objectUrl;
      });
      source = img; srcW = img.naturalWidth; srcH = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale), h = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(source as CanvasImageSource, 0, 0, w, h);
  if ("close" in source) (source as ImageBitmap).close();
  const MAX_B64 = Math.round(400 * 1024 / 0.75);
  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > MAX_B64 && q > 0.30) {
    q = Math.max(0.30, q - 0.08);
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

interface DashService { name: string; description: string; price: string; duration: string; images: string[]; }

// ── Schedule types ─────────────────────────────────────────────────────────────
interface TimeBlock {
  id: string;
  start: string; // "9:00 AM"
  end: string;   // "5:00 PM"
}

type DragOp = {
  type: "create" | "move" | "resize-top" | "resize-bottom";
  blockId: string | null;   // null for create
  srcDateKey: string;       // where block originally lives
  curDateKey: string;       // current column
  s: number;                // live start mins
  e: number;                // live end mins
  offsetMins: number;       // for move: offset from block.start where user grabbed
} | null;

// ── Timeline constants ─────────────────────────────────────────────────────────
const HOUR_PX = 60;
const SNAP    = 15;
interface TLBounds { start: number; end: number; hours: number; totalPx: number }

const MONTH_ABBREVS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEK_DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── Time helpers ───────────────────────────────────────────────────────────────
function parseTime(t: string): number {
  const parts = t.trim().split(" ");
  const [hStr, mStr] = parts[0].split(":");
  const h = parseInt(hStr), m = parseInt(mStr || "0");
  return (h % 12 + (parts[1] === "PM" ? 12 : 0)) * 60 + m;
}
function minsToStr(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function toInputTime(t: string): string {
  const m = parseTime(t);
  return `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
}
function fromInputTime(t: string): string {
  if (!t) return "9:00 AM";
  const [h, m] = t.split(":").map(Number);
  return minsToStr(h * 60 + m);
}
function fmtHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function pxToMins(py: number, b: TLBounds): number {
  const raw = b.start * 60 + (Math.max(0, Math.min(b.totalPx, py)) / b.totalPx) * b.hours * 60;
  return Math.round(raw / SNAP) * SNAP;
}
function minsToPx(mins: number, b: TLBounds): number {
  return ((mins - b.start * 60) / (b.hours * 60)) * b.totalPx;
}
// Returns the sub-ranges of [availStart, availEnd] that are not covered by any booking.
function computeAvailSegments(
  availStart: number,
  availEnd: number,
  bookingRanges: { startMins: number; endMins: number }[]
): { start: number; end: number }[] {
  const overlapping = bookingRanges
    .filter(b => b.startMins < availEnd && b.endMins > availStart)
    .sort((a, b) => a.startMins - b.startMins);
  const segments: { start: number; end: number }[] = [];
  let cursor = availStart;
  for (const b of overlapping) {
    const bStart = Math.max(availStart, b.startMins);
    const bEnd   = Math.min(availEnd,   b.endMins);
    if (bStart > cursor) segments.push({ start: cursor, end: bStart });
    cursor = Math.max(cursor, bEnd);
  }
  if (cursor < availEnd) segments.push({ start: cursor, end: availEnd });
  return segments;
}

// ── Week helpers ───────────────────────────────────────────────────────────────
function getMondayOf(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const sm = MONTH_ABBREVS[weekStart.getMonth()];
  const em = MONTH_ABBREVS[weekEnd.getMonth()];
  const start = `${sm} ${weekStart.getDate()}`;
  const end = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekEnd.getDate()}`
    : `${em} ${weekEnd.getDate()}`;
  return `${start} – ${end}, ${weekEnd.getFullYear()}`;
}

// ── Overlap check ──────────────────────────────────────────────────────────────
function blocksOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && e1 > s2;
}
function wouldOverlap(
  dateKey: string,
  newS: number,
  newE: number,
  data: Record<string, TimeBlock[]>,
  excludeId?: string
): boolean {
  const blocks = data[dateKey] ?? [];
  return blocks.some((b) => {
    if (b.id === excludeId) return false;
    return blocksOverlap(newS, newE, parseTime(b.start), parseTime(b.end));
  });
}

// ── Schedule migration ─────────────────────────────────────────────────────────
function migrateToDateKeyed(raw: unknown): Record<string, TimeBlock[]> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length === 0) return {};

  // Already ISO date-keyed
  if (keys.some(k => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
    const result: Record<string, TimeBlock[]> = {};
    for (const [k, v] of Object.entries(r)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v)) result[k] = v as TimeBlock[];
    }
    return result;
  }

  const daysObj: Record<string, unknown> = (r.days && typeof r.days === "object")
    ? (r.days as Record<string, unknown>)
    : r;

  const weeklyBlocks: Record<string, TimeBlock[]> = {};
  for (const abbrev of ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]) {
    const d = daysObj[abbrev];
    if (!d || typeof d !== "object") continue;
    const day = d as { enabled?: boolean; blocks?: TimeBlock[]; start?: string; end?: string; breaks?: { start: string; end: string }[] };
    if (!day.enabled) continue;

    if (day.blocks && day.blocks.length > 0) {
      weeklyBlocks[abbrev] = day.blocks;
    } else if (day.start && day.end) {
      const bks = [...(day.breaks ?? [])].sort((a, b) => parseTime(a.start) - parseTime(b.start));
      const blocks: TimeBlock[] = [];
      let cur = day.start;
      for (const brk of bks) {
        if (parseTime(brk.start) > parseTime(cur)) blocks.push({ id: `${abbrev}-${blocks.length}`, start: cur, end: brk.start });
        cur = brk.end;
      }
      if (parseTime(cur) < parseTime(day.end)) blocks.push({ id: `${abbrev}-${blocks.length}`, start: cur, end: day.end });
      if (blocks.length) weeklyBlocks[abbrev] = blocks;
    }
  }

  if (!Object.keys(weeklyBlocks).length) return {};

  const dayOffsets: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const monday = getMondayOf(new Date());
  const result: Record<string, TimeBlock[]> = {};

  for (let wo = -8; wo <= 8; wo++) {
    for (const [abbrev, blocks] of Object.entries(weeklyBlocks)) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + wo * 7 + (dayOffsets[abbrev] ?? 0));
      const key = toISODate(d);
      result[key] = blocks.map((b, i) => ({ ...b, id: `${key}-${i}` }));
    }
  }

  return result;
}

// ── Booking helpers ────────────────────────────────────────────────────────────
function getBookingDuration(booking: Booking, prof: ProProfile | null): number {
  if (booking.duration) return booking.duration;
  if (!prof?.services) return 60;
  const svc = prof.services.find(s => s.name === booking.service);
  return svc?.duration ?? 60;
}

// ── Message mock data ──────────────────────────────────────────────────────────
const INITIAL_THREADS: MessageThread[] = [
  {
    id: "1", customerName: "Alex Johnson", preview: "Wednesday at 2pm would be perfect!", timestamp: "2h ago", unread: true,
    messages: [
      { from: "customer", text: "Hi! I'd like to book a fade for next week. Do you have any availability?", time: "2h ago" },
      { from: "pro", text: "Hey Alex! Yes, I have openings on Wednesday and Friday. What works for you?", time: "1h 45m ago" },
      { from: "customer", text: "Wednesday at 2pm would be perfect!", time: "1h 30m ago" },
    ],
  },
  {
    id: "2", customerName: "Jordan Smith", preview: "Thanks for the great cut! Can I reschedule?", timestamp: "1d ago", unread: false,
    messages: [{ from: "customer", text: "Thanks for the great cut! Can I reschedule my next appointment to a different time?", time: "1d ago" }],
  },
  {
    id: "3", customerName: "Casey Brown", preview: "Do you do color treatments?", timestamp: "3d ago", unread: false,
    messages: [{ from: "customer", text: "Do you do color treatments? I'm looking for someone to do highlights.", time: "3d ago" }],
  },
];

// ── Portfolio Manager ──────────────────────────────────────────────────────────
function PortfolioManager({ profile, onUpdate }: { profile: ProProfile; onUpdate: (imgs: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const imgs = (profile.portfolioImages ?? []).filter(Boolean) as string[];

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const newImgs: string[] = [];
    for (const file of files) {
      try { newImgs.push(await compressImage(file)); } catch {}
    }
    onUpdate([...imgs, ...newImgs].slice(0, 12));
    setUploading(false);
    e.target.value = "";
  };

  const handleRemove = (idx: number) => {
    onUpdate(imgs.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Portfolio</h3>
        <label className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${uploading ? "opacity-50 cursor-not-allowed" : "border-[#2E4A8B]/30 text-[#2E4A8B] hover:bg-[#2E4A8B]/5"}`}>
          {uploading ? (
            <><div className="w-3 h-3 border border-[#2E4A8B]/30 border-t-[#2E4A8B] rounded-full animate-spin" /> Uploading…</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Photos</>
          )}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={handleAdd} disabled={uploading} />
        </label>
      </div>
      {imgs.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-500 font-medium mb-1">No portfolio photos yet</p>
          <p className="text-xs text-gray-400">Upload up to 12 photos to showcase your work</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {imgs.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
              <img src={img} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemove(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >×</button>
            </div>
          ))}
        </div>
      )}
      {imgs.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">{imgs.length}/12 photos · Hover to remove</p>
      )}
    </div>
  );
}

// ── Onboarding Checklist ────────────────────────────────────────────────────────
function OnboardingChecklist({ profile, hasAvailability }: { profile: ProProfile | null; hasAvailability?: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("sniply_onboarding_dismissed");
      if (v === "1") setDismissed(true);
    } catch {}
  }, []);

  if (dismissed) return null;

  const checks = [
    { label: "Add a profile photo", done: !!profile?.profileImage },
    { label: "Write your bio", done: !!profile?.bio?.trim() },
    { label: "Add at least one service", done: (profile?.services?.length ?? 0) > 0 },
    { label: "Set your availability", done: !!hasAvailability },
    { label: "Add portfolio photos", done: (profile?.portfolioImages?.filter(Boolean).length ?? 0) > 0 },
  ];

  const doneCount = checks.filter(c => c.done).length;
  const allDone = doneCount === checks.length;

  if (allDone) return null;

  return (
    <div className="mb-6 bg-gradient-to-br from-[#2E4A8B]/5 to-[#4A6BC0]/5 border border-[#2E4A8B]/20 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Complete your profile</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {doneCount} of {checks.length} steps done — complete your profile to appear in browse results
          </p>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            try { localStorage.setItem("sniply_onboarding_dismissed", "1"); } catch {}
          }}
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(doneCount / checks.length) * 100}%`, background: "linear-gradient(135deg, #2E4A8B, #4A6BC0)" }}
        />
      </div>
      <div className="space-y-2">
        {checks.map(({ label, done }) => (
          <div key={label} className="flex items-center gap-2.5">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? "border-[#2E4A8B] bg-[#2E4A8B]" : "border-gray-300"}`}>
              {done && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-700"}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("profile");
  const [newBookingNotifs, setNewBookingNotifs] = useState<Booking[]>([]);
  const [notifsVisible, setNotifsVisible] = useState(true);

  // Appointments / calendar
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear]   = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [apptViewDate, setApptViewDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [availSaved, setAvailSaved] = useState(false);
  const [cloneConfirm, setCloneConfirm] = useState(false);
  const [clearWeekState, setClearWeekState] = useState<"idle" | "confirm" | "done">("idle");
  const [clearAllState, setClearAllState] = useState<"idle" | "confirm" | "done">("idle");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saved">("idle");
  const [customerAvatars, setCustomerAvatars] = useState<Record<string, string>>({});
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  // ── New scheduling state ───────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [schedData, setSchedData] = useState<Record<string, TimeBlock[]>>({});
  const [dragOp, setDragOp] = useState<DragOp>(null);
  const [activeBlock, setActiveBlock] = useState<{ dateKey: string; blockId: string } | null>(null);

  const colRefs        = useRef<Record<string, HTMLDivElement | null>>({});
  const dragOpRef      = useRef<DragOp>(null);
  const dragStartPos   = useRef<{ x: number; y: number } | null>(null);

  // Stable refs so effects with empty deps can read latest values
  const profileRef     = useRef<ProProfile | null>(null);
  const currentUserRef = useRef<User | null>(null);
  profileRef.current     = profile;
  currentUserRef.current = currentUser;

  // Group bookings by ISO date key
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of bookings) {
      const dateKey = toISODate(new Date(b.date));
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(b);
    }
    return map;
  }, [bookings]);

  // Appointments for the day-view panel
  const apptViewKey = toISODate(apptViewDate);
  const apptDayBookings = useMemo(
    () => (bookingsByDate[apptViewKey] ?? []).slice().sort((a, b) => parseTime(a.time) - parseTime(b.time)),
    [bookingsByDate, apptViewKey]
  );

  // Week dates (Mon–Sun for current weekStart)
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Business hours (open/close times displayed on customer availability bar)
  const [businessHours, setBusinessHours] = useState({ openTime: "9:00 AM", closeTime: "5:00 PM" });

  // Timeline bounds derived from business hours — drives the schedule grid range
  const tlBounds = useMemo<TLBounds>(() => {
    const startMins = parseTime(businessHours.openTime);
    const endMins   = parseTime(businessHours.closeTime);
    const start  = Math.max(0, Math.min(23, Math.floor(startMins / 60)));
    const end    = Math.max(start + 1, Math.min(24, endMins % 60 === 0 ? endMins / 60 : Math.ceil(endMins / 60)));
    const hours  = end - start;
    return { start, end, hours, totalPx: hours * HOUR_PX };
  }, [businessHours]);
  const tlBoundsRef = useRef<TLBounds>(tlBounds);
  tlBoundsRef.current = tlBounds;

  // Messages
  const [threads, setThreads] = useState<MessageThread[]>(INITIAL_THREADS);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reviews
  const [proReviews, setProReviews] = useState<StoredReview[]>([]);
  const [dashReviewReplies, setDashReviewReplies] = useState<Record<string, string>>({});
  const [dashReplyingTo, setDashReplyingTo] = useState<string | null>(null);
  const [dashReplyDraft, setDashReplyDraft] = useState("");

  // Services tab
  const [dashSvcs, setDashSvcs] = useState<DashService[]>([{ name: "", description: "", price: "", duration: "", images: [] }]);
  const [svcsSaved, setSvcsSaved] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const role = localStorage.getItem("sniply_role");
    if (role !== "pro") { router.replace("/signup/professional"); return; }
    const user = getCurrentUser();
    setCurrentUser(user);

    const profileId = user?.profileId;
    if (!profileId) { setLoading(false); return; }

    // Load pro profile from API
    apiGetBarber(profileId).then(barber => {
      const prof = barber as ProProfile;
      setProfile(prof);
      if (prof.services && prof.services.length > 0) {
        setDashSvcs(prof.services.map(s => ({
          name: s.name,
          description: s.description ?? "",
          price: String(s.price),
          duration: String(s.duration),
          images: (s as { images?: string[] }).images ?? [],
        })));
      }

      // Load bookings from API
      apiGetBookings({ barberId: profileId }).then((bks) => {
        setBookings(bks);
        // Check for new bookings since last dashboard visit
        const visitKey = `sniply_last_dashboard_visit_${profileId}`;
        const lastVisit = localStorage.getItem(visitKey);
        if (lastVisit) {
          const lastVisitDate = new Date(lastVisit);
          const newBks = bks.filter((b) => b.createdAt && new Date(b.createdAt) > lastVisitDate);
          if (newBks.length > 0) setNewBookingNotifs(newBks);
        }
        localStorage.setItem(visitKey, new Date().toISOString());
      }).catch(() => {});

      // Load reviews from API
      apiGetReviews(profileId).then((reviews) => {
        setProReviews(reviews.map((r) => ({ userId: r.userId, name: r.userName, rating: r.rating, text: r.text, date: r.date })));
        const repliesMap: Record<string, string> = {};
        reviews.forEach((r, i) => {
          if (r.reply) repliesMap[`${r.userId}_${r.date}`] = r.reply;
          else {
            // fallback key by index for legacy data
            const legacyKey = `review-${i}`;
            if (r.reply) repliesMap[legacyKey] = r.reply;
          }
        });
        setDashReviewReplies(repliesMap);
      }).catch(() => {});

      // Availability + business hours from API
      apiGetAvailability(profileId).then((slots) => {
        if (Object.keys(slots).length > 0) setSchedData(migrateToDateKeyed(slots as Record<string, import("@/lib/types").TimeBlock[]>));
      }).catch(() => {});
      apiGetBusinessHours(profileId).then((bh) => {
        if (bh) setBusinessHours(bh);
      }).catch(() => {});
      apiGetThreads(profileId).then((t) => setThreads(t)).catch(() => {});

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  // Reset colRefs when week changes
  useEffect(() => {
    colRefs.current = {};
    setActiveBlock(null);
    dragOpRef.current = null;
    setDragOp(null);
  }, [weekStart]);

  // Persist threads to API whenever they change (debounced 800ms)
  useEffect(() => {
    const pid = profile?.id;
    if (!pid || threads.length === 0) return;
    const t = setTimeout(() => void apiUpdateThreads(pid, threads), 800);
    return () => clearTimeout(t);
  }, [threads, profile?.id]);

  // ── Auto-save availability whenever schedData changes (800ms debounce) ──────
  useEffect(() => {
    setAutoSaveStatus("pending");
    const t = setTimeout(() => {
      const prof = profileRef.current;
      const user = currentUserRef.current;
      const pid = prof?.id ?? user?.profileId;
      if (!pid) return;
      void apiUpdateAvailability(pid, schedData).then(() => {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      }).catch(() => setAutoSaveStatus("idle"));
    }, 800);
    return () => clearTimeout(t);
  }, [schedData]);

  // ── Auto-save business hours whenever they change ──────────────────────────
  useEffect(() => {
    const pid = profileRef.current?.id;
    if (!pid) return;
    void apiUpdateBusinessHours(pid, businessHours);
  }, [businessHours]);


  // ── Auto-refresh bookings from API (polls every 5s) ──────────────────────
  useEffect(() => {
    const refresh = () => {
      const pid = profileRef.current?.id ?? currentUserRef.current?.profileId;
      if (!pid) return;
      apiGetBookings({ barberId: pid }).then((bks) => setBookings(bks)).catch(() => {});
    };
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []); // uses refs — stable

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedThread?.id, selectedThread?.messages.length]);

  // ── Global mouse handlers (registered once, use refs) ─────────────────────
  useEffect(() => {
    const getColY = (dateKey: string, clientY: number): number => {
      const el = colRefs.current[dateKey];
      if (!el) return 0;
      return clientY - el.getBoundingClientRect().top;
    };
    const getDayKeyFromX = (clientX: number): string | null => {
      for (const [dateKey, el] of Object.entries(colRefs.current)) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) return dateKey;
      }
      return null;
    };

    const move = (ev: MouseEvent) => {
      const prev = dragOpRef.current;
      if (!prev) return;

      let updated: NonNullable<DragOp>;

      const tb = tlBoundsRef.current;
      if (prev.type === "create" || prev.type === "resize-bottom") {
        const rawE = pxToMins(getColY(prev.curDateKey, ev.clientY), tb);
        const eMins = Math.max(rawE, prev.s + SNAP);
        updated = { ...prev, e: eMins };
      } else if (prev.type === "resize-top") {
        const rawS = pxToMins(getColY(prev.curDateKey, ev.clientY), tb);
        const sMins = Math.max(tb.start * 60, Math.min(rawS, prev.e - SNAP));
        updated = { ...prev, s: sMins };
      } else {
        // move
        const newDateKey = getDayKeyFromX(ev.clientX) ?? prev.curDateKey;
        const rawY = tb.start * 60 + (Math.max(0, getColY(newDateKey, ev.clientY)) / tb.totalPx) * tb.hours * 60;
        const rawS = rawY - prev.offsetMins;
        const snappedS = Math.round(rawS / SNAP) * SNAP;
        const duration = prev.e - prev.s;
        const clampedS = Math.max(tb.start * 60, Math.min(tb.end * 60 - duration, snappedS));
        updated = { ...prev, curDateKey: newDateKey, s: clampedS, e: clampedS + duration };
      }

      dragOpRef.current = updated;
      setDragOp(updated);
    };

    const up = (ev: MouseEvent) => {
      const prev = dragOpRef.current;
      if (!prev) return;

      const startPos = dragStartPos.current;
      dragOpRef.current = null;
      dragStartPos.current = null;
      setDragOp(null);

      if (prev.type === "create") {
        if (prev.e - prev.s >= SNAP) {
          setSchedData(d => {
            // Prevent overlap
            if (wouldOverlap(prev.curDateKey, prev.s, prev.e, d)) return d;
            const newBlock: TimeBlock = {
              id: `${prev.curDateKey}-${Date.now()}`,
              start: minsToStr(prev.s),
              end: minsToStr(prev.e),
            };
            return { ...d, [prev.curDateKey]: [...(d[prev.curDateKey] ?? []), newBlock] };
          });
        }
      } else if (prev.type === "move") {
        const dx = startPos ? Math.abs(ev.clientX - startPos.x) : 99;
        const dy = startPos ? Math.abs(ev.clientY - startPos.y) : 99;
        if (dx < 3 && dy < 3) {
          // It was a click — open popover
          setActiveBlock({ dateKey: prev.srcDateKey, blockId: prev.blockId! });
        } else {
          setSchedData(d => {
            // Prevent overlap at destination
            if (wouldOverlap(prev.curDateKey, prev.s, prev.e, d, prev.blockId!)) return d;
            const newData = { ...d };
            const srcBlocks = (newData[prev.srcDateKey] ?? []).filter(b => b.id !== prev.blockId);
            const updBlock: TimeBlock = { id: prev.blockId!, start: minsToStr(prev.s), end: minsToStr(prev.e) };
            if (prev.srcDateKey === prev.curDateKey) {
              newData[prev.srcDateKey] = [...srcBlocks, updBlock];
            } else {
              newData[prev.srcDateKey] = srcBlocks;
              newData[prev.curDateKey] = [...(newData[prev.curDateKey] ?? []), updBlock];
            }
            return newData;
          });
        }
      } else {
        // resize-top or resize-bottom — prevent overlap
        setSchedData(d => {
          if (wouldOverlap(prev.srcDateKey, prev.s, prev.e, d, prev.blockId!)) return d;
          return {
            ...d,
            [prev.srcDateKey]: (d[prev.srcDateKey] ?? []).map(b =>
              b.id === prev.blockId ? { ...b, start: minsToStr(prev.s), end: minsToStr(prev.e) } : b
            ),
          };
        });
      }
    };

    // Touch event wrappers — map touch coordinates to the same move/up logic
    const touchMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      ev.preventDefault();
      move({ clientX: t.clientX, clientY: t.clientY } as MouseEvent);
    };
    const touchUp = (ev: TouchEvent) => {
      const t = ev.changedTouches[0];
      if (!t) return;
      up({ clientX: t.clientX, clientY: t.clientY } as MouseEvent);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchUp);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchUp);
    };
  }, []); // Empty deps — all state accessed via refs

  const firstName = profile?.name?.split(" ")[0] ?? currentUser?.name?.split(" ")[0] ?? "there";

  // ── Messages ───────────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!replyText.trim() || !selectedThread) return;
    const msg = { from: "pro" as const, text: replyText.trim(), time: "Just now" };
    const updated = { ...selectedThread, messages: [...selectedThread.messages, msg], preview: replyText.trim(), timestamp: "Just now" };
    setThreads(prev => prev.map(t => t.id === selectedThread.id ? updated : t));
    setSelectedThread(updated);
    setReplyText("");
  };

  // ── Services helpers ───────────────────────────────────────────────────────
  const saveDashServices = async () => {
    if (!profile?.id) return;
    const validSvcs = dashSvcs
      .filter(s => s.name.trim() && s.price.trim())
      .map(s => ({
        name: s.name.trim(),
        description: s.description.trim(),
        price: parseFloat(s.price) || 0,
        duration: parseInt(s.duration) || 30,
        images: s.images,
      }));
    const startingPrice = validSvcs.length > 0 ? Math.min(...validSvcs.map(s => s.price)) : profile.startingPrice ?? 0;
    try {
      const updated = await apiUpdateBarber(profile.id, { services: validSvcs, startingPrice });
      setProfile(prev => prev ? { ...prev, ...updated } : prev);
      setSvcsSaved(true);
      setTimeout(() => setSvcsSaved(false), 2500);
    } catch {}
  };

  // ── Schedule helpers ───────────────────────────────────────────────────────
  const saveSchedule = () => {
    const profileId = profile?.id ?? currentUser?.profileId;
    if (profileId) void apiUpdateAvailability(profileId, schedData);
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 2500);
  };

  const removeBlock = useCallback((dateKey: string, id: string) => {
    setSchedData(prev => ({ ...prev, [dateKey]: (prev[dateKey] ?? []).filter(b => b.id !== id) }));
    setActiveBlock(null);
  }, []);

  const updateBlockTime = (dateKey: string, blockId: string, field: "start" | "end", val: string) => {
    setSchedData(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] ?? []).map(b => b.id === blockId ? { ...b, [field]: val } : b),
    }));
  };

  const clearDay = (dateKey: string) => {
    setSchedData(prev => ({ ...prev, [dateKey]: [] }));
    setActiveBlock(null);
  };

  // Clone current week's schedule to all other weeks (±12 weeks from today)
  const cloneWeekToAll = useCallback(() => {
    setSchedData(prev => {
      const newData = { ...prev };
      // Build pattern: day-of-week-offset → blocks
      const weekPattern: Record<number, TimeBlock[]> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const key = toISODate(d);
        const blocks = prev[key] ?? [];
        if (blocks.length > 0) weekPattern[i] = blocks;
      }
      if (Object.keys(weekPattern).length === 0) return prev;

      const refMonday = getMondayOf(new Date());
      for (let wo = -4; wo <= 12; wo++) {
        const targetMonday = new Date(refMonday);
        targetMonday.setDate(refMonday.getDate() + wo * 7);
        // Don't overwrite the source week
        if (toISODate(targetMonday) === toISODate(weekStart)) continue;

        for (const [dayOffsetStr, blocks] of Object.entries(weekPattern)) {
          const dayOffset = parseInt(dayOffsetStr);
          const targetDay = new Date(targetMonday);
          targetDay.setDate(targetMonday.getDate() + dayOffset);
          const key = toISODate(targetDay);
          newData[key] = blocks.map((b, i) => ({ ...b, id: `${key}-cloned-${i}` }));
        }
      }
      return newData;
    });
    setCloneConfirm(true);
    setTimeout(() => setCloneConfirm(false), 3000);
  }, [weekStart]);

  const clearWeek = useCallback(() => {
    setSchedData(prev => {
      const newData = { ...prev };
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        newData[toISODate(d)] = [];
      }
      return newData;
    });
    setActiveBlock(null);
    setClearWeekState("done");
    setTimeout(() => setClearWeekState("idle"), 2000);
  }, [weekStart]);

  const clearAllWeeks = useCallback(() => {
    setSchedData({});
    setActiveBlock(null);
    setClearAllState("done");
    setTimeout(() => setClearAllState("idle"), 2000);
  }, []);

  // ── Drag start handlers ────────────────────────────────────────────────────
  const handleColDown = useCallback((dateKey: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    e.preventDefault();
    setActiveBlock(null);
    const colEl = colRefs.current[dateKey];
    const py = colEl ? e.clientY - colEl.getBoundingClientRect().top : 0;
    const sMins = pxToMins(py, tlBoundsRef.current);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const op: NonNullable<DragOp> = { type: "create", blockId: null, srcDateKey: dateKey, curDateKey: dateKey, s: sMins, e: sMins + SNAP, offsetMins: 0 };
    dragOpRef.current = op;
    setDragOp(op);
  }, []);

  const handleMoveDown = useCallback((dateKey: string, blockId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const block = (schedData[dateKey] ?? []).find(b => b.id === blockId);
    if (!block) return;
    setActiveBlock(null);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const colEl = colRefs.current[dateKey];
    const py = colEl ? e.clientY - colEl.getBoundingClientRect().top : 0;
    const blockStartMins = parseTime(block.start);
    const { start: tlS, hours: tlH, totalPx: tlTP } = tlBoundsRef.current;
    const grabMins = tlS * 60 + (Math.max(0, py) / tlTP) * tlH * 60;
    const offsetMins = grabMins - blockStartMins;
    const op: NonNullable<DragOp> = { type: "move", blockId, srcDateKey: dateKey, curDateKey: dateKey, s: blockStartMins, e: parseTime(block.end), offsetMins };
    dragOpRef.current = op;
    setDragOp(op);
  }, [schedData]);

  const handleResizeTopDown = useCallback((dateKey: string, blockId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const block = (schedData[dateKey] ?? []).find(b => b.id === blockId);
    if (!block) return;
    setActiveBlock(null);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const op: NonNullable<DragOp> = { type: "resize-top", blockId, srcDateKey: dateKey, curDateKey: dateKey, s: parseTime(block.start), e: parseTime(block.end), offsetMins: 0 };
    dragOpRef.current = op;
    setDragOp(op);
  }, [schedData]);

  const handleResizeBottomDown = useCallback((dateKey: string, blockId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const block = (schedData[dateKey] ?? []).find(b => b.id === blockId);
    if (!block) return;
    setActiveBlock(null);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const op: NonNullable<DragOp> = { type: "resize-bottom", blockId, srcDateKey: dateKey, curDateKey: dateKey, s: parseTime(block.start), e: parseTime(block.end), offsetMins: 0 };
    dragOpRef.current = op;
    setDragOp(op);
  }, [schedData]);

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow    = new Date(calYear, calMonth, 1).getDay();
  const today       = new Date();
  const bookingDates = new Set<number>(
    bookings.filter(b => { const d = new Date(b.date); return d.getMonth() === calMonth && d.getFullYear() === calYear; })
            .map(b => new Date(b.date).getDate())
  );
  const dayBookings = selectedDay
    ? bookings.filter(b => { const d = new Date(b.date); return d.getMonth() === calMonth && d.getFullYear() === calYear && d.getDate() === selectedDay; })
    : [];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#2E4A8B]/20 border-t-[#2E4A8B] rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading dashboard...</p>
      </div>
    </div>
  );

  const TABS: { key: TabKey; label: string; shortLabel: string }[] = [
    { key: "profile",      label: "My Profile",   shortLabel: "Profile"   },
    { key: "services",     label: "Services",     shortLabel: "Services"  },
    { key: "appointments", label: "Appointments", shortLabel: "Appts"     },
    { key: "messages",     label: "Messages",     shortLabel: "Messages"  },
    { key: "analytics",    label: "Analytics",    shortLabel: "Analytics" },
  ];

  const todayKey = toISODate(new Date());

  return (
    <div className="min-h-screen bg-[#d6e4f7] dark:bg-black" onClick={() => { setActiveBlock(null); setActiveBookingId(null); }}>
      <Navbar />
      <div className="max-w-[1200px] mx-auto flex min-h-[calc(100vh-72px)]">

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-[240px] shrink-0 border-r border-[#2E4A8B]/12 bg-[#e4edf8] dark:bg-[#111111] pt-8 pb-4 px-4">
          <nav className="space-y-1 flex-1">
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === key ? "bg-[#2E4A8B] text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
              >{label}</button>
            ))}
          </nav>
          <div className="pt-4 border-t border-gray-100">
            <Link href="/settings" className="flex items-center gap-2 text-sm text-gray-500 font-medium hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Account Settings
            </Link>
          </div>
        </aside>

        {/* Mobile tabs */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#e4edf8] dark:bg-[#111111] border-t border-[#2E4A8B]/12">
          <div className="flex">
            {TABS.map(({ key, label, shortLabel }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 py-3 text-xs font-semibold whitespace-nowrap border-t-2 transition-all ${tab === key ? "border-[#2E4A8B] text-[#2E4A8B]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 px-6 py-8 pb-24 lg:pb-8 min-w-0">

          {/* New booking notification banner */}
          {notifsVisible && newBookingNotifs.length > 0 && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800">
                  {newBookingNotifs.length === 1
                    ? `New booking from ${newBookingNotifs[0].userName ?? "a customer"}!`
                    : `${newBookingNotifs.length} new bookings since your last visit!`}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5 truncate">
                  {newBookingNotifs.map((b) => `${b.userName ?? "Customer"} — ${b.service} on ${new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`).join(" · ")}
                </p>
                <button
                  onClick={() => setTab("appointments")}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 mt-1.5 underline"
                >
                  View Appointments →
                </button>
              </div>
              <button
                onClick={() => setNotifsVisible(false)}
                className="text-emerald-400 hover:text-emerald-600 shrink-0 p-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ══ MY PROFILE ════════════════════════════════════════════════════ */}
          {tab === "profile" && (
            <div className="max-w-[660px]">
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-heading font-bold text-gray-900 text-2xl">My Profile</h1>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link href="/signup/professional" className="btn-primary text-sm" style={{ height: 40, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>Edit Profile</Link>
                  {profile && <Link href={`/barber/${profile.id}`} className="btn-secondary text-sm" style={{ height: 40, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>View Public Profile</Link>}
                </div>
              </div>
              <OnboardingChecklist profile={profile} hasAvailability={Object.keys(schedData).length > 0} />
              {profile ? (
                <div className="space-y-5">
                  <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
                    <div className="flex items-start gap-4 mb-4">
                      {profile.profileImage
                        ? <img src={profile.profileImage} alt={profile.name} className="w-20 h-20 rounded-full object-cover shrink-0" />
                        : <div className="w-20 h-20 rounded-full bg-[#2E4A8B] text-white text-2xl font-bold flex items-center justify-center shrink-0">{profile.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</div>
                      }
                      <div>
                        <h2 className="font-heading font-bold text-gray-900 text-xl">{profile.name}</h2>
                        {profile.gender && <p className="text-sm text-gray-500 mt-0.5">{profile.gender}</p>}
                        {(profile.fullAddress || profile.location) && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                            {profile.fullAddress || profile.location}
                          </p>
                        )}
                        {profile.shopName && <p className="text-sm text-gray-500 mt-0.5">Shop: {profile.shopName}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {profile.type && <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${profile.type === "independent" ? "bg-[#2E4A8B] text-white" : "bg-gray-100 text-gray-700"}`}>{profile.type === "independent" ? "Independent Barber / Stylist" : "Shop-Based"}</span>}
                          {profile.experience && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{profile.experience}</span>}
                        </div>
                      </div>
                    </div>
                    {profile.bio && <div className="border-t border-gray-100 pt-4"><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Bio</p><p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p></div>}
                  </div>
                  {profile.services && profile.services.length > 0 && (
                    <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">Services</h3>
                      <div className="space-y-3">
                        {profile.services.map((svc, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0 border-gray-100">
                            <div><p className="text-sm font-medium text-gray-800">{svc.name}</p>{svc.description && <p className="text-xs text-gray-400">{svc.description}</p>}</div>
                            <div className="text-right shrink-0 ml-4"><p className="text-sm font-bold text-[#2E4A8B]">${svc.price}</p>{svc.duration > 0 && <p className="text-xs text-gray-400">{svc.duration} min</p>}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6 space-y-5">
                    {profile.specialties && profile.specialties.length > 0 && <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Specialties</p><div className="flex flex-wrap gap-2">{profile.specialties.map(s => <span key={s} className="text-xs bg-[#2E4A8B]/10 text-[#2E4A8B] font-medium px-3 py-1 rounded-full">{s}</span>)}</div></div>}
                    {profile.hairTypes && profile.hairTypes.length > 0 && <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Hair Types</p><p className="text-sm text-gray-700">{profile.hairTypes.join(", ")}</p></div>}
                    {profile.languages && profile.languages.length > 0 && <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Languages</p><p className="text-sm text-gray-700">{profile.languages.join(", ")}</p></div>}
                  </div>
                  {profile.credentials && profile.credentials.some(c => c.text) && (
                    <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">Credentials</h3>
                      <div className="space-y-2">
                        {profile.credentials.filter(c => c.text).map((c, i) => (
                          <div key={i} className="flex items-center gap-3 py-2 border-b last:border-b-0 border-gray-100">
                            <div className="w-8 h-8 rounded-lg bg-[#2E4A8B]/10 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4 text-[#2E4A8B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800">{c.text}</p>{c.fileName && <p className="text-xs text-gray-400">{c.fileName}</p>}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Portfolio management */}
                  <PortfolioManager profile={profile} onUpdate={(imgs) => {
                    const updated = { ...profile, portfolioImages: imgs };
                    setProfile(updated);
                    if (profile.id) {
                      void apiUpdateBarber(profile.id, { portfolioImages: imgs });
                    }
                  }} />


                  {/* Business Hours */}
                  <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 mb-1">Business Hours</h3>
                    <p className="text-xs text-gray-400 mb-4">Sets the visible range on your availability calendar for customers.</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Opens</label>
                        <input
                          type="time"
                          value={toInputTime(businessHours.openTime)}
                          onChange={(e) => setBusinessHours(h => ({ ...h, openTime: fromInputTime(e.target.value) }))}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#2E4A8B]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Closes</label>
                        <input
                          type="time"
                          value={toInputTime(businessHours.closeTime)}
                          onChange={(e) => setBusinessHours(h => ({ ...h, closeTime: fromInputTime(e.target.value) }))}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#2E4A8B]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reviews */}
                  <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Reviews</h3>
                      {proReviews.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Stars
                            rating={Math.round((proReviews.reduce((s, r) => s + r.rating, 0) / proReviews.length) * 10) / 10}
                            size="sm"
                          />
                          <span className="text-sm text-gray-500">
                            {(Math.round((proReviews.reduce((s, r) => s + r.rating, 0) / proReviews.length) * 10) / 10).toFixed(1)}
                            <span className="text-gray-400 ml-1">({proReviews.length})</span>
                          </span>
                        </div>
                      )}
                    </div>
                    {proReviews.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <div className="w-12 h-12 rounded-xl bg-[#2E4A8B]/8 flex items-center justify-center text-[#2E4A8B] mb-3">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-700 mb-1">No reviews yet</p>
                        <p className="text-xs text-gray-400">Reviews from customers will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {proReviews.map((review, i) => {
                          const replyKey = `${review.userId}_${review.date}`;
                          const existingReply = dashReviewReplies[replyKey];
                          const isReplying = dashReplyingTo === replyKey;
                          return (
                            <div key={i} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                              <div className="flex items-start justify-between gap-3 mb-1.5">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{review.name}</p>
                                  <Stars rating={review.rating} size="sm" />
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">{review.date}</span>
                              </div>
                              {review.text && (
                                <p className="text-sm text-gray-600 leading-relaxed mt-1">{review.text}</p>
                              )}
                              {/* Existing reply */}
                              {existingReply && !isReplying && (
                                <div className="mt-2.5 pl-3 border-l-2 border-[#2E4A8B]/20 bg-[#2E4A8B]/4 rounded-r-lg px-3 py-2">
                                  <p className="text-[11px] font-bold text-[#2E4A8B] mb-0.5">Your response</p>
                                  <p className="text-xs text-gray-600 leading-relaxed">{existingReply}</p>
                                </div>
                              )}
                              {/* Reply input */}
                              {isReplying ? (
                                <div className="mt-2.5 space-y-2">
                                  <textarea
                                    autoFocus
                                    value={dashReplyDraft}
                                    onChange={(e) => setDashReplyDraft(e.target.value)}
                                    placeholder="Write a response to this review…"
                                    rows={3}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2E4A8B] focus:ring-1 focus:ring-[#2E4A8B]/30 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        if (!dashReplyDraft.trim()) return;
                                        const profileId = profile?.id ?? currentUser?.profileId;
                                        const replyText = dashReplyDraft.trim();
                                        const updated = { ...dashReviewReplies, [replyKey]: replyText };
                                        setDashReviewReplies(updated);
                                        if (profileId) {
                                          void apiReplyToReview(profileId, i, replyText);
                                        }
                                        setDashReplyingTo(null);
                                        setDashReplyDraft("");
                                      }}
                                      className="btn-primary text-xs"
                                      style={{ height: 32, padding: "0 14px", fontSize: 13 }}
                                    >
                                      Post Response
                                    </button>
                                    <button
                                      onClick={() => { setDashReplyingTo(null); setDashReplyDraft(""); }}
                                      className="text-xs text-gray-400 hover:text-gray-600 px-2"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setDashReplyingTo(replyKey); setDashReplyDraft(existingReply ?? ""); }}
                                  className="mt-1.5 text-xs font-semibold text-[#2E4A8B] hover:underline"
                                >
                                  {existingReply ? "Edit response" : "Reply"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-10 text-center">
                  <p className="text-gray-500 mb-4">No profile saved yet.</p>
                  <Link href="/signup/professional" className="btn-primary">Complete Your Profile</Link>
                </div>
              )}
            </div>
          )}

          {/* ══ SERVICES ══════════════════════════════════════════════════════ */}
          {tab === "services" && (
            <div className="max-w-[660px]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="font-heading font-bold text-gray-900 text-2xl">Services</h1>
                  <p className="text-sm text-gray-500 mt-1">Manage the services you offer with pricing, duration, and example photos</p>
                </div>
                <button
                  onClick={() => void saveDashServices()}
                  className={`btn-primary text-sm ${svcsSaved ? "opacity-80" : ""}`}
                  style={{ height: 40, padding: "0 20px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {svcsSaved ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </>
                  ) : "Save Services"}
                </button>
              </div>

              <div className="space-y-4">
                {dashSvcs.map((svc, idx) => (
                  <div key={idx} className="bg-white border border-[#2E4A8B]/12 rounded-xl p-5 relative">
                    {dashSvcs.length > 1 && (
                      <button
                        onClick={() => setDashSvcs(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-500 text-sm transition-colors"
                        title="Remove service"
                      >×</button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Service Name <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g., Fade & Lineup"
                          value={svc.name}
                          onChange={e => setDashSvcs(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2E4A8B] focus:ring-1 focus:ring-[#2E4A8B]/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
                        <input
                          type="text"
                          placeholder="Brief description (optional)"
                          value={svc.description}
                          onChange={e => setDashSvcs(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2E4A8B] focus:ring-1 focus:ring-[#2E4A8B]/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Price ($) <span className="text-red-400">*</span></label>
                        <input
                          type="number"
                          min="0"
                          placeholder="45"
                          value={svc.price}
                          onChange={e => setDashSvcs(prev => prev.map((s, i) => i === idx ? { ...s, price: e.target.value } : s))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2E4A8B] focus:ring-1 focus:ring-[#2E4A8B]/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Duration (min)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="30"
                          value={svc.duration}
                          onChange={e => setDashSvcs(prev => prev.map((s, i) => i === idx ? { ...s, duration: e.target.value } : s))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2E4A8B] focus:ring-1 focus:ring-[#2E4A8B]/30"
                        />
                      </div>
                    </div>

                    {/* Example photos */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Example Photos <span className="text-gray-400 font-normal">(up to 4, optional)</span></p>
                      <div className="flex gap-2 flex-wrap">
                        {svc.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="relative w-20 h-20 rounded-lg overflow-hidden group shrink-0">
                            <img src={img} alt={`${svc.name} example`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => setDashSvcs(prev => prev.map((s, i) => i === idx ? { ...s, images: s.images.filter((_, ii) => ii !== imgIdx) } : s))}
                              className="absolute inset-0 bg-black/50 text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              title="Remove photo"
                            >×</button>
                          </div>
                        ))}
                        {svc.images.length < 4 && (
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#2E4A8B] hover:bg-blue-50/30 transition-colors shrink-0 group">
                            <svg className="w-5 h-5 text-gray-300 group-hover:text-[#2E4A8B]/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-[10px] text-gray-400 mt-1">Add photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const compressed = await compressImage(file, 600, 0.80);
                                  setDashSvcs(prev => prev.map((s, i) => i === idx ? { ...s, images: [...s.images, compressed] } : s));
                                } catch {}
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setDashSvcs(prev => [...prev, { name: "", description: "", price: "", duration: "", images: [] }])}
                className="mt-4 flex items-center gap-2 text-sm text-[#2E4A8B] font-medium hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Service
              </button>

            </div>
          )}

          {/* ══ APPOINTMENTS ═══════════════════════════════════════════════════ */}
          {tab === "appointments" && (
            <div>
              <h1 className="font-heading font-bold text-gray-900 text-2xl mb-6">Appointments</h1>

              {/* ── Day-view panel ───────────────────────────────────────────── */}
              {(() => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
                const isToday    = apptViewDate.getTime() === today.getTime();
                const isTomorrow = apptViewDate.getTime() === tomorrow.getTime();
                const dayLabel = isToday
                  ? "Today"
                  : isTomorrow
                  ? "Tomorrow"
                  : apptViewDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const fullLabel = apptViewDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

                return (
                  <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-5 mb-6">
                    {/* Day selector */}
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h2 className="font-semibold text-gray-900">
                          {dayLabel}
                          {!isToday && <span className="text-sm font-normal text-gray-400 ml-2">· {apptViewDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">{fullLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isToday && (
                          <button
                            onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setApptViewDate(d); }}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#2E4A8B]/30 text-[#2E4A8B] hover:bg-[#2E4A8B]/5 transition-colors"
                          >
                            Today
                          </button>
                        )}
                        <button
                          onClick={() => setApptViewDate(d => { const n = new Date(d); n.setDate(d.getDate() - 1); return n; })}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          onClick={() => setApptViewDate(d => { const n = new Date(d); n.setDate(d.getDate() + 1); return n; })}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>

                    {apptDayBookings.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500 font-medium">No appointments {isToday ? "today" : "this day"}</p>
                        <p className="text-xs text-gray-400 mt-1">Availability blocks on this day are shown in the schedule below</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {apptDayBookings.map(b => {
                          const dur = getBookingDuration(b, profile);
                          const avatar = customerAvatars[b.userId];
                          const initials = (b.userName ?? "").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                          // Load customer reference photos + notes
                          let refPhotos: string[] = [];
                          let refNotes = "";
                          try {
                            const allUsers: { id: string; username: string }[] = JSON.parse(localStorage.getItem("sniply_users") ?? "[]");
                            const customerUser = allUsers.find(u => u.id === b.userId);
                            if (customerUser) {
                              const cpRaw = localStorage.getItem("sniply_customer_profile");
                              if (cpRaw) {
                                const cp = JSON.parse(cpRaw);
                                if (cp.userId === b.userId || cp.id === b.userId) {
                                  refPhotos = cp.referencePhotos ?? [];
                                  refNotes = cp.referenceNotes ?? "";
                                }
                              }
                            }
                          } catch {}
                          const bookingNotes = (b as Booking & { notes?: string }).notes;
                          return (
                            <div key={b.id} className="bg-[#e4edf8] dark:bg-[#1e1e1e] rounded-xl border border-[#2E4A8B]/10 overflow-hidden">
                              <div className="flex items-center gap-3 px-4 py-3">
                                {avatar
                                  ? <img src={avatar} alt={b.userName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                                  : <div className="w-9 h-9 rounded-full bg-[#2E4A8B]/10 text-[#2E4A8B] font-bold text-xs flex items-center justify-center shrink-0">{initials}</div>
                                }
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{b.userName}</p>
                                  <p className="text-xs text-gray-500 truncate">{b.service}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold text-gray-800">{b.time}</p>
                                  <p className="text-xs text-gray-400">{dur} min</p>
                                </div>
                              </div>
                              {/* Booking notes */}
                              {bookingNotes && (
                                <div className="px-4 pb-3 text-xs text-gray-600 bg-amber-50 border-t border-amber-100 pt-2">
                                  <span className="font-semibold text-amber-700">Client note: </span>{bookingNotes}
                                </div>
                              )}
                              {/* Reference photos */}
                              {refPhotos.length > 0 && (
                                <div className="px-4 pb-3 border-t border-gray-200 pt-2">
                                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Reference photos</p>
                                  <div className="flex gap-1.5 overflow-x-auto">
                                    {refPhotos.map((photo, pi) => (
                                      <div key={pi} className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                                        <img src={photo} alt={`Ref ${pi + 1}`} className="w-full h-full object-cover" />
                                      </div>
                                    ))}
                                  </div>
                                  {refNotes && <p className="text-xs text-gray-500 mt-1.5 italic">&ldquo;{refNotes}&rdquo;</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <p className="text-xs text-gray-400 text-right pt-1">
                          {apptDayBookings.length} appointment{apptDayBookings.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Multi-Week Interactive Schedule ─────────────────────────── */}
              <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-5 mb-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">Availability Schedule</h2>
                      <div className="relative group/schedhelp">
                        <button
                          type="button"
                          className="w-5 h-5 rounded-full border border-gray-300 text-gray-400 hover:border-[#2E4A8B] hover:text-[#2E4A8B] transition-colors flex items-center justify-center text-[11px] font-bold leading-none"
                          aria-label="Scheduling help"
                        >
                          ?
                        </button>
                        <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-xl px-4 py-3 opacity-0 group-hover/schedhelp:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl leading-relaxed">
                          <p className="font-semibold mb-2 text-white/90">How to use the schedule</p>
                          <ul className="space-y-1.5 text-white/75">
                            <li><span className="text-white font-medium">Drag empty area</span> — create a new block</li>
                            <li><span className="text-white font-medium">Drag top/bottom edge</span> — resize a block</li>
                            <li><span className="text-white font-medium">Drag middle</span> — move a block</li>
                            <li><span className="text-white font-medium">Click block</span> — edit time manually</li>
                            <li><span className="text-white font-medium">× button</span> — delete a block</li>
                          </ul>
                          <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Drag to create · Edges to resize · Middle to move
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Clear week button */}
                    {clearWeekState === "confirm" ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50">
                        <span className="text-xs font-medium text-red-600">Clear entire week?</span>
                        <button
                          onClick={clearWeek}
                          className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors"
                        >
                          Yes, clear
                        </button>
                        <button
                          onClick={() => setClearWeekState("idle")}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : clearWeekState === "done" ? (
                      <span className="text-xs font-medium text-green-600 px-3 py-2 rounded-lg border border-green-200 bg-green-50">Cleared ✓</span>
                    ) : (
                      <button
                        onClick={() => setClearWeekState("confirm")}
                        className="text-sm font-medium px-3 py-2 rounded-lg transition-all border bg-gray-50 text-red-500 border-red-100 hover:bg-red-50 hover:border-red-200"
                        title="Remove all availability blocks for this week"
                      >
                        Clear week
                      </button>
                    )}
                    {/* Clear all weeks button */}
                    {clearAllState === "confirm" ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50">
                        <span className="text-xs font-medium text-red-600">Clear ALL weeks?</span>
                        <button
                          onClick={clearAllWeeks}
                          className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors"
                        >
                          Yes, clear all
                        </button>
                        <button
                          onClick={() => setClearAllState("idle")}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : clearAllState === "done" ? (
                      <span className="text-xs font-medium text-green-600 px-3 py-2 rounded-lg border border-green-200 bg-green-50">All cleared ✓</span>
                    ) : (
                      <button
                        onClick={() => setClearAllState("confirm")}
                        className="text-sm font-medium px-3 py-2 rounded-lg transition-all border bg-gray-50 text-red-500 border-red-100 hover:bg-red-50 hover:border-red-200"
                        title="Remove all availability blocks across every week"
                      >
                        Clear all weeks
                      </button>
                    )}
                    {/* Clone week button */}
                    <button
                      onClick={cloneWeekToAll}
                      className={`text-sm font-medium px-3 py-2 rounded-lg transition-all border ${cloneConfirm ? "bg-green-50 text-green-600 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
                      title="Copy this week's schedule to all other weeks"
                    >
                      {cloneConfirm ? "Cloned ✓" : "Clone week →all"}
                    </button>
                    {autoSaveStatus === "pending" && (
                      <span className="text-[11px] text-gray-400 hidden sm:block">Saving…</span>
                    )}
                    {autoSaveStatus === "saved" && (
                      <span className="text-[11px] text-green-500 hidden sm:block font-medium">✓ Saved</span>
                    )}
                  </div>
                </div>

                {/* Week navigation */}
                <div className="flex items-center gap-3 mb-4 ml-10">
                  <button
                    onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="flex-1 text-center text-sm font-semibold text-gray-700">{fmtWeekRange(weekStart)}</span>
                  <button
                    onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Column headers */}
                <div className="flex ml-10 mb-1" style={{ userSelect: "none" }}>
                  {weekDates.map((date, i) => {
                    const dateKey = toISODate(date);
                    const isToday = dateKey === todayKey;
                    const hasBlocks = (schedData[dateKey] ?? []).length > 0;
                    return (
                      <div key={dateKey} className="flex-1 relative group/col flex flex-col items-center py-1 min-w-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-0.5">
                          {WEEK_DAY_LABELS[i]}
                        </span>
                        <span className={`text-base font-bold leading-tight ${isToday ? "text-[#2E4A8B]" : "text-gray-700"}`}>
                          {date.getDate()}
                        </span>
                        <span className="text-[10px] text-gray-400 leading-none">
                          {MONTH_ABBREVS[date.getMonth()]}
                        </span>
                        {hasBlocks && (
                          <button
                            className="absolute right-0.5 top-0 w-4 h-4 rounded-full text-[10px] text-gray-300 hover:text-red-400 hover:bg-red-50 items-center justify-center hidden group-hover/col:flex transition-colors leading-none"
                            onClick={(e) => { e.stopPropagation(); clearDay(dateKey); }}
                            title="Clear this day"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Timeline grid */}
                <div className="flex overflow-x-auto" style={{ userSelect: "none", paddingTop: 6, paddingBottom: 6 }}>
                  {/* Time axis */}
                  <div className="relative shrink-0 w-10" style={{ height: tlBounds.totalPx }}>
                    {Array.from({ length: tlBounds.hours + 1 }, (_, i) => (
                      <div key={i} className="absolute right-2 text-[9px] text-gray-400 leading-none"
                        style={{ top: i * HOUR_PX - 5 }}>
                        {fmtHour(tlBounds.start + i)}
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  <div className="flex flex-1 gap-px min-w-0">
                    {weekDates.map((date) => {
                      const dateKey = toISODate(date);
                      const blocks = schedData[dateKey] ?? [];

                      return (
                        <div key={dateKey} className="flex-1 relative min-w-0" style={{ height: tlBounds.totalPx }}>
                          <div
                            ref={(el) => { colRefs.current[dateKey] = el; }}
                            className="absolute inset-0 bg-white cursor-crosshair"
                            onMouseDown={(e) => handleColDown(dateKey, e)}
                            onTouchStart={(e) => { const t = e.touches[0]; if (!t) return; e.preventDefault(); handleColDown(dateKey, { button: 0, clientX: t.clientX, clientY: t.clientY, target: e.target, currentTarget: e.currentTarget, preventDefault: () => {} } as unknown as React.MouseEvent<HTMLDivElement>); }}
                          >
                            {/* Hour lines */}
                            {Array.from({ length: tlBounds.hours + 1 }, (_, i) => (
                              <div key={i} className="absolute inset-x-0 border-t border-gray-100" style={{ top: i * HOUR_PX }} />
                            ))}
                            {/* Half-hour lines */}
                            {Array.from({ length: tlBounds.hours }, (_, i) => (
                              <div key={i} className="absolute inset-x-0 border-t border-gray-50" style={{ top: i * HOUR_PX + 30 }} />
                            ))}

                            {/* Existing blocks — rendered as segments to avoid overlapping bookings */}
                            {blocks.map((block) => {
                              const startMins = parseTime(block.start);
                              const endMins   = parseTime(block.end);

                              const isRT  = dragOp?.type === "resize-top"    && dragOp.srcDateKey === dateKey && dragOp.blockId === block.id;
                              const isRB  = dragOp?.type === "resize-bottom" && dragOp.srcDateKey === dateKey && dragOp.blockId === block.id;
                              const isMov = dragOp?.type === "move"          && dragOp.blockId === block.id;

                              const liveS = (isRT || isRB) ? dragOp!.s : startMins;
                              const liveE = (isRT || isRB) ? dragOp!.e : endMins;

                              const isActive = activeBlock?.dateKey === dateKey && activeBlock?.blockId === block.id;

                              // When dragging (move), show a single ghost at original position — no segment splitting needed
                              if (isMov) {
                                const t = minsToPx(startMins, tlBounds);
                                const h = Math.max(minsToPx(endMins, tlBounds) - t, 4);
                                return (
                                  <div
                                    key={block.id}
                                    data-block="1"
                                    className="absolute inset-x-0.5 rounded-md select-none opacity-25 bg-gray-400 border border-gray-400 z-10"
                                    style={{ top: t, height: h }}
                                  />
                                );
                              }

                              // Compute visible segments (booking time ranges punched out)
                              const dayBookingRanges = (bookingsByDate[dateKey] ?? []).map(b => ({
                                startMins: parseTime(b.time),
                                endMins:   parseTime(b.time) + getBookingDuration(b, profile),
                              }));
                              const segments = computeAvailSegments(liveS, liveE, dayBookingRanges);
                              if (segments.length === 0) return null;

                              return segments.map((seg, segIdx) => {
                                const isFirst = segIdx === 0;
                                const isLast  = segIdx === segments.length - 1;
                                const segTop    = minsToPx(seg.start, tlBounds);
                                const segHeight = Math.max(minsToPx(seg.end, tlBounds) - segTop, 4);

                                return (
                                  <div
                                    key={`${block.id}-${segIdx}`}
                                    data-block="1"
                                    className={`absolute inset-x-0.5 rounded-md select-none flex flex-col overflow-visible ${
                                      isActive
                                        ? "bg-[#2E4A8B]/15 border border-[#2E4A8B]/30 ring-2 ring-[#2E4A8B] z-10"
                                        : "bg-[#2E4A8B]/15 border border-[#2E4A8B]/30 hover:ring-1 hover:ring-[#2E4A8B]/40 z-10"
                                    }`}
                                    style={{ top: segTop, height: segHeight }}
                                  >
                                    {/* Top resize handle — first segment only */}
                                    {isFirst && (
                                      <div
                                        className="h-2 cursor-n-resize bg-[#2E4A8B]/20 hover:bg-[#2E4A8B]/50 rounded-t-md shrink-0 transition-colors"
                                        onMouseDown={(e) => handleResizeTopDown(dateKey, block.id, e)}
                                        onTouchStart={(e) => { const t = e.touches[0]; if (!t) return; e.preventDefault(); e.stopPropagation(); handleResizeTopDown(dateKey, block.id, { clientX: t.clientX, clientY: t.clientY, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent); }}
                                      />
                                    )}
                                    {/* Middle — move zone */}
                                    <div
                                      className="flex-1 min-h-0 px-1 overflow-hidden cursor-grab"
                                      onMouseDown={(e) => handleMoveDown(dateKey, block.id, e)}
                                      onTouchStart={(e) => { const t = e.touches[0]; if (!t) return; e.preventDefault(); e.stopPropagation(); handleMoveDown(dateKey, block.id, { clientX: t.clientX, clientY: t.clientY, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent); }}
                                    >
                                      {isFirst && segHeight >= 28 && (
                                        <div className="text-[9px] font-semibold text-[#2E4A8B] leading-tight pointer-events-none pt-0.5">
                                          {minsToStr(liveS)}
                                          {isLast && segHeight >= 44 && <><br />{minsToStr(liveE)}</>}
                                        </div>
                                      )}
                                      {isLast && !isFirst && segHeight >= 28 && (
                                        <div className="text-[9px] font-semibold text-[#2E4A8B] leading-tight pointer-events-none pt-0.5">
                                          {minsToStr(liveE)}
                                        </div>
                                      )}
                                    </div>
                                    {/* Bottom resize handle — last segment only */}
                                    {isLast && (
                                      <div
                                        className="h-2 cursor-s-resize bg-[#2E4A8B]/25 hover:bg-[#2E4A8B]/50 rounded-b-md shrink-0 transition-colors"
                                        onMouseDown={(e) => handleResizeBottomDown(dateKey, block.id, e)}
                                        onTouchStart={(e) => { const t = e.touches[0]; if (!t) return; e.preventDefault(); e.stopPropagation(); handleResizeBottomDown(dateKey, block.id, { clientX: t.clientX, clientY: t.clientY, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent); }}
                                      />
                                    )}
                                    {/* × Delete button — first segment only */}
                                    {isFirst && (
                                      <button
                                        data-block="1"
                                        onClick={(e) => { e.stopPropagation(); removeBlock(dateKey, block.id); }}
                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#2E4A8B]/40 hover:bg-red-500 text-white text-[11px] font-bold flex items-center justify-center z-30 leading-none transition-colors"
                                        title="Delete this block"
                                      >
                                        ×
                                      </button>
                                    )}
                                    {/* Edit popover — last segment only */}
                                    {isLast && isActive && (
                                      <div
                                        className="absolute left-1/2 z-30 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52"
                                        style={{ top: segHeight + 6, transform: "translateX(-50%)" }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="flex-1">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Start</p>
                                            <input
                                              type="time"
                                              value={toInputTime(block.start)}
                                              onChange={(e) => updateBlockTime(dateKey, block.id, "start", fromInputTime(e.target.value))}
                                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2E4A8B] font-medium"
                                            />
                                          </div>
                                          <div className="text-gray-300 mt-4">→</div>
                                          <div className="flex-1">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">End</p>
                                            <input
                                              type="time"
                                              value={toInputTime(block.end)}
                                              onChange={(e) => updateBlockTime(dateKey, block.id, "end", fromInputTime(e.target.value))}
                                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2E4A8B] font-medium"
                                            />
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => removeBlock(dateKey, block.id)}
                                          className="w-full text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg py-1.5 transition-colors"
                                        >
                                          Remove block
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })}

                            {/* Booked appointment blocks */}
                            {(bookingsByDate[dateKey] ?? []).map((booking) => {
                              const startMins = parseTime(booking.time);
                              const duration = getBookingDuration(booking, profile);
                              const endMins = Math.min(startMins + duration, tlBounds.end * 60);
                              if (endMins <= tlBounds.start * 60 || startMins >= tlBounds.end * 60) return null;
                              const top = minsToPx(Math.max(startMins, tlBounds.start * 60), tlBounds);
                              const height = Math.max(minsToPx(endMins, tlBounds) - top, 16);
                              const isActiveB = activeBookingId === booking.id;
                              const avatar = customerAvatars[booking.userId];
                              const initials = (booking.userName ?? "").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                              return (
                                <div
                                  key={booking.id}
                                  data-block="1"
                                  className={`absolute inset-x-0.5 rounded-md cursor-pointer z-20 bg-amber-400/40 border border-amber-500/60 overflow-visible ${isActiveB ? "ring-2 ring-amber-500" : ""}`}
                                  style={{ top, height }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBookingId(isActiveB ? null : booking.id);
                                    setActiveBlock(null);
                                  }}
                                >
                                  {height >= 18 && (
                                    <div className="px-1 pt-0.5 flex items-center gap-0.5 overflow-hidden">
                                      {avatar
                                        ? <img src={avatar} alt={booking.userName} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                                        : <span className="text-[7px] font-bold text-amber-800 bg-amber-200 rounded-full w-3.5 h-3.5 flex items-center justify-center shrink-0 leading-none">{initials}</span>
                                      }
                                      <p className="text-[9px] font-bold text-amber-900 leading-tight truncate ml-0.5">{booking.userName}</p>
                                    </div>
                                  )}
                                  {height >= 32 && (
                                    <p className="text-[8px] text-amber-800 leading-tight px-1 truncate">{booking.service}</p>
                                  )}
                                  {height >= 46 && (
                                    <p className="text-[8px] text-amber-700 leading-tight px-1">{booking.time}</p>
                                  )}

                                  {/* Detail popover */}
                                  {isActiveB && (
                                    <div
                                      className="absolute left-1/2 z-40 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-56"
                                      style={{ top: height + 6, transform: "translateX(-50%)" }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-2 mb-2.5">
                                        {avatar
                                          ? <img src={avatar} alt={booking.userName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                                          : <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">{initials}</div>
                                        }
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-gray-900 truncate">{booking.userName}</p>
                                          <p className="text-xs text-gray-500 truncate">{booking.service}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2.5">
                                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {booking.time} · {duration} min
                                      </div>
                                      <button
                                        onClick={() => {
                                          setBookings(prev => prev.filter(b => b.id !== booking.id));
                                          setActiveBookingId(null);
                                          void apiUpdateBooking(booking.id, { cancelled: true, status: "cancelled" });
                                        }}
                                        className="w-full text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg py-1.5 transition-colors border border-transparent hover:border-red-100"
                                      >
                                        Cancel appointment
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Move preview */}
                            {dragOp?.type === "move" && dragOp.curDateKey === dateKey && (() => {
                              const pt = minsToPx(dragOp.s, tlBounds);
                              const ph = Math.max(minsToPx(dragOp.e, tlBounds) - pt, 4);
                              return (
                                <div
                                  className="absolute inset-x-0.5 rounded-md bg-[#2E4A8B]/25 border-2 border-[#2E4A8B]/60 pointer-events-none z-10"
                                  style={{ top: pt, height: ph }}
                                >
                                  {ph >= 20 && (
                                    <div className="px-1.5 pt-0.5 text-[9px] font-semibold text-[#2E4A8B] leading-tight">
                                      {minsToStr(dragOp.s)}{ph >= 36 && <><br />{minsToStr(dragOp.e)}</>}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Create preview */}
                            {dragOp?.type === "create" && dragOp.curDateKey === dateKey && (() => {
                              const pt = minsToPx(dragOp.s, tlBounds);
                              const ph = Math.max(minsToPx(dragOp.e, tlBounds) - pt, 4);
                              return (
                                <div
                                  className="absolute inset-x-0.5 rounded-md bg-[#2E4A8B]/25 border-2 border-[#2E4A8B]/60 pointer-events-none z-10"
                                  style={{ top: pt, height: ph }}
                                >
                                  {ph >= 20 && (
                                    <div className="px-1.5 pt-0.5 text-[9px] font-semibold text-[#2E4A8B] leading-tight">
                                      {minsToStr(dragOp.s)}{ph >= 36 && <><br />{minsToStr(dragOp.e)}</>}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 ml-10 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#2E4A8B]/20 border border-[#2E4A8B]/30 inline-block" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-400/40 border border-amber-500/60 inline-block" />
                    Booked
                  </span>
                  <span className="ml-auto">Snaps to 15-min · No overlaps · Auto-saved</span>
                </div>
              </div>

              {/* ── Removed: redundant calendar / all-bookings sections — bookings now shown inline on the scheduler grid above ── */}
              <div className="hidden">

                {/* Monthly calendar */}
                <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">{MONTH_NAMES[calMonth]} {calYear}</h2>
                    <div className="flex gap-1">
                      {[["prev", "M15 19l-7-7 7-7"], ["next", "M9 5l7 7-7 7"]].map(([dir, d]) => (
                        <button key={dir} onClick={() => { const dec = dir === "prev"; setCalMonth(m => dec ? (m === 0 ? (setCalYear(y => y - 1), 11) : m - 1) : (m === 11 ? (setCalYear(y => y + 1), 0) : m + 1)); setSelectedDay(null); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-7 mb-1">{DAY_LABELS.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}</div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const hasB = bookingDates.has(day), isSel = selectedDay === day;
                      const isTod = today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
                      return (
                        <button key={day} onClick={() => setSelectedDay(isSel ? null : day)}
                          className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all ${isSel ? "bg-[#2E4A8B] text-white" : isTod ? "bg-[#2E4A8B]/10 text-[#2E4A8B] font-bold" : "hover:bg-gray-100 text-gray-700"}`}>
                          {day}
                          {hasB && <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSel ? "bg-white/70" : "bg-[#FF9500]"}`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day detail / upcoming */}
                <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-6">
                  {selectedDay ? (
                    <>
                      <h2 className="font-semibold text-gray-900 mb-4">{MONTH_NAMES[calMonth]} {selectedDay}</h2>
                      {dayBookings.length > 0 ? (
                        <div className="space-y-2">
                          {dayBookings.map(b => (
                            <div key={b.id} className="flex items-center justify-between text-sm bg-[#2E4A8B]/5 rounded-lg px-3 py-2.5">
                              <div><p className="font-medium text-gray-800">{b.userName}</p><p className="text-xs text-gray-500">{b.service}</p></div>
                              <p className="text-gray-500 text-xs shrink-0 ml-2">{b.time}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No bookings on this day.</p>
                      )}
                    </>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900">Upcoming Bookings</h2>
                        {bookings.length > 0 && (
                          <button
                            onClick={() => {
                              const toCancel = [...bookings];
                              setBookings([]);
                              toCancel.forEach(b => void apiUpdateBooking(b.id, { cancelled: true, status: "cancelled" }));
                            }}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            title="Clear all your bookings"
                          >
                            Reset all
                          </button>
                        )}
                      </div>
                      {bookings.length === 0 ? (
                        <p className="text-sm text-gray-400">No bookings yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {bookings.slice(0, 5).map(b => (
                            <div key={b.id} className="flex items-center justify-between text-sm border-b last:border-b-0 border-gray-100 pb-2">
                              <div><p className="font-medium text-gray-800">{b.userName}</p><p className="text-xs text-gray-500">{b.service}</p></div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-xs text-gray-600">{new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                                <p className="text-xs text-gray-400">{b.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── All bookings — now shown inline on grid ── */}
              <div className="hidden">
                <h2 className="font-semibold text-gray-900 mb-4">All Bookings</h2>
                {bookings.length === 0 ? (
                  <p className="text-sm text-gray-400 py-10 text-center">No bookings yet.</p>
                ) : (
                  <div className="space-y-3">
                    {bookings.map(b => (
                      <div key={b.id} className="flex items-center gap-4 py-3 border-b last:border-b-0 border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-[#2E4A8B]/10 text-[#2E4A8B] font-bold text-sm flex items-center justify-center shrink-0">
                          {(b.userName ?? "").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900">{b.userName}</p><p className="text-sm text-gray-500">{b.service}</p></div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-gray-700">{new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                          <p className="text-xs text-gray-400">{b.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ MESSAGES ════════════════════════════════════════════════════════ */}
          {tab === "messages" && (
            <div className="max-w-[760px]">
              <h1 className="font-heading font-bold text-gray-900 text-2xl mb-6">Messages</h1>
              <div className="flex gap-4 h-[560px]">
                <div className={`${selectedThread ? "hidden md:flex" : "flex"} flex-col w-full md:w-[280px] shrink-0 bg-white border border-[#2E4A8B]/12 rounded-xl overflow-hidden`}>
                  {threads.map(thread => (
                    <button key={thread.id}
                      onClick={() => { setSelectedThread(thread); setThreads(p => p.map(t => t.id === thread.id ? { ...t, unread: false } : t)); }}
                      className={`flex items-start gap-3 p-4 border-b last:border-b-0 border-gray-100 text-left hover:bg-gray-50 transition-colors ${selectedThread?.id === thread.id ? "bg-blue-50" : ""}`}>
                      <div className="w-9 h-9 rounded-full bg-[#2E4A8B]/10 text-[#2E4A8B] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {thread.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-sm font-semibold truncate ${thread.unread ? "text-gray-900" : "text-gray-700"}`}>{thread.customerName}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {thread.unread && <span className="w-2 h-2 rounded-full bg-[#2E4A8B]" />}
                            <span className="text-xs text-gray-400">{thread.timestamp}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{thread.preview}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedThread ? (
                  <div className="flex-1 bg-white border border-[#2E4A8B]/12 rounded-xl flex flex-col overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                      <button onClick={() => setSelectedThread(null)} className="md:hidden text-gray-400 hover:text-gray-700 mr-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <div className="w-9 h-9 rounded-full bg-[#2E4A8B]/10 text-[#2E4A8B] font-bold text-xs flex items-center justify-center shrink-0">
                        {selectedThread.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <p className="font-semibold text-gray-900">{selectedThread.customerName}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                      {selectedThread.messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === "pro" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.from === "pro" ? "bg-[#2E4A8B] text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                            {msg.text}
                            <p className={`text-[10px] mt-1 ${msg.from === "pro" ? "text-blue-200" : "text-gray-400"}`}>{msg.time}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
                      <input type="text" placeholder="Type a message..." value={replyText}
                        onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#2E4A8B]" />
                      <button onClick={sendMessage} disabled={!replyText.trim()}
                        className="w-9 h-9 rounded-full bg-[#2E4A8B] text-white flex items-center justify-center hover:bg-[#243A6F] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="hidden md:flex flex-1 bg-white border border-[#2E4A8B]/12 rounded-xl items-center justify-center text-gray-400 text-sm">Select a conversation</div>
                )}
              </div>
            </div>
          )}
          {/* ══ ANALYTICS ═══════════════════════════════════════════════════════ */}
          {tab === "analytics" && (() => {
            // Derive analytics data from localStorage
            const profileId = profile?.id;
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            // Bookings this month for this pro
            const monthBookings = bookings.filter(b => new Date(b.date) >= monthStart);
            const totalBookings = bookings.length;
            const monthBookingCount = monthBookings.length;

            // Average rating
            const avgRating = proReviews.length > 0
              ? proReviews.reduce((sum, r) => sum + r.rating, 0) / proReviews.length
              : null;

            // Estimated revenue (bookings × avg service price)
            const avgPrice = profile?.services && profile.services.length > 0
              ? profile.services.reduce((sum, s) => sum + s.price, 0) / profile.services.length
              : profile?.startingPrice ?? 50;
            const estimatedRevenue = Math.round(monthBookingCount * avgPrice);

            // Simulated profile views (deterministic, grows ~5–12/day based on profileId seed)
            const daysSinceStart = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000);
            const seed = profileId ? profileId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : 42;
            const dailyRate = 5 + (seed % 8);
            const monthViews = Math.floor(now.getDate() * dailyRate + (seed % 20));
            const conversionRate = monthViews > 0 ? ((monthBookingCount / monthViews) * 100).toFixed(1) : "—";

            // Most popular service
            const svcCounts: Record<string, number> = {};
            for (const b of bookings) {
              svcCounts[b.service] = (svcCounts[b.service] ?? 0) + 1;
            }
            const topServices = Object.entries(svcCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
            const maxSvcCount = topServices[0]?.[1] ?? 1;

            // Completion checklist
            const checks = [
              { label: "Profile photo", done: !!profile?.profileImage },
              { label: "Bio written", done: !!profile?.bio?.trim() },
              { label: "Services added", done: (profile?.services?.length ?? 0) > 0 },
              { label: "Availability set", done: Object.keys(schedData).length > 0 },
              { label: "Portfolio photos", done: (profile?.portfolioImages?.filter(Boolean).length ?? 0) > 0 },
            ];
            const doneCount = checks.filter(c => c.done).length;

            // Recent bookings (last 5)
            const recentBookings = [...bookings]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5);

            return (
              <div className="max-w-[760px]">
                <h1 className="font-heading font-bold text-gray-900 text-2xl mb-6">Analytics</h1>

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    {
                      label: "Profile Views",
                      sublabel: "This month",
                      value: monthViews.toLocaleString(),
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ),
                    },
                    {
                      label: "Bookings",
                      sublabel: "This month",
                      value: monthBookingCount.toString(),
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ),
                    },
                    {
                      label: "Est. Revenue",
                      sublabel: "This month",
                      value: monthBookingCount > 0 ? `$${estimatedRevenue.toLocaleString()}` : "—",
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                    },
                    {
                      label: "Avg Rating",
                      sublabel: `${proReviews.length} review${proReviews.length !== 1 ? "s" : ""}`,
                      value: avgRating !== null ? avgRating.toFixed(1) : "—",
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      ),
                    },
                  ].map(({ label, sublabel, value, icon }) => (
                    <div key={label} className="bg-white border border-[#2E4A8B]/12 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                        <div className="w-8 h-8 rounded-lg bg-[#2E4A8B]/8 flex items-center justify-center text-[#2E4A8B]">
                          {icon}
                        </div>
                      </div>
                      <p className="font-heading font-bold text-2xl text-gray-900">{value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                  {/* Most Popular Services */}
                  <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 text-sm">Most Booked Services</h3>
                    {topServices.length === 0 ? (
                      <p className="text-sm text-gray-400">No bookings yet — services will appear here.</p>
                    ) : (
                      <div className="space-y-3">
                        {topServices.map(([name, count]) => (
                          <div key={name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-700 truncate pr-2">{name}</span>
                              <span className="text-xs font-semibold text-gray-500 shrink-0">{count}×</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(count / maxSvcCount) * 100}%`,
                                  background: "linear-gradient(135deg, #2E4A8B, #4A6BC0)",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Profile Completion */}
                  <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 text-sm">Profile Strength</h3>
                      <span className="text-xs font-bold text-[#2E4A8B]">{doneCount}/{checks.length}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(doneCount / checks.length) * 100}%`,
                          background: "linear-gradient(135deg, #2E4A8B, #4A6BC0)",
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      {checks.map(({ label, done }) => (
                        <div key={label} className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? "border-[#2E4A8B] bg-[#2E4A8B]" : "border-gray-300"}`}>
                            {done && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-xs ${done ? "line-through text-gray-400" : "text-gray-600"}`}>{label}</span>
                        </div>
                      ))}
                    </div>
                    {doneCount < checks.length && (
                      <p className="text-xs text-gray-400 mt-3">Complete your profile to rank higher in search results.</p>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-[#2E4A8B]/12 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-4 text-sm">Recent Bookings</h3>
                  {recentBookings.length === 0 ? (
                    <p className="text-sm text-gray-400">No bookings yet. Share your profile to get started!</p>
                  ) : (
                    <div className="space-y-3">
                      {recentBookings.map((b) => {
                        const d = new Date(b.date);
                        const isPast = d < now;
                        return (
                          <div key={b.id} className="flex items-center gap-4 py-2.5 border-b border-gray-100 last:border-b-0">
                            <div className="w-10 h-10 rounded-xl bg-[#2E4A8B]/8 flex flex-col items-center justify-center shrink-0">
                              <p className="text-[9px] font-bold text-[#2E4A8B] uppercase leading-none">{d.toLocaleDateString("en-US", { month: "short" })}</p>
                              <p className="text-sm font-heading font-bold text-[#2E4A8B] leading-none mt-0.5">{d.getDate()}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{b.userName}</p>
                              <p className="text-xs text-gray-500">{b.service} · {b.time}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${isPast ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
                              {isPast ? "Completed" : "Upcoming"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Conversion insight */}
                <div className="mt-5 bg-gradient-to-br from-[#2E4A8B]/5 to-[#4A6BC0]/5 border border-[#2E4A8B]/15 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2E4A8B]/10 flex items-center justify-center shrink-0 text-[#2E4A8B]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Booking conversion rate</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {conversionRate !== "—"
                          ? `${conversionRate}% of profile views this month led to a booking`
                          : "Add your availability to start getting bookings"}
                      </p>
                    </div>
                    <p className="font-heading font-bold text-xl text-[#2E4A8B] shrink-0 ml-auto">{conversionRate}{conversionRate !== "—" ? "%" : ""}</p>
                  </div>
                </div>
              </div>
            );
          })()}

        </main>
      </div>
    </div>
  );
}
