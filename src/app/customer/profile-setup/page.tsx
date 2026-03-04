"use client";
import { useState, useCallback, useRef, ChangeEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, setCurrentUser, type User } from "@/lib/auth";
import { apiRegisterUser, apiUpdateUser, apiLogin } from "@/lib/api";
import { CustomSelect } from "@/components/CustomSelect";
import Navbar from "@/components/Navbar";

const STYLE_PREFERENCES = [
  "Fades", "Tapers", "Curls", "Waves", "Braids", "Locs",
  "Twists", "Cornrows", "Color", "Beards", "Natural", "Extensions",
  "Relaxers/Perms", "Edge Styling", "Kids Cuts", "Length Maintenance", "Protective Styles",
];

const HAIR_CONCERNS = [
  "Thinning", "Damage", "Dryness", "Breakage", "Split Ends",
  "Scalp Issues", "Growth", "Frizz", "Heat Damage",
];

const HAIR_TYPE_OPTIONS = [
  { value: "straight", label: "Straight (Type 1)" },
  { value: "wavy", label: "Wavy (Type 2)" },
  { value: "curly", label: "Curly (Type 3)" },
  { value: "coily", label: "Coily (Type 4)" },
  { value: "kinky", label: "Kinky" },
  { value: "unsure", label: "Not sure" },
];

const HAIR_SUBTYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  straight: [
    { value: "1a", label: "1a — Very straight, fine" },
    { value: "1b", label: "1b — Straight with a slight bend" },
    { value: "1c", label: "1c — Straight, coarse & thick" },
  ],
  wavy: [
    { value: "2a", label: "2a — Loose S-waves, fine" },
    { value: "2b", label: "2b — Medium S-waves, frizz-prone" },
    { value: "2c", label: "2c — Deep S-waves, coarse" },
  ],
  curly: [
    { value: "3a", label: "3a — Loose, springy curls" },
    { value: "3b", label: "3b — Medium, bouncy curls" },
    { value: "3c", label: "3c — Tight corkscrew curls" },
  ],
  coily: [
    { value: "4a", label: "4a — Soft S-coils" },
    { value: "4b", label: "4b — Z-pattern, less defined" },
    { value: "4c", label: "4c — Tight Z-coils, densely packed" },
  ],
  kinky: [
    { value: "4a", label: "4a — Soft S-coils" },
    { value: "4b", label: "4b — Z-pattern, less defined" },
    { value: "4c", label: "4c — Tight Z-coils, densely packed" },
  ],
};

const HAIR_TEXTURE_OPTIONS = [
  { value: "fine", label: "Fine" },
  { value: "medium", label: "Medium" },
  { value: "thick", label: "Thick" },
  { value: "unsure", label: "Not sure" },
];

