"use client";

interface HairTextureGridProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

const HAIR_TEXTURE_TILES = [
  {
    value: "fine",
    label: "Fine",
    sublabel: "Lightweight",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <line x1="12" y1="14" x2="88" y2="14" stroke="#9E8A78" strokeWidth="1" strokeLinecap="round"/>
        <line x1="12" y1="22" x2="88" y2="22" stroke="#B5A496" strokeWidth="1" strokeLinecap="round"/>
        <line x1="12" y1="30" x2="88" y2="30" stroke="#9E8A78" strokeWidth="1" strokeLinecap="round"/>
        <line x1="12" y1="38" x2="88" y2="38" stroke="#B5A496" strokeWidth="1" strokeLinecap="round"/>
        <line x1="12" y1="46" x2="88" y2="46" stroke="#9E8A78" strokeWidth="1" strokeLinecap="round"/>
        <line x1="12" y1="54" x2="88" y2="54" stroke="#B5A496" strokeWidth="1" strokeLinecap="round"/>
        <line x1="12" y1="62" x2="88" y2="62" stroke="#9E8A78" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: "medium",
    label: "Medium",
    sublabel: "Balanced",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <line x1="12" y1="16" x2="88" y2="16" stroke="#7A5C46" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="29" x2="88" y2="29" stroke="#9E8A78" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="42" x2="88" y2="42" stroke="#7A5C46" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="55" x2="88" y2="55" stroke="#9E8A78" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: "thick",
    label: "Thick",
    sublabel: "Dense & full",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <line x1="12" y1="18" x2="88" y2="18" stroke="#4B3425" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="12" y1="36" x2="88" y2="36" stroke="#6B4C38" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="12" y1="54" x2="88" y2="54" stroke="#4B3425" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: "unsure",
    label: "Not sure",
    sublabel: "I'll find out",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <text x="50" y="50" textAnchor="middle" fontSize="44" fontWeight="bold" fill="#C4A882" fontFamily="Georgia, serif">?</text>
      </svg>
    ),
  },
];

export function HairTextureGrid({ value, onChange, error }: HairTextureGridProps) {
  return (
    <div className={`grid grid-cols-4 gap-2 ${error ? "p-1 rounded-xl ring-1 ring-[#EF4444]" : ""}`}>
      {HAIR_TEXTURE_TILES.map((tile) => {
        const selected = value === tile.value;
        return (
          <button
            key={tile.value}
            type="button"
            onClick={() => onChange(tile.value)}
            className={`relative flex flex-col items-center rounded-xl border-2 pt-3 pb-2 px-1.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
              selected
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50"
            }`}
          >
            {selected && (
              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                  <path d="M1 3.5L3 5.5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            <div className="w-full" style={{ aspectRatio: "10/7" }}>
              {tile.svg}
            </div>
            <span className={`text-xs font-semibold mt-1.5 text-center leading-tight ${selected ? "text-[var(--color-primary)]" : "text-gray-800"}`}>
              {tile.label}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5">{tile.sublabel}</span>
          </button>
        );
      })}
    </div>
  );
}
