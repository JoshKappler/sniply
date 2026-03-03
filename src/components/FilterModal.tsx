"use client";
import { useState, useEffect } from "react";

interface FilterModalProps {
  onClose: () => void;
  onApply: (filters: Record<string, string[]>) => void;
  initialFilters: Record<string, string[]>;
}

// These values exactly match what's stored in barber data / pro setup form
const SPECIALTIES = [
  "Fades", "Tapers", "Curls", "Waves", "Braids", "Locs",
  "Twists", "Cornrows", "Color", "Beards", "Natural",
  "Extensions", "Relaxers/Perms", "Edge Styling", "Kids Cuts",
  "Length Maintenance", "Protective Styles",
];

// Match barber hairTypes values exactly (no "Type X" suffixes)
const HAIR_TYPES = ["Straight", "Wavy", "Curly", "Coily", "Kinky"];

const PRICE_RANGES = ["Under $30", "$30–$60", "$60–$100", "$100+"];
const RATINGS = ["4+ stars", "4.5+ stars", "5 stars only"];
const LANGUAGES = ["English", "Spanish", "French", "Portuguese", "Mandarin", "Hindi", "Arabic"];

export default function FilterModal({ onClose, onApply, initialFilters }: FilterModalProps) {
  const [filters, setFilters] = useState<Record<string, string[]>>(initialFilters);
  // All sections start collapsed when the modal opens
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    profileType: false,
    specialty: false,
    hairType: false,
    price: false,
    rating: false,
    languages: false,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleCheck = (group: string, value: string) =>
    setFilters((prev) => {
      const arr = prev[group] || [];
      return {
        ...prev,
        [group]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });

  // Radio: clicking the same value again clears it (acts as deselect)
  const setRadio = (group: string, value: string) =>
    setFilters((prev) => ({
      ...prev,
      [group]: (prev[group] || [])[0] === value ? [] : [value],
    }));

  const clearAll = () => setFilters({});

  const filterCount = Object.values(filters).flat().length;

  const CheckRow = ({ group, value }: { group: string; value: string }) => (
    <label className="flex items-center gap-3 py-2 px-1 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
      <input
        type="checkbox"
        checked={(filters[group] || []).includes(value)}
        onChange={() => toggleCheck(group, value)}
        className="w-4 h-4 rounded border-gray-300 accent-[#2E4A8B] cursor-pointer shrink-0"
      />
      <span className="text-sm text-gray-700">{value}</span>
    </label>
  );

  const RadioRow = ({ group, value }: { group: string; value: string }) => (
    <label className="flex items-center gap-3 py-2 px-1 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
      <input
        type="radio"
        name={group}
        value={value}
        checked={(filters[group] || [])[0] === value}
        onChange={() => setRadio(group, value)}
        onClick={() => {
          // Allow deselecting by clicking selected radio
          if ((filters[group] || [])[0] === value) setRadio(group, value);
        }}
        className="w-4 h-4 border-gray-300 accent-[#2E4A8B] cursor-pointer shrink-0"
      />
      <span className="text-sm text-gray-700">{value}</span>
    </label>
  );

  const SectionHeader = ({ sectionKey, label, count }: { sectionKey: string; label: string; count?: number }) => (
    <button
      onClick={() => toggle(sectionKey)}
      className="w-full flex items-center justify-between py-3.5 border-b border-gray-100"
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-gray-800">{label}</span>
        {count != null && count > 0 && (
          <span className="text-xs font-bold bg-[#2E4A8B] text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {count}
          </span>
        )}
      </div>
      <svg
        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded[sectionKey] ? "rotate-180" : ""}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  const getCount = (group: string) => (filters[group] || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full md:w-[460px] bg-white md:rounded-2xl rounded-t-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col max-h-[92vh] md:max-h-[85vh]">
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading font-bold text-gray-900 text-xl">Filters</h2>
            {filterCount > 0 && (
              <span className="text-xs font-bold bg-[#2E4A8B] text-white px-2 py-0.5 rounded-full">
                {filterCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable filter sections */}
        <div className="flex-1 overflow-y-auto px-6">

          {/* Profile Type */}
          <SectionHeader sectionKey="profileType" label="Profile Type" count={getCount("profileType")} />
          {expanded.profileType && (
            <div className="py-2 mb-1">
              <RadioRow group="profileType" value="Independent" />
              <RadioRow group="profileType" value="Shop" />
            </div>
          )}

          {/* Specialty / Service */}
          <SectionHeader sectionKey="specialty" label="Specialty / Service" count={getCount("specialty")} />
          {expanded.specialty && (
            <div className="py-2 mb-1 max-h-52 overflow-y-auto">
              {SPECIALTIES.map((s) => <CheckRow key={s} group="specialty" value={s} />)}
            </div>
          )}

          {/* Hair Type */}
          <SectionHeader sectionKey="hairType" label="Hair Type" count={getCount("hairType")} />
          {expanded.hairType && (
            <div className="py-2 mb-1">
              {HAIR_TYPES.map((ht) => <CheckRow key={ht} group="hairType" value={ht} />)}
            </div>
          )}

          {/* Price Range */}
          <SectionHeader sectionKey="price" label="Price Range" count={getCount("price")} />
          {expanded.price && (
            <div className="py-2 mb-1">
              {PRICE_RANGES.map((p) => <RadioRow key={p} group="price" value={p} />)}
            </div>
          )}

          {/* Rating */}
          <SectionHeader sectionKey="rating" label="Rating" count={getCount("rating")} />
          {expanded.rating && (
            <div className="py-2 mb-1">
              {RATINGS.map((r) => <RadioRow key={r} group="rating" value={r} />)}
            </div>
          )}

          {/* Languages */}
          <SectionHeader sectionKey="languages" label="Languages" count={getCount("languages")} />
          {expanded.languages && (
            <div className="py-2 pb-4">
              {LANGUAGES.map((l) => <CheckRow key={l} group="languages" value={l} />)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex gap-3 rounded-b-2xl">
          <button
            onClick={clearAll}
            className="btn-secondary flex-1"
            style={{ height: "48px" }}
          >
            Clear All
          </button>
          <button
            onClick={() => onApply(filters)}
            className="btn-primary flex-[2]"
            style={{ height: "48px" }}
          >
            Apply Filters
            {filterCount > 0 && ` (${filterCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