const HAIR_COLOR_OPTIONS = [
  { value: "black", label: "Natural / Black" },
  { value: "brown", label: "Brown" },
  { value: "blonde", label: "Blonde" },
  { value: "red", label: "Red" },
  { value: "dyed", label: "Dyed / Colored" },
  { value: "gray", label: "Gray / Silver" },
  { value: "other", label: "Other" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not", label: "Prefer not to say" },
];

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
        el.onerror = () => reject(new Error("Unsupported image format. Please use JPEG or PNG."));
        el.src = objectUrl;
      });
      source = img; srcW = img.naturalWidth; srcH = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(source as CanvasImageSource, 0, 0, w, h);
  if ("close" in source) (source as ImageBitmap).close();
  const MAX_B64 = Math.round(500 * 1024 / 0.75);
  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > MAX_B64 && q > 0.30) {
    q = Math.max(0.30, q - 0.08);
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

const STEP_TITLES = [
  "Create Account",
  "About You",
  "Your Hair",
  "Your Preferences",
  "Reference Photos",
];
const TOTAL_STEPS = 5;
// Optional steps — show "Skip this step" link
const OPTIONAL_STEPS = new Set([4, 5]);

export default function CustomerProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [existingUser, setExistingUser] = useState<User | null>(null);

  // Account
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form data
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    hairType: "",
    hairSubtype: "",
    hairTexture: "",
    hairColor: "",
    stylePrefs: [] as string[],
    concerns: [] as string[],
    notes: "",
  });

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [referencePhotos, setReferencePhotos] = useState<(string | null)[]>(Array(6).fill(null));
  const [showMoreStyles, setShowMoreStyles] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const refPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);

  const visibleStyles = showMoreStyles ? STYLE_PREFERENCES : STYLE_PREFERENCES.slice(0, 12);
  const subtypeOptions = HAIR_SUBTYPE_OPTIONS[form.hairType] ?? [];

  useEffect(() => {
    const cu = getCurrentUser();
    setExistingUser(cu);

    if (cu) {
      // Pre-fill form with saved profile data from user session + legacy localStorage
      const nameParts = (cu.name || "").split(" ");
      const patch: Partial<typeof form> = {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        gender: cu.gender || "",
        hairType: cu.hairType || "",
        hairSubtype: cu.hairSubtype || "",
        hairTexture: cu.hairTexture || "",
        hairColor: cu.hairColor || "",
        stylePrefs: cu.stylePrefs || [],
        concerns: cu.concerns || [],
        notes: cu.notes || "",
      };
      // Load additional fields from localStorage (profile photo, reference photos, and any missing fields)
      try {
        const raw = localStorage.getItem("sniply_customer_profile");
        if (raw) {
          const saved = JSON.parse(raw);
          if (!patch.hairType && saved.hairType) patch.hairType = saved.hairType;
          if (!patch.hairSubtype && saved.hairSubtype) patch.hairSubtype = saved.hairSubtype;
          if (!patch.hairTexture && saved.hairTexture) patch.hairTexture = saved.hairTexture;
          if (!patch.hairColor && saved.hairColor) patch.hairColor = saved.hairColor;
          if (!patch.gender && saved.gender) patch.gender = saved.gender;
          if (!patch.stylePrefs?.length && saved.stylePrefs?.length) patch.stylePrefs = saved.stylePrefs;
          if (!patch.concerns?.length && saved.concerns?.length) patch.concerns = saved.concerns;
          if (!patch.notes && saved.notes) patch.notes = saved.notes;
          if (saved.profilePhoto) setProfilePhoto(saved.profilePhoto);
          if (saved.referencePhotos?.length) {
            const photos: (string | null)[] = Array(6).fill(null);
            (saved.referencePhotos as string[]).forEach((p: string, i: number) => {
              if (i < 6) photos[i] = p;
            });
            setReferencePhotos(photos);
          }
        }
      } catch (err) {
        console.error("sniply/profile-setup: failed to parse saved profile from localStorage", err);
      }
      setForm((prev) => ({ ...prev, ...patch }));
    }

    setLoading(false);
  }, []);

  const isEditing = !!existingUser;

  const updateField = (field: string, value: string) => {
    const next = { ...form, [field]: value };
    if (field === "hairType") next.hairSubtype = "";
    setForm(next);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const toggleArray = (field: "stylePrefs" | "concerns", value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleProfilePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(await compressImage(file, 300, 0.80));
  };

  const handleRefPhoto = async (slot: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await compressImage(file, 800, 0.80);
    setReferencePhotos(prev => { const next = [...prev]; next[slot] = data; return next; });
  };

  const validateStep = useCallback((s: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (s === 1 && !isEditing) {
      if (!username.trim()) errs.username = "Username is required";
      if (!password) errs.password = "Password is required";
      else if (password.length < 6) errs.password = "Password must be at least 6 characters";
      if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    }
    if (s === 2) {
      if (!form.firstName.trim()) errs.firstName = "First name is required";
    }
    if (s === 3) {
      if (!form.hairType) errs.hairType = "Hair type is required";
      if (!form.hairTexture) errs.hairTexture = "Hair texture is required";
    }
    return errs;
  }, [isEditing, username, password, confirmPassword, form]);

  const handleNext = () => {
    const errs = validateStep(step);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStep(s => Math.min(TOTAL_STEPS, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const skipStep = () => {
    setErrors({});
    setStep(s => Math.min(TOTAL_STEPS, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmitError("");
    const allErrors: Record<string, string> = {};

    if (!isEditing) {
      if (!username.trim()) allErrors.username = "Username is required";
      if (!password) allErrors.password = "Password is required";
      else if (password.length < 6) allErrors.password = "Password must be at least 6 characters";
      if (password !== confirmPassword) allErrors.confirmPassword = "Passwords do not match";
    }
    if (!form.firstName.trim()) allErrors.firstName = "First name is required";
    if (!form.hairType) allErrors.hairType = "Hair type is required";
    if (!form.hairTexture) allErrors.hairTexture = "Hair texture is required";

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      if (!isEditing && (allErrors.username || allErrors.password || allErrors.confirmPassword)) setStep(1);
      else if (allErrors.firstName) setStep(2);
      else if (allErrors.hairType || allErrors.hairTexture) setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    try {
      const name = `${form.firstName} ${form.lastName}`.trim();
      const prefPatch = {
        name,
        gender: form.gender,
        hairType: form.hairType,
        hairSubtype: form.hairSubtype,
        hairTexture: form.hairTexture,
        hairColor: form.hairColor,
        stylePrefs: form.stylePrefs,
        concerns: form.concerns,
        notes: form.notes,
        avatar: profilePhoto ?? undefined,
      };

      if (!isEditing) {
        try {
          const newUser = await apiRegisterUser({
            username: username.trim(),
            password,
            role: "customer",
            ...prefPatch,
          });
          // Establish the server-side session cookie so authenticated API calls work
          await apiLogin(username.trim(), password);
          setCurrentUser(newUser);
        } catch (err) {
          setErrors({ username: err instanceof Error ? err.message : "Registration failed" });
          setStep(1);
          return;
        }
      } else {
        const existing = getCurrentUser();
        if (existing) {
          const updated = await apiUpdateUser(existing.id, prefPatch);
          setCurrentUser({ ...existing, ...updated });
        }
      }

      // Keep localStorage profile for reference photo display and field persistence
      localStorage.setItem("sniply_customer_profile", JSON.stringify({
        name, gender: form.gender,
        hairType: form.hairType, hairSubtype: form.hairSubtype,
        hairTexture: form.hairTexture, hairColor: form.hairColor,
        stylePrefs: form.stylePrefs, concerns: form.concerns, notes: form.notes,
        profilePhoto: profilePhoto ?? null,
        referencePhotos: referencePhotos.filter(Boolean),
      }));

      localStorage.setItem("sniply_onboarded", "true");
      localStorage.setItem("sniply_role", "customer");
      router.push("/browse");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("storage")) {
        setSubmitError("Storage limit reached. Try using smaller photos (under 1MB each).");
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shared UI pieces ──

  const profilePhotoUpload = (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Profile Photo <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhoto} />
      {profilePhoto ? (
        <div className="relative inline-block">
          <img src={profilePhoto} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
          <button type="button" onClick={() => profilePhotoRef.current?.click()} className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-medium">Change</button>
        </div>
      ) : (
        <div onClick={() => profilePhotoRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-blue-50/30 transition-colors" style={{ height: "140px" }}>
          <svg className="w-9 h-9 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-gray-500">Upload Photo or drag here</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
        </div>
      )}
    </div>
  );

  const referencePhotosGrid = (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {referencePhotos.map((img, i) => (
        <div key={i} className="relative aspect-square">
          <input type="file" accept="image/*" className="hidden"
            ref={el => { refPhotoRefs.current[i] = el; }}
            onChange={e => handleRefPhoto(i, e)} />
          {img ? (
            <div className="w-full h-full rounded-xl overflow-hidden cursor-pointer group relative" onClick={() => refPhotoRefs.current[i]?.click()}>
              <img src={img} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                <span className="text-white text-xs font-medium">Change</span>
              </div>
            </div>
          ) : (
            <div onClick={() => refPhotoRefs.current[i]?.click()} className="w-full h-full border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-blue-50/30 transition-colors group">
              <svg className="w-7 h-7 text-gray-300 group-hover:text-[var(--color-primary)]/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs text-gray-400 mt-1.5 group-hover:text-[var(--color-primary)]/60">Add photo</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ── Loading ──
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

  // ── EDITING MODE: single scrollable page ──
  if (isEditing) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-[700px] mx-auto px-6 pt-12 pb-36">
          <div className="text-center mb-14">
            <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Tell us about your hair</h1>
            <p className="text-gray-500">Help us match you with the perfect pro</p>
          </div>

          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{submitError}</div>
          )}

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Basic Info</h2>
            <div className="space-y-4">
              <div id="firstName">
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Enter your first name" value={form.firstName}
                  onChange={e => updateField("firstName", e.target.value)}
                  className={`input-field ${errors.firstName ? "border-[#EF4444]" : ""}`} />
                {errors.firstName && <p className="text-xs text-[#EF4444] mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" placeholder="Enter your last name" value={form.lastName}
                  onChange={e => updateField("lastName", e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender <span className="text-gray-400 font-normal">(optional)</span></label>
                <CustomSelect value={form.gender} onChange={v => updateField("gender", v)} options={GENDER_OPTIONS} placeholder="Select gender..." />
              </div>
              {profilePhotoUpload}
            </div>
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Reference Photos <span className="text-gray-400 font-normal text-base">(Optional)</span></h2>
            <p className="text-sm text-gray-500 mb-5">Upload example photos of the style you want to share with your barber.</p>
            {referencePhotosGrid}
            <p className="text-xs text-gray-400 mt-3">PNG, JPG · Max 5MB per photo</p>
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Your Hair Profile <span className="text-[#EF4444] font-bold">*</span></h2>
            <div className="space-y-4">
              <div id="hairType">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hair Type <span className="text-[#EF4444]">*</span></label>
                <CustomSelect value={form.hairType} onChange={v => updateField("hairType", v)} options={HAIR_TYPE_OPTIONS} placeholder="Select your hair type..." error={!!errors.hairType} />
                {errors.hairType && <p className="text-xs text-[#EF4444] mt-1">{errors.hairType}</p>}
              </div>
              {subtypeOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hair Subtype <span className="text-gray-400 font-normal">(optional)</span></label>
                  <CustomSelect value={form.hairSubtype} onChange={v => updateField("hairSubtype", v)} options={subtypeOptions} placeholder={`Select subtype (e.g., ${subtypeOptions[0]?.value})...`} />
                </div>
              )}
              <div id="hairTexture">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hair Texture <span className="text-[#EF4444]">*</span></label>
                <CustomSelect value={form.hairTexture} onChange={v => updateField("hairTexture", v)} options={HAIR_TEXTURE_OPTIONS} placeholder="Select your hair texture..." error={!!errors.hairTexture} />
                {errors.hairTexture && <p className="text-xs text-[#EF4444] mt-1">{errors.hairTexture}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Hair Color</label>
                <CustomSelect value={form.hairColor} onChange={v => updateField("hairColor", v)} options={HAIR_COLOR_OPTIONS} placeholder="Select your hair color..." />
              </div>
            </div>
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Style Preferences</h2>
            <p className="text-sm text-gray-500 mb-5">What styles are you interested in? (Select all that apply)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 md:gap-x-4 gap-y-1">
              {visibleStyles.map(style => (
                <label key={style} className="flex items-center gap-2.5 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={form.stylePrefs.includes(style)} onChange={() => toggleArray("stylePrefs", style)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] accent-[var(--color-primary)] cursor-pointer" />
                  <span className="text-sm text-gray-700">{style}</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setShowMoreStyles(!showMoreStyles)} className="mt-3 text-sm text-[var(--color-primary)] font-medium hover:underline">
              {showMoreStyles ? "− Show Less" : "+ Show More"}
            </button>
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Hair Concerns <span className="text-gray-400 font-normal text-base">(Optional)</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 md:gap-x-4 gap-y-1 mt-4">
              {HAIR_CONCERNS.map(concern => (
                <label key={concern} className="flex items-center gap-2.5 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={form.concerns.includes(concern)} onChange={() => toggleArray("concerns", concern)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] accent-[var(--color-primary)] cursor-pointer" />
                  <span className="text-sm text-gray-700">{concern}</span>
                </label>
              ))}
            </div>
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Additional Notes <span className="text-gray-400 font-normal text-base">(Optional)</span></h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">Anything else your barber should know?</label>
            <div className="relative">
              <textarea placeholder="e.g., I prefer shorter fades, sensitive scalp, growing out my hair..."
                value={form.notes} onChange={e => { if (e.target.value.length <= 500) updateField("notes", e.target.value); }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
                style={{ height: "120px" }} />
              <span className="absolute bottom-2.5 right-3 text-xs text-gray-400">{form.notes.length} / 500</span>
            </div>
          </section>

          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="btn-primary w-full flex items-center justify-center gap-2" style={{ height: "52px", fontSize: "16px" }}>
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  // ── SIGNUP MODE: 5-step flow ──
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Progress bar */}
      <div className="sticky top-[68px] left-0 right-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[700px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-xs font-semibold text-[var(--color-primary)]">{STEP_TITLES[step - 1]}</span>
          </div>
          <div className="flex gap-1">
            {STEP_TITLES.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < step ? "bg-[var(--color-primary)]" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-6 pt-10 pb-24">
        {submitError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{submitError}</div>
        )}

        {/* Step 1: Create Account */}
        {step === 1 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Create your account</h1>
              <p className="text-gray-500">Choose a username and password to get started</p>
            </div>
            <div className="space-y-4">
              <div id="username">
                <label className="block text-sm font-medium text-gray-700 mb-2">Username <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="e.g., alex_hair" value={username}
                  onChange={e => { setUsername(e.target.value); if (errors.username) setErrors(p => ({ ...p, username: "" })); }}
                  className={`input-field ${errors.username ? "border-[#EF4444]" : ""}`} />
                {errors.username && <p className="text-xs text-[#EF4444] mt-1">{errors.username}</p>}
              </div>
              <div id="password">
                <label className="block text-sm font-medium text-gray-700 mb-2">Password <span className="text-[#EF4444]">*</span></label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} placeholder="At least 6 characters" value={password}
                    onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: "" })); }}
                    className={`input-field pr-11 ${errors.password ? "border-[#EF4444]" : ""}`} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    }
                  </button>
                </div>
                {errors.password && <p className="text-xs text-[#EF4444] mt-1">{errors.password}</p>}
              </div>
              <div id="confirmPassword">
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password <span className="text-[#EF4444]">*</span></label>
                <div className="relative">
                  <input type={showConfirm ? "text" : "password"} placeholder="Repeat your password" value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(p => ({ ...p, confirmPassword: "" })); }}
                    className={`input-field pr-11 ${errors.confirmPassword ? "border-[#EF4444]" : ""}`} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showConfirm ? "Hide password" : "Show password"}>
                    {showConfirm
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    }
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-[#EF4444] mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: About You */}
        {step === 2 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">About You</h1>
              <p className="text-gray-500">Tell us a little about yourself</p>
            </div>
            <div className="space-y-4">
              <div id="firstName">
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Enter your first name" value={form.firstName}
                  onChange={e => updateField("firstName", e.target.value)}
                  className={`input-field ${errors.firstName ? "border-[#EF4444]" : ""}`} />
                {errors.firstName && <p className="text-xs text-[#EF4444] mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" placeholder="Enter your last name" value={form.lastName}
                  onChange={e => updateField("lastName", e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender <span className="text-gray-400 font-normal">(optional)</span></label>
                <CustomSelect value={form.gender} onChange={v => updateField("gender", v)} options={GENDER_OPTIONS} placeholder="Select gender..." />
              </div>
              {profilePhotoUpload}
            </div>
          </div>
        )}

        {/* Step 3: Your Hair */}
        {step === 3 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Your Hair Profile</h1>
              <p className="text-gray-500">Help us match you with the perfect pro</p>
            </div>
            <div className="space-y-4">
              <div id="hairType">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hair Type <span className="text-[#EF4444]">*</span></label>
                <CustomSelect value={form.hairType} onChange={v => updateField("hairType", v)} options={HAIR_TYPE_OPTIONS} placeholder="Select your hair type..." error={!!errors.hairType} />
                {errors.hairType && <p className="text-xs text-[#EF4444] mt-1">{errors.hairType}</p>}
              </div>
              {subtypeOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hair Subtype <span className="text-gray-400 font-normal">(optional)</span></label>
                  <CustomSelect value={form.hairSubtype} onChange={v => updateField("hairSubtype", v)} options={subtypeOptions} placeholder={`Select subtype (e.g., ${subtypeOptions[0]?.value})...`} />
                  <p className="text-xs text-gray-400 mt-1">
                    Not sure?{" "}
                    <a href="https://www.naturallycurly.com/hair-types" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                      Browse hair type charts
                    </a>{" "}
                    to find your exact subtype.
                  </p>
                </div>
              )}
              <div id="hairTexture">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hair Texture <span className="text-[#EF4444]">*</span></label>
                <CustomSelect value={form.hairTexture} onChange={v => updateField("hairTexture", v)} options={HAIR_TEXTURE_OPTIONS} placeholder="Select your hair texture..." error={!!errors.hairTexture} />
                {errors.hairTexture && <p className="text-xs text-[#EF4444] mt-1">{errors.hairTexture}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Hair Color</label>
                <CustomSelect value={form.hairColor} onChange={v => updateField("hairColor", v)} options={HAIR_COLOR_OPTIONS} placeholder="Select your hair color..." />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Your Preferences */}
        {step === 4 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Your Preferences</h1>
              <p className="text-gray-500">Let pros know what you&rsquo;re looking for</p>
            </div>

            <div className="mb-8">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Style Preferences</h3>
              <p className="text-sm text-gray-500 mb-4">What styles are you interested in? (Select all that apply)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 md:gap-x-4 gap-y-1">
                {visibleStyles.map(style => (
                  <label key={style} className="flex items-center gap-2.5 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={form.stylePrefs.includes(style)} onChange={() => toggleArray("stylePrefs", style)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] accent-[var(--color-primary)] cursor-pointer" />
                    <span className="text-sm text-gray-700">{style}</span>
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => setShowMoreStyles(!showMoreStyles)} className="mt-3 text-sm text-[var(--color-primary)] font-medium hover:underline">
                {showMoreStyles ? "− Show Less" : "+ Show More"}
              </button>
            </div>

            <hr className="border-gray-100 mb-8" />

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Hair Concerns <span className="text-gray-400 font-normal text-sm">(Optional)</span></h3>
              <p className="text-sm text-gray-500 mb-4">Any specific concerns you&rsquo;d like addressed?</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 md:gap-x-4 gap-y-1">
                {HAIR_CONCERNS.map(concern => (
                  <label key={concern} className="flex items-center gap-2.5 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={form.concerns.includes(concern)} onChange={() => toggleArray("concerns", concern)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] accent-[var(--color-primary)] cursor-pointer" />
                    <span className="text-sm text-gray-700">{concern}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Reference Photos & Notes */}
        {step === 5 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Reference Photos</h1>
              <p className="text-gray-500">Upload examples of the look you want to share with your barber</p>
            </div>

            <div className="mb-8">
              <p className="text-sm text-gray-500 mb-4">
                Upload up to 6 example photos of the hair style you want — share these with your barber to get the perfect look.
              </p>
              {referencePhotosGrid}
              <p className="text-xs text-gray-400 mt-3">PNG, JPG · Max 5MB per photo</p>
            </div>

            <hr className="border-gray-100 mb-8" />

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Additional Notes <span className="text-gray-400 font-normal text-sm">(Optional)</span></h3>
              <label className="block text-sm text-gray-500 mb-3">Anything else your barber should know?</label>
              <div className="relative">
                <textarea placeholder="e.g., I prefer shorter fades, sensitive scalp, growing out my hair..."
                  value={form.notes} onChange={e => { if (e.target.value.length <= 500) updateField("notes", e.target.value); }}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
                  style={{ height: "120px" }} />
                <span className="absolute bottom-2.5 right-3 text-xs text-gray-400">{form.notes.length} / 500</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
          {step > 1 ? (
            <button onClick={handleBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          ) : <div />}

          <div className="flex flex-col items-end gap-2">
            {step < TOTAL_STEPS ? (
              <button onClick={handleNext} className="btn-primary px-8" style={{ height: "44px" }}>
                Continue
              </button>
            ) : (
              <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="btn-primary px-8 flex items-center gap-2" style={{ height: "44px" }}>
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : "Create Account"}
              </button>
            )}
            {OPTIONAL_STEPS.has(step) && step < TOTAL_STEPS && (
              <button type="button" onClick={skipStep} className="text-xs text-gray-400 hover:text-[var(--color-primary)] hover:underline transition-colors">
                Skip this step
              </button>
            )}
          </div>
        </div>

        {step === 1 && (
          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-gray-400">
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--color-primary)] font-medium hover:underline">Sign in</Link>
            </p>
            <button type="button"
              onClick={() => { localStorage.setItem("sniply_onboarded", "true"); router.push("/browse"); }}
              className="text-xs text-gray-400 hover:text-gray-500 hover:underline transition-colors">
              Skip profile setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
