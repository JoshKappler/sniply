"use client";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, setCurrentUser, type User } from "@/lib/auth";
import { apiRegisterUser, apiUpdateUser, apiCreateBarber, apiUpdateBarber, apiGetBarber, apiLogin } from "@/lib/api";
import { CustomSelect } from "@/components/CustomSelect";
import Navbar from "@/components/Navbar";

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

const SPECIALTIES = [
  "Fades", "Tapers", "Curls", "Waves", "Braids", "Locs",
  "Twists", "Cornrows", "Color", "Beards", "Natural", "Extensions",
  "Relaxers/Perms", "Edge Styling", "Kids Cuts", "Length Maintenance", "Protective Styles",
];
const HAIR_TYPES = ["Straight", "Wavy", "Curly", "Coily", "Kinky"];
const LANGUAGES = ["English", "Spanish", "French", "Portuguese", "Mandarin", "Hindi", "Arabic"];
const EXPERIENCE_OPTIONS = [
  { value: "Under 1 year", label: "Under 1 year" },
  { value: "1–2 years", label: "1–2 years" },
  { value: "3–5 years", label: "3–5 years" },
  { value: "5–10 years", label: "5–10 years" },
  { value: "10+ years", label: "10+ years" },
];

interface ServiceEntry { name: string; description: string; price: string; duration: string; }
interface CredentialEntry { text: string; fileName?: string; fileData?: string; }

const STEP_TITLES = [
  "Create Account",
  "Basic Info",
  "Portfolio",
  "Business Details",
  "Specialties",
  "Credentials",
];
const TOTAL_STEPS = 6;

// Optional steps — show "Skip this step" link
const OPTIONAL_STEPS = new Set([3, 5, 6]);

