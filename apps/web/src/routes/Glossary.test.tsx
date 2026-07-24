// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlossaryTermRow } from "@kwartaal/core";
import { Glossary } from "./Glossary";

const TERMS: GlossaryTermRow[] = [
  {
    slug: "btw",
    nlTerm: "btw",
    enGloss: "VAT",
    plainExplanation: "Dutch value-added tax.",
    whereYoullSeeIt: "Every invoice line.",
    depth: "full",
  },
  {
    slug: "kor",
    nlTerm: "KOR",
    enGloss: "small business scheme",
    plainExplanation: "Opt in and stop charging btw entirely.",
    whereYoullSeeIt: "Onboarding.",
    depth: "full",
  },
];

function mockFetchWith(terms: GlossaryTermRow[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => terms,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Regression coverage for the bug where an empty query showed "No terms
 * match """ instead of the full list — the failure mode is
 * indistinguishable in a screenshot from a genuinely empty glossary
 * (the D-finding gap this test also closes: seeded content must be
 * asserted, not just composition).
 */
describe("Glossary", () => {
  it("shows the full seeded list with no search entered — never the no-match message", async () => {
    mockFetchWith(TERMS);
    render(<Glossary />);

    await waitFor(() => expect(screen.getByText("btw")).toBeInTheDocument());
    expect(screen.getByText("KOR")).toBeInTheDocument();
    expect(screen.queryByText(/No terms match/)).not.toBeInTheDocument();
  });

  it("filters to matching terms as the query narrows", async () => {
    mockFetchWith(TERMS);
    render(<Glossary />);
    await waitFor(() => expect(screen.getByText("btw")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Search glossary"), {
      target: { value: "small business" },
    });

    expect(screen.getByText("KOR")).toBeInTheDocument();
    expect(screen.queryByText("btw")).not.toBeInTheDocument();
    expect(screen.queryByText(/No terms match/)).not.toBeInTheDocument();
  });

  it("shows the no-match message only for a genuinely non-empty query with zero matches", async () => {
    mockFetchWith(TERMS);
    render(<Glossary />);
    await waitFor(() => expect(screen.getByText("btw")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Search glossary"), {
      target: { value: "nonexistent-term-xyz" },
    });

    expect(
      await screen.findByText('No terms match "nonexistent-term-xyz".'),
    ).toBeInTheDocument();

    // Clearing the query back to empty must return to the full list, not
    // linger on the no-match message.
    fireEvent.change(screen.getByLabelText("Search glossary"), { target: { value: "" } });
    expect(screen.queryByText(/No terms match/)).not.toBeInTheDocument();
    expect(screen.getByText("btw")).toBeInTheDocument();
  });
});
