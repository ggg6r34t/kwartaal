import type { DeadlineDef, DeadlineProfileInput } from "./types";

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * btw quarters (30 Apr / 31 Jul / 31 Oct / 31 Jan next year — Q4 belongs to
 * `year` but is due in `year + 1`, a first-class tested case), income tax
 * (1 May next year), and voorlopige aanslag monthly dates when active. KOR
 * orgs get no btw deadlines. Pure calendar-date math (no TaxFigures lookup)
 * — this keeps working even for a year whose TaxFigures row isn't seeded
 * yet, which is exactly what lets the calendar/btw flows degrade
 * gracefully while only the annual studio shows "figures pending".
 */
export function deadlinesForYear(
  profile: DeadlineProfileInput,
  year: number,
): DeadlineDef[] {
  const deadlines: DeadlineDef[] = [];

  if (!profile.korOptIn) {
    deadlines.push({ kind: "btw_q", dueDate: `${year}-04-30`, quarter: 1 });
    deadlines.push({ kind: "btw_q", dueDate: `${year}-07-31`, quarter: 2 });
    deadlines.push({ kind: "btw_q", dueDate: `${year}-10-31`, quarter: 3 });
    deadlines.push({ kind: "btw_q", dueDate: `${year + 1}-01-31`, quarter: 4 });
  }

  deadlines.push({ kind: "income_tax", dueDate: `${year + 1}-05-01` });

  if (profile.voorlopigeAanslag?.active) {
    for (let month = profile.voorlopigeAanslag.startMonth; month <= 12; month++) {
      deadlines.push({
        kind: "voorlopige_aanslag",
        dueDate: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
      });
    }
  }

  return deadlines;
}

/**
 * The last calendar day of a quarter's WORK PERIOD (Q1 ends 31 Mar, ...,
 * Q4 ends 31 Dec) — distinct from that quarter's filing due date. Used at
 * onboarding to decide which quarters happened before the org started
 * using Kwartaal (their period has already ended) and so default to
 * `handled_elsewhere`, versus the quarter currently in progress.
 */
export function quarterPeriodEnd(year: number, quarter: 1 | 2 | 3 | 4): string {
  const endMonth = quarter * 3;
  return `${year}-${pad2(endMonth)}-${pad2(lastDayOfMonth(year, endMonth))}`;
}

/** Which quarter (1-4) a given ISO calendar date falls within. */
export function quarterForDate(dateIso: string): 1 | 2 | 3 | 4 {
  const month = Number(dateIso.slice(5, 7));
  return Math.ceil(month / 3) as 1 | 2 | 3 | 4;
}
