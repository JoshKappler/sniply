"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getCurrentUser } from "@/lib/auth";
import { apiGetCustomerThreads } from "@/lib/api";
import type { CustomerThreadRef } from "@/lib/types";


const HAIR_TYPE_LABELS: Record<string, string> = {
  straight: "Straight (Type 1)",
  wavy: "Wavy (Type 2)",
  curly: "Curly (Type 3)",
  coily: "Coily (Type 4)",
  kinky: "Kinky",
  unsure: "Not sure",
};

const HAIR_TEXTURE_LABELS: Record<string, string> = {
  fine: "Fine",
  medium: "Medium",
  thick: "Thick",
  unsure: "Not sure",
};

const HAIR_COLOR_LABELS: Record<string, string> = {
  black: "Natural / Black",
  brown: "Brown",
  blonde: "Blonde",
  red: "Red",
  dyed: "Dyed / Colored",
  gray: "Gray / Silver",
  other: "Other",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  prefer_not: "Prefer not to say",
};

interface CustomerProfile {
  name: string;
  gender: string;
  hairType: string;
  hairSubtype: string;
  hairTexture: string;
  hairColor: string;
  stylePrefs: string[];
  concerns: string[];
  notes: string;
  profilePhoto?: string;
  referencePhotos: string[];
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-gray-800 font-medium text-sm">{value}</p>
    </div>
  );
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [messageThreads, setMessageThreads] = useState<CustomerThreadRef[]>([]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== "customer") {
      router.replace("/");
      return;
    }
    setUserName(user.name || "");
    // Build profile from the user object (source of truth from DB)
    const baseProfile: CustomerProfile = {
      name: user.name ?? "",
      gender: user.gender ?? "",
      hairType: user.hairType ?? "",
      hairSubtype: user.hairSubtype ?? "",
      hairTexture: user.hairTexture ?? "",
      hairColor: user.hairColor ?? "",
      stylePrefs: user.stylePrefs ?? [],
      concerns: user.concerns ?? [],
      notes: user.notes ?? "",
      profilePhoto: user.avatar ?? undefined,
      referencePhotos: [],
    };
    // Supplement with localStorage only for reference photos and profile photo
    // (these are not stored in DB, only client-side)
    try {
      const raw = localStorage.getItem("sniply_customer_profile");
      if (raw) {
        const saved = JSON.parse(raw) as Partial<CustomerProfile>;
        baseProfile.referencePhotos = saved.referencePhotos ?? [];
        if (!baseProfile.profilePhoto && saved.profilePhoto) {
          baseProfile.profilePhoto = saved.profilePhoto;
        }
      }
    } catch (err) {
      console.error("sniply/profile: failed to parse legacy profile from localStorage", err);
    }
    setProfile(baseProfile);
    // Load message threads from API
    apiGetCustomerThreads(user.id).then((threads) => {
      setMessageThreads(threads.slice(0, 4));
    }).catch((err) => console.error("sniply/profile: failed to load message threads", err)).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const displayName = profile?.name || userName || "—";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-[700px] mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading font-bold text-gray-900 text-3xl">My Profile</h1>
          <Link
            href="/customer/profile-setup"
            className="btn-primary text-sm px-5 h-10 inline-flex items-center"
          >
            Edit Profile
          </Link>
        </div>

        {!profile ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/8 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="font-heading font-bold text-gray-900 text-xl mb-2">No profile set up yet</h2>
            <p className="text-gray-500 mb-6">
              Set up your hair profile to get personalized matches with the best pros for you.
            </p>
            <Link href="/customer/profile-setup" className="btn-primary inline-flex items-center px-6">
              Set Up Profile
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Identity card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-5">
                {profile.profilePhoto ? (
                  <img
                    src={profile.profilePhoto}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] text-white font-semibold flex items-center justify-center text-2xl shrink-0">
                    {initials || "?"}
                  </div>
                )}
                <div>
                  <h2 className="font-heading font-bold text-gray-900 text-2xl">{displayName}</h2>
                  {profile.gender && profile.gender !== "prefer_not" && (
                    <p className="text-gray-500 text-sm mt-0.5">
                      {GENDER_LABELS[profile.gender] || profile.gender}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Hair Profile */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-heading font-semibold text-gray-900 text-lg mb-5">Hair Profile</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <InfoField
                  label="Hair Type"
                  value={HAIR_TYPE_LABELS[profile.hairType] || profile.hairType || "—"}
                />
                <InfoField
                  label="Hair Texture"
                  value={HAIR_TEXTURE_LABELS[profile.hairTexture] || profile.hairTexture || "—"}
                />
                {profile.hairSubtype && (
                  <InfoField label="Hair Subtype" value={profile.hairSubtype.toUpperCase()} />
                )}
                {profile.hairColor && (
                  <InfoField
                    label="Hair Color"
                    value={HAIR_COLOR_LABELS[profile.hairColor] || profile.hairColor}
                  />
                )}
              </div>
            </div>

            {/* Style Preferences */}
            {profile.stylePrefs?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-heading font-semibold text-gray-900 text-lg mb-4">
                  Style Preferences
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.stylePrefs.map((pref) => (
                    <span
                      key={pref}
                      className="text-sm font-medium bg-[var(--color-primary)]/8 text-[var(--color-primary)] px-3 py-1.5 rounded-full"
                    >
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hair Concerns */}
            {profile.concerns?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-heading font-semibold text-gray-900 text-lg mb-4">
                  Hair Concerns
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.concerns.map((concern) => (
                    <span
                      key={concern}
                      className="text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full"
                    >
                      {concern}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Notes */}
            {profile.notes && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-heading font-semibold text-gray-900 text-lg mb-3">
                  Additional Notes
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{profile.notes}</p>
              </div>
            )}

            {/* Reference Photos */}
            {profile.referencePhotos?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-heading font-semibold text-gray-900 text-lg mb-4">
                  Reference Photos
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {profile.referencePhotos.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden">
                      <img
                        src={img}
                        alt={`Reference ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Messages Section — always visible */}
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-gray-900 text-lg">Messages</h3>
            <Link
              href="/messages"
              className="text-sm font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1"
            >
              View all
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {messageThreads.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/8 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">No messages yet</p>
              <p className="text-xs text-gray-400 mt-1">Your conversations with pros will appear here</p>
              <Link href="/browse" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline mt-3">
                Find a pro to message
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {messageThreads.map((thread) => (
                <Link
                  key={thread.threadId}
                  href="/messages"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  {thread.proAvatar ? (
                    <img src={thread.proAvatar} alt={thread.proName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white font-semibold flex items-center justify-center text-sm shrink-0">
                      {thread.proName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${thread.unread ? "font-bold text-gray-900" : "font-semibold text-gray-900"}`}>
                        {thread.proName}
                      </p>
                      {thread.unread && (
                        <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0" />
                      )}
                    </div>
                    {thread.lastMessage && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{thread.lastMessage}</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-[var(--color-primary)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
              <Link
                href="/messages"
                className="block text-center text-sm font-medium text-[var(--color-primary)] hover:underline pt-2"
              >
                View all conversations →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
