// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermChip } from "./TermChip";

describe("TermChip", () => {
  it("renders the Dutch term and hides the explanation until clicked", () => {
    render(<TermChip nlTerm="btw" definition="Dutch VAT." />);
    expect(screen.getByText("btw")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens the explanation panel on click", () => {
    render(<TermChip nlTerm="btw" definition="Dutch VAT." />);
    fireEvent.click(screen.getByText("btw"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Dutch VAT.");
  });

  it("falls back to a placeholder when no definition is supplied", () => {
    render(<TermChip nlTerm="voorbelasting" />);
    fireEvent.click(screen.getByText("voorbelasting"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("glossary is wired");
  });
});
