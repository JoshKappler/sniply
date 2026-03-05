"use client";

interface HairTypeGridProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  /** Multi-select mode: if provided, overrides single-select behaviour */
  multiValue?: string[];
  onMultiChange?: (value: string[]) => void;
}

const HAIR_TYPE_TILES = [
  {
    value: "straight",
    label: "Straight",
    sublabel: "Type 1",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M10,12 L90,12" stroke="#4B3425" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M10,24 L90,24" stroke="#7A5C46" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M10,36 L90,36" stroke="#4B3425" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        <path d="M10,48 L90,48" stroke="#7A5C46" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M10,60 L90,60" stroke="#4B3425" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    value: "wavy",
    label: "Wavy",
    sublabel: "Type 2",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M8,12 C18,3 28,21 38,12 C48,3 58,21 68,12 C78,3 90,12 90,12" stroke="#4B3425" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M8,35 C18,26 28,44 38,35 C48,26 58,44 68,35 C78,26 90,35 90,35" stroke="#7A5C46" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M8,58 C18,49 28,67 38,58 C48,49 58,67 68,58 C78,49 90,58 90,58" stroke="#4B3425" strokeWidth="3" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    value: "curly",
    label: "Curly",
    sublabel: "Type 3",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M8,14 C12,5 17,23 22,14 C27,5 32,23 37,14 C42,5 47,23 52,14 C57,5 62,23 67,14 C72,5 77,23 82,14 C87,5 92,13 92,14" stroke="#4B3425" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M8,35 C12,26 17,44 22,35 C27,26 32,44 37,35 C42,26 47,44 52,35 C57,26 62,44 67,35 C72,26 77,44 82,35 C87,26 92,34 92,35" stroke="#7A5C46" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <path d="M8,56 C12,47 17,65 22,56 C27,47 32,65 37,56 C42,47 47,65 52,56 C57,47 62,65 67,56 C72,47 77,65 82,56 C87,47 92,55 92,56" stroke="#4B3425" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    value: "coily",
    label: "Coily",
    sublabel: "Type 4",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M8,14 C10,7 13,21 16,14 C19,7 22,21 25,14 C28,7 31,21 34,14 C37,7 40,21 43,14 C46,7 49,21 52,14 C55,7 58,21 61,14 C64,7 67,21 70,14 C73,7 76,21 79,14 C82,7 85,19 88,14" stroke="#4B3425" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M8,35 C10,28 13,42 16,35 C19,28 22,42 25,35 C28,28 31,42 34,35 C37,28 40,42 43,35 C46,28 49,42 52,35 C55,28 58,42 61,35 C64,28 67,42 70,35 C73,28 76,42 79,35 C82,28 85,40 88,35" stroke="#7A5C46" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <path d="M8,56 C10,49 13,63 16,56 C19,49 22,63 25,56 C28,49 31,63 34,56 C37,49 40,63 43,56 C46,49 49,63 52,56 C55,49 58,63 61,56 C64,49 67,63 70,56 C73,49 76,63 79,56 C82,49 85,61 88,56" stroke="#4B3425" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    value: "kinky",
    label: "Kinky",
    sublabel: "Type 4c",
    svg: (
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M8,14 L16,6 L24,22 L32,6 L40,22 L48,6 L56,22 L64,6 L72,22 L80,6 L88,14" stroke="#4B3425" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M8,35 L16,27 L24,43 L32,27 L40,43 L48,27 L56,43 L64,27 L72,43 L80,27 L88,35" stroke="#7A5C46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M8,56 L16,48 L24,64 L32,48 L40,64 L48,48 L56,64 L64,48 L72,64 L80,48 L88,56" stroke="#4B3425" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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

export function HairTypeGrid({ value, onChange, error, multiValue, onMultiChange }: HairTypeGridProps) {
  const isMulti = multiValue !== undefined && onMultiChange !== undefined;
  return (
    <div className={`grid grid-cols-3 gap-2 ${error ? "p-1 rounded-xl ring-1 ring-[#EF4444]" : ""}`}>
      {HAIR_TYPE_TILES.map((tile) => {
        const selected = isMulti ? multiValue.includes(tile.value) : value === tile.value;
        const handleClick = isMulti
          ? () => onMultiChange(multiValue.includes(tile.value) ? multiValue.filter(v => v !== tile.value) : [...multiValue, tile.value])
          : () => onChange(tile.value);
        return (
          <button
            key={tile.value}
            type="button"
            onClick={handleClick}
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
