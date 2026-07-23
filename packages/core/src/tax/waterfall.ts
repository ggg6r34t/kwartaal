import type { TaxFigures, WaterfallInput, WaterfallStep } from "./types";
import { bpsOfCents } from "./rounding";

const URENCRITERIUM_HOURS = 1225;
const STARTERSAFTREK_MAX_USES = 3;
const STARTERSAFTREK_WINDOW_YEARS = 5;

function withinStartersWindow(kvkRegisteredAt: string | null, asOfYear: number): boolean {
  if (!kvkRegisteredAt) return false;
  const kvkYear = Number(kvkRegisteredAt.slice(0, 4));
  return asOfYear - kvkYear < STARTERSAFTREK_WINDOW_YEARS;
}

/**
 * profit -> zelfstandigenaftrek -> startersaftrek -> MKB-winstvrijstelling
 * -> taxable. Each deduction step is capped at the running total so the
 * waterfall never goes negative (a tested property — see waterfall.test.ts).
 */
export function computeWaterfall(
  input: WaterfallInput,
  figures: TaxFigures,
): WaterfallStep[] {
  const steps: WaterfallStep[] = [];
  let running = Math.max(input.profitCents, 0);
  const meetsUrencriterium = input.hoursLogged >= URENCRITERIUM_HOURS;

  if (meetsUrencriterium) {
    const amountCents = -Math.min(figures.zelfstandigenaftrekCents, running);
    running += amountCents;
    steps.push({
      label: "Zelfstandigenaftrek",
      amountCents,
      runningTotalCents: running,
      eligible: true,
    });
  } else {
    steps.push({
      label: "Zelfstandigenaftrek",
      amountCents: 0,
      runningTotalCents: running,
      eligible: false,
      reason: `urencriterium not met: ${input.hoursLogged} of ${URENCRITERIUM_HOURS} hours logged`,
    });
  }

  const startersEligible =
    meetsUrencriterium &&
    input.startersaftrekUsedCount < STARTERSAFTREK_MAX_USES &&
    withinStartersWindow(input.kvkRegisteredAt, input.asOfYear);

  if (startersEligible) {
    const amountCents = -Math.min(figures.startersaftrekCents, running);
    running += amountCents;
    steps.push({
      label: "Startersaftrek",
      amountCents,
      runningTotalCents: running,
      eligible: true,
    });
  } else {
    const reason = !meetsUrencriterium
      ? "urencriterium not met"
      : input.startersaftrekUsedCount >= STARTERSAFTREK_MAX_USES
        ? `already used ${STARTERSAFTREK_MAX_USES} times`
        : `outside the first ${STARTERSAFTREK_WINDOW_YEARS} years since KVK registration`;
    steps.push({
      label: "Startersaftrek",
      amountCents: 0,
      runningTotalCents: running,
      eligible: false,
      reason,
    });
  }

  // No eligibility gate — every profile gets the MKB-winstvrijstelling.
  const mkbAmountCents = -bpsOfCents(running, figures.mkbVrijstellingBps);
  running += mkbAmountCents;
  steps.push({
    label: "MKB-winstvrijstelling",
    amountCents: mkbAmountCents,
    runningTotalCents: running,
    eligible: true,
  });

  return steps;
}
