// Single source of truth for all shared interfaces

export interface Shop {
  id: string;
  name: string;
  address: string;
  city: string;
  image: string;
}

export interface BarberService {
  name: string;
  description: string;
  duration: number;
  price: number;
  photos?: string[]; // up to 4 base64 photos
  images?: string[]; // alias used in dashboard
}

export interface BarberReview {
  name: string;
  rating: number;
  text: string;
  date: string;
}

export interface Barber {
  id: string;
  name: string;
  username: string;
  rating: number;
  reviewCount: number;
  location: string;
  fullAddress: string;
  lat?: number;
  lng?: number;
  type: "independent" | "shop";
  shopId?: string;
  shopName?: string;
  shopAddress?: string;
  shopImage?: string;
  startingPrice: number;
  specialties: string[];
  hairTypes: string[];
  bio: string;
  experience: string;
  languages: string[];
  matchPercent?: number;
  isNew?: boolean;
  heroImage: string;
  profileImage: string;
  portfolioImages: string[];
  services: BarberService[];
  reviews: BarberReview[];
  nextAvailable?: string;
  credentials?: { text: string; fileName?: string; fileData?: string }[];
}

export interface User {
  id: string;
  username: string;
  password?: string; // never returned from API — stored only in DB
  name: string;
  role: "customer" | "pro";
  profileId?: string; // for pros — links to Barber.id in barbers.json
  avatar?: string;    // base64 data URL
  // Customer preference fields (only populated for role === "customer"):
  hairType?: string;
  hairSubtype?: string;
  hairTexture?: string;
  hairColor?: string;
  stylePrefs?: string[];
  concerns?: string[];
  notes?: string;
  gender?: string;
  location?: string;
}

export interface Booking {
  id: string;
  barberId: string;
  barberName: string;
  barberImage: string;
  userId: string;
  userName?: string;  // customer name — populated at booking creation
  service: string;
  date: string;
  time: string;
  endTime?: string;   // computed end time string
  price: number;
  duration: number;
  status: "upcoming" | "past" | "cancelled";
  cancelled?: boolean;
  createdAt?: string;
  notes?: string;
}

// Message bubble as stored within a thread
export interface MessageBubble {
  from: "customer" | "pro";
  text: string;
  time: string; // display time string, e.g. "2:34 PM"
}

// A conversation thread stored per-pro in threads.json
export interface MessageThread {
  id: string;
  customerId?: string;
  customerName: string;
  preview: string;
  timestamp: string;   // ISO string
  unread: boolean;
  messages: MessageBubble[];
}

// A reference stored per-customer pointing back to a pro's thread
export interface CustomerThreadRef {
  proProfileId: string;
  proName: string;
  proAvatar?: string;
  threadId: string;
  lastMessage?: string;
  timestamp: string;   // ISO string
  unread: boolean;
}

export interface StoredReview {
  id?: number;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  date: string;
  reply?: string;
  photos?: string[];
}

export interface TimeBlock {
  id: string;
  start: string; // time string, e.g. "9:00 AM"
  end: string;
}

// Business hours stored as { openTime: "9:00 AM", closeTime: "5:00 PM" }
export type BusinessHours = { openTime: string; closeTime: string };

export interface NotifPrefs {
  bookingConfirmations: boolean;
  bookingReminders: boolean;
  messages: boolean;
  promotions: boolean;
}
