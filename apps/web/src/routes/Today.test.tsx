// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SetAsideEntry } from "@kwartaal/core";
import { PinnedSplitsBanner } from "./Today";

function pendingEntry(i: number): SetAsideEntry {
  return {
    id: `sae_${i}`,
    orgId: "org_test",
    invoiceRef: `INV-${i}`,
    totalCents: 100000,
    vatCents: 10000,
    reserveCents: 10000,
    rateBps: 3000,
    status: "pending",
  };
}

describe("PinnedSplitsBanner", () => {
  it("renders nothing when there are no pending entries", () => {
    const { container } = render(<PinnedSplitsBanner entries={[]} onConfirm={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows every entry up to the cap with no overflow link", () => {
    const entries = [pendingEntry(1), pendingEntry(2), pendingEntry(3)];
    render(<PinnedSplitsBanner entries={entries} onConfirm={vi.fn()} />);
    expect(screen.getByText(/INV-1/)).toBeInTheDocument();
    expect(screen.getByText(/INV-3/)).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it("caps rendering at 3 and reveals the rest only after the overflow link is clicked", () => {
    const entries = [1, 2, 3, 4, 5].map(pendingEntry);
    render(<PinnedSplitsBanner entries={entries} onConfirm={vi.fn()} />);

    expect(screen.getByText(/INV-1/)).toBeInTheDocument();
    expect(screen.getByText(/INV-3/)).toBeInTheDocument();
    expect(screen.queryByText(/INV-4/)).not.toBeInTheDocument();
    expect(screen.queryByText(/INV-5/)).not.toBeInTheDocument();
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/\+2 more/));

    expect(screen.getByText(/INV-4/)).toBeInTheDocument();
    expect(screen.getByText(/INV-5/)).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });
});
