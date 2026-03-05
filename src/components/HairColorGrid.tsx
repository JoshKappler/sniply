"use client";

interface HairColorGridProps {
  value: string;
  onChange: (value: string) => void;
}

const HAIR_COLOR_TILES = [
  {
    value: "black",
    label: "Natural / Black",
    swatch: <div className="w-10 h-10 rounded-full" style={{ background: "#1A1A1A" }} />,
  },
  {
    value: "brown",
    label: "Brown",
    swatch: <div className="w-10 h-10 rounded-full" style={{ background: "#6B3F2A" }} />,
  },
  {
    value: "blonde",
    label: "Blonde",
    swatch: <div className="w-10 h-10 rounded-full" style={{ background: "#D4A856" }} />,
  },
  {
    value: "red",
    label: "Red",
    swatch: <div className="w-10 h-10 rounded-full" style={{ background: "#A63A2E" }} />,
  },
  {
    value: "dyed",
    label: "Dyed / Colored",
    swatch: (
      <div
        className="w-10 h-10 rounded-full"
        style={{
          background: "conic-gradient(#e53e3e, #ed8936, #ecc94b, #48bb78, #4299e1, #805ad5, #e53e3e)",
        }}
      />
    ),
  },
  {
    value: "gray",
    label: "Gray / Silver",
    swatch: <div className="w-10 h-10 rounded-full" style={{ background: "#9E9E9E" }} />,
  },
  {
    value: "other",
    label: "Other",
    swatch: (
      <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-lg font-bold">
        ?
      </div>
    ),
  },
];

export function HairColorGrid({ value, onChange }: HairColorGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {HAIR_COLOR_TILES.map((tile) => {
        const selected = value === tile.value;
        return (
          <button
            key={tile.value}
            type="button"
            onClick={() => onChange(tile.value)}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 py-3 px-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
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
            {tile.swatch}
            <span className={`text-[10px] font-semibold text-center leading-tight ${selected ? "text-[var(--color-primary)]" : "text-gray-700"}`}>
              {tile.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
