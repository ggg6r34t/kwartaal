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
