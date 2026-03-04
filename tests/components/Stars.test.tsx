// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stars } from "@/components/Stars";

describe("Stars", () => {
  it("renders exactly 5 star elements", () => {
    const { container } = render(<Stars rating={4} />);
    // Each star is a span with ★ text
    const allStars = container.querySelectorAll("span > span");
    // There should be at least 5 outer star spans + 5 inner fill spans = 10
    // The outer container has 5 children, each with a child fill span
    const outerStars = container.querySelector(".inline-flex")?.children;
    expect(outerStars).toHaveLength(5);
  });

  it("renders full fill for rating 5", () => {
    const { container } = render(<Stars rating={5} />);
    const fillSpans = container.querySelectorAll("span.absolute.overflow-hidden");
    // All 5 fill spans should have width 100%
    fillSpans.forEach((span) => {
      expect((span as HTMLElement).style.width).toBe("100%");
    });
  });

  it("renders zero fill for rating 0", () => {
    const { container } = render(<Stars rating={0} />);
    const fillSpans = container.querySelectorAll("span.absolute.overflow-hidden");
    fillSpans.forEach((span) => {
      expect((span as HTMLElement).style.width).toBe("0%");
    });
  });

  it("renders partial fill for rating 3.5", () => {
    const { container } = render(<Stars rating={3.5} />);
    const fillSpans = Array.from(container.querySelectorAll("span.absolute.overflow-hidden")) as HTMLElement[];
    // Stars 1-3 should be 100%, star 4 should be 50%, star 5 should be 0%
    expect(fillSpans[0].style.width).toBe("100%");
    expect(fillSpans[1].style.width).toBe("100%");
    expect(fillSpans[2].style.width).toBe("100%");
    expect(fillSpans[3].style.width).toBe("50%");
    expect(fillSpans[4].style.width).toBe("0%");
  });

  it("applies sm font size when size=sm", () => {
    const { container } = render(<Stars rating={4} size="sm" />);
    const outerStars = container.querySelector(".inline-flex")?.children[0] as HTMLElement;
    expect(outerStars.style.fontSize).toBe("0.9rem");
  });

  it("applies lg font size when size=lg", () => {
    const { container } = render(<Stars rating={4} size="lg" />);
    const outerStars = container.querySelector(".inline-flex")?.children[0] as HTMLElement;
    expect(outerStars.style.fontSize).toBe("1.3rem");
  });
});