export default function ProfessionalProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [existingUser, setExistingUser] = useState<User | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  // Account
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Basic Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Business Details
  const [barberType, setBarberType] = useState<"independent" | "shop" | "">("");
  const [shopName, setShopName] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [experience, setExperience] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  // Specialties
  const [hairTypes, setHairTypes] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [showMoreSpecialties, setShowMoreSpecialties] = useState(false);

  // Services
  const [services, setServices] = useState<ServiceEntry[]>([{ name: "", description: "", price: "", duration: "" }]);

  // Portfolio
  const [portfolioImages, setPortfolioImages] = useState<(string | null)[]>(Array(6).fill(null));
  const portfolioInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Credentials
  const [credentials, setCredentials] = useState<CredentialEntry[]>([]);

  // UI
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const profilePhotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cu = getCurrentUser();
    setExistingUser(cu);
    if (cu?.profileId) {
      apiGetBarber(cu.profileId).then((p) => {
        setExistingId(p.id);
        const nameParts = (p.name ?? "").split(" ");
        setFirstName(nameParts[0] ?? "");
        setLastName(nameParts.slice(1).join(" ") ?? "");
        setBio(p.bio ?? "");
        setBarberType(p.type ?? "");
        setShopName(p.shopName ?? "");
        setFullAddress(p.fullAddress ?? p.location ?? "");
        setExperience(p.experience ?? "");
        setLanguages(p.languages ?? []);
        setHairTypes(p.hairTypes ?? []);
        setSpecialties(p.specialties ?? []);
        if ((p as { credentials?: { text: string }[] }).credentials?.length) setCredentials((p as { credentials: { text: string }[] }).credentials);
        if (p.portfolioImages?.length) {
          const slots: (string | null)[] = Array(Math.max(6, p.portfolioImages.length)).fill(null);
          p.portfolioImages.forEach((img: string, i: number) => { slots[i] = img; });
          setPortfolioImages(slots);
        }
        if (p.services?.length) {
          setServices(p.services.map((s) => ({
            name: s.name ?? "", description: s.description ?? "",
            price: String(s.price ?? ""), duration: String(s.duration ?? ""),
          })));
        }
        if (p.profileImage?.startsWith("data:")) setProfilePhoto(p.profileImage);
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const isEditing = !!existingUser;
  const visibleSpecialties = showMoreSpecialties ? SPECIALTIES : SPECIALTIES.slice(0, 12);

  const toggleArr = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const updateService = (idx: number, field: keyof ServiceEntry, val: string) => {
    setServices(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
    if (errors.services) setErrors(prev => ({ ...prev, services: "" }));
  };
  const addService = () => setServices(prev => [...prev, { name: "", description: "", price: "", duration: "" }]);
  const removeService = (idx: number) => setServices(prev => prev.filter((_, i) => i !== idx));

  const addCredential = () => setCredentials(prev => [...prev, { text: "" }]);
  const updateCredentialText = (idx: number, val: string) =>
    setCredentials(prev => prev.map((c, i) => i === idx ? { ...c, text: val } : c));
  const removeCredential = (idx: number) => setCredentials(prev => prev.filter((_, i) => i !== idx));

  const handleCredentialFile = (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      setCredentials(prev => prev.map((c, i) => i === idx ? { ...c, fileName: file.name, fileData: data } : c));
    };
    reader.readAsDataURL(file);
  };

  const handleProfilePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(await compressImage(file, 300, 0.80));
  };

  const handlePortfolioImage = async (slot: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 800, 0.80);
    setPortfolioImages(prev => { const next = [...prev]; next[slot] = compressed; return next; });
  };

  const addPortfolioSlot = () => setPortfolioImages(prev => [...prev, null]);

  const validateStep = (s: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (s === 1 && !isEditing) {
      if (!username.trim()) errs.username = "Username is required";
      if (!password) errs.password = "Password is required";
      else if (password.length < 6) errs.password = "Password must be at least 6 characters";
      if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    }
    if (s === 2) {
      if (!firstName.trim()) errs.firstName = "First name is required";
      if (!lastName.trim()) errs.lastName = "Last name is required";
    }
    if (s === 4) {
      if (!barberType) errs.barberType = "Please select your work type";
      if (barberType === "shop" && !shopName.trim()) errs.shopName = "Shop name is required";
      if (!fullAddress.trim()) errs.fullAddress = "Location / address is required";
    }
    return errs;
  };

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
      if (!password || password.length < 6) allErrors.password = "Password must be at least 6 characters";
      if (password !== confirmPassword) allErrors.confirmPassword = "Passwords do not match";
    }
    if (!firstName.trim()) allErrors.firstName = "First name is required";
    if (!lastName.trim()) allErrors.lastName = "Last name is required";
    if (!fullAddress.trim()) allErrors.fullAddress = "Location / address is required";
    if (!barberType) allErrors.barberType = "Please select your work type";
    if (barberType === "shop" && !shopName.trim()) allErrors.shopName = "Shop name is required";
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      if (!isEditing && (allErrors.username || allErrors.password || allErrors.confirmPassword)) setStep(1);
      else if (allErrors.firstName || allErrors.lastName) setStep(2);
      else if (allErrors.barberType || allErrors.fullAddress || allErrors.shopName) setStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    try {
      const id = existingId ?? `pro-${Date.now()}`;
      const validServices = services
        .filter(s => s.name.trim() && s.price.trim())
        .map(s => ({ name: s.name.trim(), description: s.description.trim(), price: parseFloat(s.price) || 0, duration: parseInt(s.duration) || 30 }));
      const startingPrice = validServices.length > 0 ? Math.min(...validServices.map(s => s.price)) : 0;
      const filledPortfolio = portfolioImages.filter(Boolean) as string[];

      const profile = {
        id,
        name: `${firstName.trim()} ${lastName.trim()}`,
        username: existingUser?.username ?? username.trim(),
        bio: bio.trim(),
        location: fullAddress.trim(),
        fullAddress: fullAddress.trim(),
        type: barberType as "independent" | "shop",
        shopName: barberType === "shop" ? shopName.trim() : undefined,
        experience: experience || "Under 1 year",
        languages, specialties, hairTypes,
        services: validServices,
        credentials: credentials.filter(c => c.text.trim()).map(c => ({ text: c.text.trim(), fileName: c.fileName, fileData: c.fileData })),
        startingPrice, rating: 0, reviewCount: 0, reviews: [],
        portfolioImages: filledPortfolio,
        heroImage: filledPortfolio[0] ?? "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&h=400&fit=crop",
        profileImage: profilePhoto ?? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
      };

      if (isEditing) {
        await apiUpdateBarber(id, profile);
      } else {
        await apiCreateBarber(profile);
      }

      if (isEditing) {
        const patch = { name: profile.name, profileId: id, avatar: profilePhoto ?? existingUser!.avatar };
        const updated = await apiUpdateUser(existingUser!.id, patch);
        setCurrentUser({ ...existingUser!, ...updated });
      } else {
        try {
          const newUser = await apiRegisterUser({
            id: `user-${Date.now()}`, username: username.trim(), password,
            name: profile.name, role: "pro", profileId: id, avatar: profilePhoto ?? undefined,
          });
          // Establish the server-side session cookie so authenticated API calls work
          await apiLogin(username.trim(), password);
          setCurrentUser(newUser);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Registration failed";
          setErrors({ username: msg });
          setStep(1);
          return;
        }
      }

      localStorage.setItem("sniply_role", "pro");
      localStorage.setItem("sniply_onboarded", "true");
      router.push("/pro/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("storage")) {
        setSubmitError("Storage limit reached. Try using smaller or fewer photos.");
      } else {
        setSubmitError("Something went wrong saving your profile. Please try again.");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shared JSX pieces ──

  const profilePhotoUpload = (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Profile Photo <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
      {profilePhoto ? (
        <div className="relative inline-block">
          <img src={profilePhoto} alt="Profile preview" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
          <button type="button" onClick={() => profilePhotoRef.current?.click()} className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-medium">Change</button>
        </div>
      ) : (
        <div onClick={() => profilePhotoRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-blue-50/30 transition-colors" style={{ height: "140px" }}>
          <svg className="w-9 h-9 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-gray-500">Upload Photo</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
        </div>
      )}
    </div>
  );

  const portfolioGrid = (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {portfolioImages.map((img, i) => (
          <div key={i} className="relative aspect-square">
            <input type="file" accept="image/*" className="hidden"
              ref={el => { portfolioInputRefs.current[i] = el; }}
              onChange={e => handlePortfolioImage(i, e)} />
            {img ? (
              <div className="w-full h-full rounded-xl overflow-hidden cursor-pointer group relative" onClick={() => portfolioInputRefs.current[i]?.click()}>
                <img src={img} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                  <span className="text-white text-xs font-medium">Change</span>
                </div>
              </div>
            ) : (
              <div onClick={() => portfolioInputRefs.current[i]?.click()} className="w-full h-full border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-blue-50/30 transition-colors group">
                <svg className="w-6 h-6 text-gray-300 group-hover:text-[var(--color-primary)]/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs text-gray-400 mt-1">{i < 6 ? `Photo ${i + 1}` : "+"}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addPortfolioSlot} className="mt-4 flex items-center gap-2 text-sm text-[var(--color-primary)] font-medium hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add More Photos
      </button>
      <p className="text-xs text-gray-400 mt-2">PNG, JPG · Max 10MB per photo</p>
    </>
  );

  const businessDetailsForm = (
    <div className="space-y-6">
      <div id="barberType">
        <label className="block text-sm font-medium text-gray-700 mb-3">Work Type <span className="text-[#EF4444]">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          {(["independent", "shop"] as const).map(t => (
            <button key={t} type="button"
              onClick={() => { setBarberType(t); if (errors.barberType) setErrors(p => ({ ...p, barberType: "" })); }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${barberType === t ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-gray-200 hover:border-gray-300"}`}>
              <p className={`font-semibold text-sm ${barberType === t ? "text-[var(--color-primary)]" : "text-gray-700"}`}>
                {t === "independent" ? "Independent Barber / Stylist" : "Shop-based"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {t === "independent" ? "Work independently / mobile" : "Part of a barbershop or salon"}
              </p>
            </button>
          ))}
        </div>
        {errors.barberType && <p className="text-xs text-[#EF4444] mt-1">{errors.barberType}</p>}
      </div>
      {barberType === "shop" && (
        <div id="shopName">
          <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name <span className="text-[#EF4444]">*</span></label>
          <input type="text" placeholder="e.g., Luxe Cuts Studio" value={shopName}
            onChange={e => { setShopName(e.target.value); if (errors.shopName) setErrors(p => ({ ...p, shopName: "" })); }}
            className={`input-field ${errors.shopName ? "border-[#EF4444]" : ""}`} />
          {errors.shopName && <p className="text-xs text-[#EF4444] mt-1">{errors.shopName}</p>}
        </div>
      )}
      <div id="fullAddress">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {barberType === "shop" ? "Shop Address" : "Your Location / Address"} <span className="text-[#EF4444]">*</span>
        </label>
        <input type="text" placeholder="e.g., 432 S Spring St, Los Angeles, CA 90013" value={fullAddress}
          onChange={e => { setFullAddress(e.target.value); if (errors.fullAddress) setErrors(p => ({ ...p, fullAddress: "" })); }}
          className={`input-field ${errors.fullAddress ? "border-[#EF4444]" : ""}`} />
        {errors.fullAddress && <p className="text-xs text-[#EF4444] mt-1">{errors.fullAddress}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
        <CustomSelect value={experience} onChange={setExperience} options={EXPERIENCE_OPTIONS} placeholder="Select experience level..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Languages Spoken</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
          {LANGUAGES.map(lang => (
            <label key={lang} className="flex items-center gap-2.5 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={languages.includes(lang)} onChange={() => toggleArr(languages, setLanguages, lang)} className="w-5 h-5 rounded border-gray-300 accent-[var(--color-primary)] cursor-pointer" />
              <span className="text-sm text-gray-700">{lang}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const specialtiesForm = (
    <>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Hair Types Specialized In</label>
        <div className="flex flex-wrap gap-2">
          {HAIR_TYPES.map(ht => (
            <button key={ht} type="button" onClick={() => toggleArr(hairTypes, setHairTypes, ht)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${hairTypes.includes(ht) ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {ht}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Specialties</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
          {visibleSpecialties.map(s => (
            <label key={s} className="flex items-center gap-2.5 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={specialties.includes(s)} onChange={() => toggleArr(specialties, setSpecialties, s)} className="w-5 h-5 rounded border-gray-300 accent-[var(--color-primary)] cursor-pointer" />
              <span className="text-sm text-gray-700">{s}</span>
            </label>
          ))}
        </div>
        <button type="button" onClick={() => setShowMoreSpecialties(!showMoreSpecialties)} className="mt-3 text-sm text-[var(--color-primary)] font-medium hover:underline">
          {showMoreSpecialties ? "− Show Less" : "+ Show More"}
        </button>
      </div>
    </>
  );

  const servicesForm = (
    <>
      <div id="services" className="space-y-4">
        {services.map((svc, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4 relative bg-gray-50/50">
            {services.length > 1 && (
              <button type="button" onClick={() => removeService(idx)} className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-500 text-sm transition-colors">×</button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="e.g., Fade & Lineup" value={svc.name} onChange={e => updateService(idx, "name", e.target.value)} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                <input type="text" placeholder="Brief description" value={svc.description} onChange={e => updateService(idx, "description", e.target.value)} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price ($) <span className="text-[#EF4444]">*</span></label>
                <input type="number" min="0" placeholder="45" value={svc.price} onChange={e => updateService(idx, "price", e.target.value)} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input type="number" min="0" placeholder="30" value={svc.duration} onChange={e => updateService(idx, "duration", e.target.value)} className="input-field text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {errors.services && <p className="text-xs text-[#EF4444] mt-2">{errors.services}</p>}
      <button type="button" onClick={addService} className="mt-4 flex items-center gap-2 text-sm text-[var(--color-primary)] font-medium hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Service
      </button>
    </>
  );

  const credentialsForm = (
    <>
      <div className="space-y-4">
        {credentials.map((cred, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
            <div className="flex items-start gap-2 mb-3">
              <input type="text" placeholder="e.g., State Cosmetology License, Barbering Certificate"
                value={cred.text} onChange={e => updateCredentialText(idx, e.target.value)} className="input-field flex-1 text-sm" />
              <button type="button" onClick={() => removeCredential(idx)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-500 text-sm transition-colors shrink-0 mt-0.5">×</button>
            </div>
            <div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" id={`cred-file-${idx}`} onChange={e => handleCredentialFile(idx, e)} />
              {cred.fileName ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate">{cred.fileName}</span>
                  <button type="button" onClick={() => setCredentials(prev => prev.map((c, i) => i === idx ? { ...c, fileName: undefined, fileData: undefined } : c))} className="ml-auto text-gray-400 hover:text-red-500 shrink-0">×</button>
                </div>
              ) : (
                <label htmlFor={`cred-file-${idx}`} className="flex items-center gap-2 text-sm text-[var(--color-primary)] cursor-pointer hover:underline">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attach document (PDF, JPG, PNG)
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addCredential} className="mt-4 flex items-center gap-2 text-sm text-[var(--color-primary)] font-medium hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Credential
      </button>
    </>
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
            <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Edit your profile</h1>
            <p className="text-gray-500">Tell clients who you are and what you offer</p>
          </div>
          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{submitError}</div>
          )}

          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Basic Info</h2>
            <div className="space-y-4">
              <div id="firstName">
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Enter your first name" value={firstName}
                  onChange={e => { setFirstName(e.target.value); if (errors.firstName) setErrors(p => ({ ...p, firstName: "" })); }}
                  className={`input-field ${errors.firstName ? "border-[#EF4444]" : ""}`} />
                {errors.firstName && <p className="text-xs text-[#EF4444] mt-1">{errors.firstName}</p>}
              </div>
              <div id="lastName">
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Enter your last name" value={lastName}
                  onChange={e => { setLastName(e.target.value); if (errors.lastName) setErrors(p => ({ ...p, lastName: "" })); }}
                  className={`input-field ${errors.lastName ? "border-[#EF4444]" : ""}`} />
                {errors.lastName && <p className="text-xs text-[#EF4444] mt-1">{errors.lastName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender <span className="text-gray-400 font-normal">(optional)</span></label>
                <CustomSelect value={gender} onChange={setGender}
                  options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "prefer_not", label: "Prefer not to say" }]}
                  placeholder="Select gender..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <textarea placeholder="e.g., Precision fades and natural hair specialist with 8 years of experience..."
                    value={bio} onChange={e => { if (e.target.value.length <= 300) setBio(e.target.value); }}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
                    style={{ height: "100px" }} />
                  <span className="absolute bottom-2.5 right-3 text-xs text-gray-400">{bio.length} / 300</span>
                </div>
              </div>
              {profilePhotoUpload}
            </div>
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Portfolio <span className="text-gray-400 font-normal text-base">(Optional)</span></h2>
            <p className="text-sm text-gray-500 mb-5">Upload photos of your work — clients browse these before booking.</p>
            {portfolioGrid}
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Business Details</h2>
            {businessDetailsForm}
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Specialties</h2>
            <p className="text-sm text-gray-500 mb-5">What types of hair do you work with, and what are your specialties?</p>
            {specialtiesForm}
          </section>

          <hr className="border-gray-100 mb-10" />
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Credentials <span className="text-gray-400 font-normal text-base">(Optional)</span></h2>
            <p className="text-sm text-gray-500 mb-5">List certifications or licenses and attach supporting documents</p>
            {credentialsForm}
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

  // ── SIGNUP MODE: 7-step flow ──
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Progress bar */}
      <div className="fixed top-[72px] left-0 right-0 z-40 bg-white border-b border-gray-100">
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

      <div className="max-w-[700px] mx-auto px-6 pt-[140px] pb-24">
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
                <input type="text" placeholder="e.g., johnstylist" value={username}
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

        {/* Step 2: Basic Info */}
        {step === 2 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Basic Info</h1>
              <p className="text-gray-500">Tell us a little about yourself</p>
            </div>
            <div className="space-y-4">
              <div id="firstName">
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Enter your first name" value={firstName}
                  onChange={e => { setFirstName(e.target.value); if (errors.firstName) setErrors(p => ({ ...p, firstName: "" })); }}
                  className={`input-field ${errors.firstName ? "border-[#EF4444]" : ""}`} />
                {errors.firstName && <p className="text-xs text-[#EF4444] mt-1">{errors.firstName}</p>}
              </div>
              <div id="lastName">
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Enter your last name" value={lastName}
                  onChange={e => { setLastName(e.target.value); if (errors.lastName) setErrors(p => ({ ...p, lastName: "" })); }}
                  className={`input-field ${errors.lastName ? "border-[#EF4444]" : ""}`} />
                {errors.lastName && <p className="text-xs text-[#EF4444] mt-1">{errors.lastName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender <span className="text-gray-400 font-normal">(optional)</span></label>
                <CustomSelect value={gender} onChange={setGender}
                  options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "prefer_not", label: "Prefer not to say" }]}
                  placeholder="Select gender..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <textarea placeholder="e.g., Precision fades and natural hair specialist with 8 years of experience..."
                    value={bio} onChange={e => { if (e.target.value.length <= 300) setBio(e.target.value); }}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
                    style={{ height: "100px" }} />
                  <span className="absolute bottom-2.5 right-3 text-xs text-gray-400">{bio.length} / 300</span>
                </div>
              </div>
              {profilePhotoUpload}
            </div>
          </div>
        )}

        {/* Step 3: Portfolio */}
        {step === 3 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Your Portfolio</h1>
              <p className="text-gray-500">Upload photos of your work — clients browse these before booking</p>
            </div>
            {portfolioGrid}
          </div>
        )}

        {/* Step 4: Business Details */}
        {step === 4 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Business Details</h1>
              <p className="text-gray-500">Tell clients where you work and your experience</p>
            </div>
            {businessDetailsForm}
          </div>
        )}

        {/* Step 5: Specialties */}
        {step === 5 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Your Specialties</h1>
              <p className="text-gray-500">What types of hair do you work with, and what are your specialties?</p>
            </div>
            {specialtiesForm}
          </div>
        )}

        {/* Step 6: Credentials */}
        {step === 6 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-heading font-bold text-gray-900 text-3xl mb-2">Credentials</h1>
              <p className="text-gray-500">Optionally list certifications or licenses to build client trust</p>
            </div>
            {credentialsForm}
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
                ) : "Create Profile"}
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
              onClick={() => { localStorage.setItem("sniply_onboarded", "true"); localStorage.setItem("sniply_role", "pro"); router.push("/pro/dashboard"); }}
              className="text-xs text-gray-400 hover:text-gray-500 hover:underline transition-colors">
              Skip profile setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
