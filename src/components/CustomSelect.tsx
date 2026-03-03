"use client";
import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  error?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  error = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const spaceBelow = rect ? vh - rect.bottom : 300;
  const above = spaceBelow < 240 && rect ? rect.top > 240 : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`select-field text-left flex items-center justify-between gap-2 ${error ? "border-[#EF4444] focus:border-[#EF4444]" : ""}`}
      >
        <span className={`truncate ${!value ? "text-gray-400" : "text-gray-900"}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && rect && (
        <div
          className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl overflow-y-auto"
          style={{
            top: above ? undefined : rect.bottom + 4,
            bottom: above ? vh - rect.top + 4 : undefined,
            left: rect.left,
            width: rect.width,
            maxHeight: "220px",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-sm border-b last:border-b-0 border-gray-50 transition-colors hover:bg-gray-50 ${
                value === opt.value
                  ? "font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
