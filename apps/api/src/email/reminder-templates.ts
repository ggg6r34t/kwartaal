import type { ReminderStage } from "@kwartaal/core";

export interface ReminderEmailContext {
  stage: ReminderStage;
  deadlineKind: "btw_q" | "income_tax" | "voorlopige_aanslag" | "custom";
  dueDate: string; // ISO YYYY-MM-DD
  quarter?: 1 | 2 | 3 | 4;
  appUrl: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function deadlineLabel(ctx: ReminderEmailContext): string {
  if (ctx.deadlineKind === "btw_q") return ctx.quarter ? `Q${ctx.quarter} btw` : "btw";
  if (ctx.deadlineKind === "income_tax") return "income tax return";
  if (ctx.deadlineKind === "voorlopige_aanslag") return "voorlopige aanslag payment";
  return "deadline";
}

/**
 * Voice rules from docs/design's component sheet: state the fact and the
 * time it takes, never manufacture urgency ("Q3 btw is due by 31 October."
 * not "Your VAT return deadline is approaching!"). Overdue copy always
 * links the recovery flow and never shames — "Fix Q2 now — 20 min" is the
 * pattern, not a warning label.
 */
export function buildReminderEmail(ctx: ReminderEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const label = deadlineLabel(ctx);
  const dateStr = formatDate(ctx.dueDate);
  const cta = `${ctx.appUrl}/app/today`;

  let subject: string;
  let lede: string;

  switch (ctx.stage) {
    case "t14":
      subject = `${label} is due ${dateStr}`;
      lede = `Due in 14 days. About 25 minutes when you're ready — nothing to do yet.`;
      break;
    case "t7":
      subject = `${label} is due ${dateStr}`;
      lede = `Due in a week. About 25 minutes — worth starting soon.`;
      break;
    case "t2":
      subject = `${label} is due ${dateStr}`;
      lede = `Due in 2 days. About 25 minutes.`;
      break;
    case "day":
      subject = `${label} is due today`;
      lede = `Due today, ${dateStr}. About 25 minutes.`;
      break;
    case "overdue_1":
      subject = `${label} — pick up where you left off`;
      lede = `${dateStr} has passed. Nothing is lost — open the checklist and fix it, about 20 minutes.`;
      break;
    case "overdue_2":
    case "overdue_3":
      subject = `${label} still needs 20 minutes`;
      lede = `${dateStr} has passed. Same checklist, same 20 minutes, whenever you're ready.`;
      break;
  }

  const text = `${lede}\n\nOpen Kwartaal: ${cta}\n\nEstimates only — Mijn Belastingdienst or your bookkeeper has the final word.`;
  const html = `<p>${lede}</p><p><a href="${cta}">Open Kwartaal</a></p><p style="color:#7A7266;font-size:12px">Estimates only — Mijn Belastingdienst or your bookkeeper has the final word.</p>`;

  return { subject, html, text };
}
