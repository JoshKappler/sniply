export function StarFill({ pct }: { pct: number }) {
  return (
    <span
      className="relative inline-block leading-none select-none"
      style={{ color: "#D1D5DB", fontSize: "1.1rem" }}
    >
      ★
      <span
        className="absolute top-0 left-0 overflow-hidden leading-none"
        style={{ width: `${pct}%`, color: "var(--color-accent)", whiteSpace: "nowrap" }}
      >
        ★
      </span>
    </span>
  );
}

export function Stars({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const fontSize = size === "sm" ? "0.9rem" : size === "lg" ? "1.3rem" : "1.1rem";
  return (
    <span className="inline-flex items-center gap-px">
      {[1, 2, 3, 4, 5].map((i) => {
        const pct = Math.min(100, Math.max(0, (rating - (i - 1)) * 100));
        return (
          <span
            key={i}
            className="relative inline-block leading-none select-none"
            style={{ color: "#D1D5DB", fontSize }}
          >
            ★
            <span
              className="absolute top-0 left-0 overflow-hidden leading-none"
              style={{ width: `${pct}%`, color: "var(--color-accent)", whiteSpace: "nowrap" }}
            >
              ★
            </span>
          </span>
        );
      })}
    </span>
  );
}
