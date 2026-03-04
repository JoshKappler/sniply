// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterModal from "@/components/FilterModal";

const DEFAULT_PROPS = {
  onClose: vi.fn(),
  onApply: vi.fn(),
  initialFilters: {},
};

describe("FilterModal", () => {
  it("renders the filter modal with specialty section open", () => {
    render(<FilterModal {...DEFAULT_PROPS} />);
    // "Specialty" section is expanded by default — should show specialty options
    expect(screen.getByText("Fades")).toBeInTheDocument();
    expect(screen.getByText("Tapers")).toBeInTheDocument();
  });

  it("renders the Clear All and Apply Filters buttons", () => {
    render(<FilterModal {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply filters/i })).toBeInTheDocument();
  });

  it("selecting a specialty checks the checkbox", async () => {
    render(<FilterModal {...DEFAULT_PROPS} />);
    const fadesCheckbox = screen.getByRole("checkbox", { name: "Fades" });
    expect(fadesCheckbox).not.toBeChecked();
    await userEvent.click(fadesCheckbox);
    expect(fadesCheckbox).toBeChecked();
  });

  it("clicking Apply Filters calls onApply with current filters", async () => {
    const onApply = vi.fn();
    render(<FilterModal {...DEFAULT_PROPS} onApply={onApply} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Fades" }));
    await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ specialty: expect.arrayContaining(["Fades"]) })
    );
  });

  it("clicking Clear All resets local state so Apply sends empty filters", async () => {
    const onApply = vi.fn();
    render(<FilterModal {...DEFAULT_PROPS} onApply={onApply} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Fades" }));
    await userEvent.click(screen.getByRole("button", { name: /clear all/i }));
    // After clearing, the checkbox should be unchecked
    expect(screen.getByRole("checkbox", { name: "Fades" })).not.toBeChecked();
    // Applying now should send empty filters
    await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
    expect(onApply).toHaveBeenCalledWith({});
  });

  it("initializes with pre-set filters checked", () => {
    render(
      <FilterModal
        {...DEFAULT_PROPS}
        initialFilters={{ specialty: ["Fades", "Braids"] }}
      />
    );
    expect(screen.getByRole("checkbox", { name: "Fades" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Braids" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Tapers" })).not.toBeChecked();
  });

  it("calls onClose when Escape key is pressed", async () => {
    const onClose = vi.fn();
    render(<FilterModal {...DEFAULT_PROPS} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
