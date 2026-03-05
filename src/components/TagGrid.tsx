"use client";

interface TagGridProps {
  items: string[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function TagGrid({ items, value, onChange }: TagGridProps) {
  const toggle = (item: string) => {
    onChange(
      value.includes(item) ? value.filter((v) => v !== item) : [...value, item]
    );
  };

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
      {items.map((item) => {
        const selected = value.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] leading-snug ${
              selected
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)] shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
