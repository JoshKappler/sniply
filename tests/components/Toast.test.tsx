// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/Toast";

// Helper component to trigger toasts
function ToastTrigger({ type }: { type?: "success" | "error" | "info" }) {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast("Test message", type ?? "success")}>
      Show Toast
    </button>
  );
}

function renderWithProvider(type?: "success" | "error" | "info") {
  return render(
    <ToastProvider>
      <ToastTrigger type={type} />
    </ToastProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider / useToast", () => {
  it("shows a success toast with the message text", async () => {
    renderWithProvider("success");
    await userEvent.click(screen.getByRole("button", { name: "Show Toast" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("shows an error toast with red border styling", async () => {
    renderWithProvider("error");
    await userEvent.click(screen.getByRole("button", { name: "Show Toast" }));
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.className).toContain("border-red-200");
  });

  it("shows an info toast with primary border styling", async () => {
    renderWithProvider("info");
    await userEvent.click(screen.getByRole("button", { name: "Show Toast" }));
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-[var(--color-primary)]");
  });

  it("dismisses toast automatically after 3500ms", async () => {
    vi.useFakeTimers();
    renderWithProvider("success");

    // Click the button (use real event dispatch since fake timers are set)
    act(() => {
      screen.getByRole("button", { name: "Show Toast" }).click();
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(3600); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("dismisses toast when dismiss button is clicked", async () => {
    renderWithProvider("info");
    await userEvent.click(screen.getByRole("button", { name: "Show Toast" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
