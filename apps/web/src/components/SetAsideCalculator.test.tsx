// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetAsideCalculator } from "./SetAsideCalculator";

describe("SetAsideCalculator", () => {
  it("renders an initial split for the default €2.500,00 @ 21% / 30% reserve", () => {
    render(<SetAsideCalculator />);
    // 250000 * 21/121 = 43388.4... -> 43388
    expect(screen.getByText(/€\s?433,88/)).toBeInTheDocument();
  });

  it("recomputes live when the VAT rate button changes", () => {
    render(<SetAsideCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "0%" }));
    // At 0% VAT, the "Btw" figure should read zero.
    const btwLabel = screen.getByText("Btw");
    const btwValue = btwLabel.nextElementSibling;
    expect(btwValue?.textContent).toMatch(/€\s?0,00/);
  });

  it("recomputes live when the invoice total changes", () => {
    render(<SetAsideCalculator />);
    const input = screen.getByLabelText("Invoice total");
    fireEvent.change(input, { target: { value: "1.000,00" } });
    // 100000 * 21/121 = 17355.37 -> 17355
    expect(screen.getByText(/€\s?173,55/)).toBeInTheDocument();
  });
});
