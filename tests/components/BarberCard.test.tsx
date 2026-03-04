// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link and next/image to avoid Next.js router requirement
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import BarberCard from "@/components/BarberCard";

const BASE_PROPS = {
  id: "b1",
  name: "Marcus Johnson",
  rating: 4.8,
  reviewCount: 23,
  location: "Atlanta, GA",
  type: "independent" as const,
  startingPrice: 40,
  specialties: ["Fades", "Tapers", "Curls"],
};

describe("BarberCard", () => {
  it("renders barber name", () => {
    render(<BarberCard {...BASE_PROPS} />);
    expect(screen.getByText("Marcus Johnson")).toBeInTheDocument();
  });

  it("renders rating and review count", () => {
    render(<BarberCard {...BASE_PROPS} />);
    expect(screen.getByText(/4\.8/)).toBeInTheDocument();
    expect(screen.getByText(/23/)).toBeInTheDocument();
  });

  it("renders location", () => {
    render(<BarberCard {...BASE_PROPS} />);
    expect(screen.getByText("Atlanta, GA")).toBeInTheDocument();
  });

  it("renders starting price", () => {
    render(<BarberCard {...BASE_PROPS} />);
    expect(screen.getByText("From $40")).toBeInTheDocument();
  });

  it("renders specialties (up to 3)", () => {
    render(<BarberCard {...BASE_PROPS} />);
    // Specialties are hidden on mobile but visible on sm+; they still exist in DOM
    expect(screen.getByText("Fades")).toBeInTheDocument();
    expect(screen.getByText("Tapers")).toBeInTheDocument();
    expect(screen.getByText("Curls")).toBeInTheDocument();
  });

  it("renders match percent badge when provided", () => {
    render(<BarberCard {...BASE_PROPS} matchPercent={85} />);
    expect(screen.getByText("85% match")).toBeInTheDocument();
  });

  it("does not render match badge when matchPercent is undefined", () => {
    render(<BarberCard {...BASE_PROPS} />);
    expect(screen.queryByText(/% match/)).not.toBeInTheDocument();
  });

  it("renders 'New' badge when isNew is true", () => {
    render(<BarberCard {...BASE_PROPS} isNew />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders next available label when provided", () => {
    render(<BarberCard {...BASE_PROPS} nextAvailable="Today 9:00 AM" />);
    expect(screen.getByText("Today 9:00 AM")).toBeInTheDocument();
  });

  it("renders hero image when heroImage is provided", () => {
    render(<BarberCard {...BASE_PROPS} heroImage="https://example.com/hero.jpg" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/hero.jpg");
    expect(img).toHaveAttribute("alt", "Marcus Johnson's portfolio");
  });

  it("links to correct barber profile URL", () => {
    render(<BarberCard {...BASE_PROPS} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/barber/b1");
  });

  it("renders distance when provided", () => {
    render(<BarberCard {...BASE_PROPS} distance={3.752} />);
    expect(screen.getByText(/3\.8 mi/)).toBeInTheDocument();
  });
});
