// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StateSwitcher } from "./StateSwitcher";

describe("StateSwitcher", () => {
  it("renders nothing when there are no groups", () => {
    const { container } = render(<StateSwitcher groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onChange with the selected option's value", () => {
    const onChange = vi.fn();
    render(
      <StateSwitcher
        groups={[
          {
            label: "Hero card",
            value: "due",
            onChange,
            options: [
              { label: "Due soon", value: "due" },
              { label: "Mid-quarter", value: "mid" },
            ],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("Mid-quarter"));
    expect(onChange).toHaveBeenCalledWith("mid");
  });

  it("collapses and expands via the Hide/Show toggle", () => {
    render(
      <StateSwitcher
        groups={[
          {
            label: "Hero card",
            value: "due",
            onChange: () => {},
            options: [{ label: "Due soon", value: "due" }],
          },
        ]}
      />,
    );
    expect(screen.getByText("Due soon")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide"));
    expect(screen.queryByText("Due soon")).not.toBeInTheDocument();
  });
});
