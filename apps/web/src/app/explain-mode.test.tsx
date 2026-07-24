// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExplainModeProvider, useExplainMode } from "./explain-mode-context";
import { ExplainNote } from "../components/ExplainNote";

function Toggle() {
  const { enabled, setEnabled } = useExplainMode();
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => void setEnabled(!enabled)}
    >
      toggle
    </button>
  );
}

function Scene({ enabledFromServer }: { enabledFromServer: boolean | undefined }) {
  return (
    <ExplainModeProvider enabledFromServer={enabledFromServer}>
      <Toggle />
      <ExplainNote>A note about this screen.</ExplainNote>
    </ExplainModeProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Explain mode — app-wide toggle", () => {
  it("defaults to enabled (the note is visible) before the server value arrives", () => {
    render(<Scene enabledFromServer={undefined} />);
    expect(screen.getByText(/A note about this screen/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("syncs to false once the real server value arrives", async () => {
    const { rerender } = render(<Scene enabledFromServer={undefined} />);
    rerender(<Scene enabledFromServer={false} />);
    await waitFor(() =>
      expect(screen.queryByText(/A note about this screen/)).not.toBeInTheDocument(),
    );
  });

  it("toggling off removes the note immediately, app-wide, and calls the real endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Scene enabledFromServer={true} />);
    expect(screen.getByText(/A note about this screen/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(screen.queryByText(/A note about this screen/)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/orgs/me/explain-mode"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
    );
  });

  it("toggling back on restores the note", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    render(<Scene enabledFromServer={false} />);
    expect(screen.queryByText(/A note about this screen/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(screen.getByText(/A note about this screen/)).toBeInTheDocument(),
    );
  });

  it("outside a provider, useExplainMode defaults to disabled and never throws", () => {
    render(<ExplainNote>Should not render.</ExplainNote>);
    expect(screen.queryByText("Should not render.")).not.toBeInTheDocument();
  });
});
