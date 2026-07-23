import { describe, expect, it } from "vitest";
import { buildReminderEmail, type ReminderEmailContext } from "./reminder-templates";
import type { ReminderStage } from "@kwartaal/core";

const STAGES: ReminderStage[] = [
  "t14",
  "t7",
  "t2",
  "day",
  "overdue_1",
  "overdue_2",
  "overdue_3",
];

const base: Omit<ReminderEmailContext, "stage"> = {
  deadlineKind: "btw_q",
  dueDate: "2026-10-31",
  quarter: 3,
  appUrl: "https://kwartaal.example",
};

describe("buildReminderEmail", () => {
  it("produces a non-empty subject, html, and text for every stage", () => {
    for (const stage of STAGES) {
      const email = buildReminderEmail({ ...base, stage });
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html.length).toBeGreaterThan(0);
      expect(email.text.length).toBeGreaterThan(0);
    }
  });

  it("names the quarter for btw_q deadlines", () => {
    const email = buildReminderEmail({ ...base, stage: "t14" });
    expect(email.subject).toContain("Q3 btw");
  });

  it("links to the app in every stage", () => {
    for (const stage of STAGES) {
      const email = buildReminderEmail({ ...base, stage });
      expect(email.text).toContain("https://kwartaal.example/app/today");
      expect(email.html).toContain("https://kwartaal.example/app/today");
    }
  });

  it("overdue copy links a recovery action, never a bare warning", () => {
    const email = buildReminderEmail({ ...base, stage: "overdue_1" });
    expect(email.text.toLowerCase()).toMatch(/fix|pick up|checklist/);
  });

  it("never states or implies compliance ('you are compliant')", () => {
    for (const stage of STAGES) {
      const email = buildReminderEmail({ ...base, stage });
      expect(email.text.toLowerCase()).not.toContain("compliant");
      expect(email.html.toLowerCase()).not.toContain("compliant");
    }
  });

  it("names the income tax return and voorlopige aanslag correctly", () => {
    const incomeTax = buildReminderEmail({
      ...base,
      stage: "t14",
      deadlineKind: "income_tax",
      quarter: undefined,
    });
    expect(incomeTax.subject).toContain("income tax return");
    const va = buildReminderEmail({
      ...base,
      stage: "t14",
      deadlineKind: "voorlopige_aanslag",
      quarter: undefined,
    });
    expect(va.subject).toContain("voorlopige aanslag payment");
  });
});
