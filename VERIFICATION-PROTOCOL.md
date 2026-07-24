# VERIFICATION-PROTOCOL.md — post-implementation audit, remediation, re-audit

> This protocol is executed against the current repo. Three inputs are
> supplied by the operator's instruction that invoked this file — use them as
> given, never guess them; if any is missing, ask before starting:
>
> - **FINDINGS_SOURCE** — where the findings to verify live (an audit report,
>   review-pass notes, PROGRESS.md, an issue list, or a requirements document
>   whose clauses are treated as findings for a conformance audit).
> - **GATE_COMMANDS** — the executable quality gate (typecheck, tests, lint,
>   build, e2e, custom checks). If the repo defines these in its own docs
>   (build plan, CI config), those definitions win over any ad-hoc list.
> - **SCOPE** — what is in and out of audit scope (default: the whole repo).

## Phase 1 — Verification audit

**Rule zero: evidence or it is unresolved.** A claim — in a commit message, a
progress file, a comment, or a previous report — is not evidence. Evidence is:
(a) the code itself, cited as file path + line range at the current HEAD;
(b) a test that exercises the finding's failure mode, cited by name, that you
have RUN in this session and seen pass; or (c) command output you produced in
this session. "The fix was applied in commit X" without (a)+(b) verified at
HEAD is Still Open — later commits may have reverted it.

Procedure:

1. Read FINDINGS_SOURCE fully. Enumerate every finding with a stable ID
   (F-001, F-002…). If findings lack severity, assign one:
   Critical / High / Medium / Low, by user impact and blast radius.

**Design-fidelity findings (special evidence standard).** When
FINDINGS_SOURCE includes design artifacts (exports, mockups, a design spec
treated as binding), enumerate one finding per screen × state × viewport the
artifact specifies (IDs D-001…). For these findings ONLY, rule zero's
evidence is: a screenshot of the implemented screen rendered THIS session at
the matching viewport, in the repo's canonical demo/seed state, visually
compared against the artifact. Reading component code is NOT evidence of
visual parity. Classify: Fully Resolved = composition, hierarchy, spacing
rhythm, type scale, and token usage match with no missing elements or
states; Partially Resolved = recognizable but with concrete, individually
named discrepancies; Still Open = screen or state not implemented. Severity
triage: missing screens/states and broken layouts are High; token/spacing
drift is Medium; sub-pixel nitpicks are Low and are batched per screen —
never itemized into a flood that buries the real breaks. Where the demo
data differs from an artifact's illustrative figures, structure governs:
a data mismatch is not a fidelity finding. Design-fidelity findings get
their own section in AUDIT-REPORT.md with screenshot file references. 2. For each finding, independently verify at current HEAD — read the code, run
the relevant tests, reproduce the original failure mode where feasible.
Classify:

- **Fully Resolved** — evidence per rule zero, including a test that would
  catch regression. A fix with no covering test is at best Partially
  Resolved.
- **Partially Resolved** — some of the finding addressed; state precisely
  which part remains and why it matters.
- **Deferred** — intentionally postponed WITH a documented decision (who,
  where recorded, target milestone). Undocumented postponement is Still
  Open, not Deferred.
- **Not Actionable** — invalid, obsolete, or out of scope, with reasoning.
  This status requires the strongest justification; when in doubt, it is
  Still Open.
- **Still Open** — everything else, including all claims without evidence.

3. **Regression sweep (findings-independent):** run all GATE_COMMANDS from a
   clean state and record full output. Then inspect areas CHANGED since the
   findings were written (diff against the findings-era ref if known) for
   collateral damage: broken call sites, orphaned exports, dead routes,
   weakened or deleted tests, skipped tests added without a marker rationale,
   silenced errors, loosened types (`any`, non-null assertions, ts-ignore),
   config drift. Every anomaly becomes a NEW finding (R-001, R-002…).
4. Write **AUDIT-REPORT.md**: summary counts by status and severity; a table
   (ID · severity · one-line description · status · evidence citations); full
   gate output summary; new regression findings; and an explicit list titled
   "Remediation queue" = every Still Open + Partially Resolved + regression
   finding, ordered by severity.

Audit integrity rules: verify, don't fix, in this phase — no code changes
during Phase 1. Never re-grade a finding to a softer status because the fix
looks hard. If FINDINGS_SOURCE is itself wrong or stale, say so in the report
rather than silently reinterpreting it.

## Phase 2 — Remediation

Work the remediation queue strictly in severity order. For each item:

1. Write or extend a test that fails for the finding's failure mode FIRST
   (where the finding is testable; for doc/config findings, state the
   verification command instead).
2. Implement the minimal correct fix. No scope creep: nothing gets
   "improved along the way" outside the queue; discovered new problems are
   appended to the queue as new findings, not fixed ad hoc without record.
3. Run the targeted tests, then the full GATE_COMMANDS. A fix that breaks the
   gate is not a fix.
4. Record in AUDIT-REPORT.md under the finding: what changed (files),
   the covering test, and the gate result.

Forbidden moves (each is an automatic audit failure if found later):
weakening, deleting, or skipping a test to make it pass; broadening a lint/
type exception instead of fixing the cause; marking Deferred without a
documented decision; catching-and-swallowing an error to silence a failure;
editing FINDINGS_SOURCE to make a finding disappear.

## Phase 3 — Re-audit and termination

1. Re-run Phase 1 in full — every finding re-verified at the new HEAD, fresh
   regression sweep, updated AUDIT-REPORT.md with a cycle number.
2. **Exit criteria:** the protocol is complete when the remediation queue is
   empty — every finding is Fully Resolved, or Deferred/Not Actionable with
   the required documentation — AND all GATE_COMMANDS pass from clean.
3. **Termination guard:** maximum 3 full cycles. If findings remain open
   after cycle 3, STOP. Do not loop further and do not soften statuses to
   exit. Write a final section "Escalation: items requiring human decision"
   explaining, per item, why it resists resolution (ambiguous requirement,
   missing external resource, conflicting constraints, needs product
   decision) and what decision would unblock it.
4. Where the operator can arrange it, the re-audit runs in a fresh session
   (ideally a stronger model than the remediator, per the repo's operator
   notes if any) — the reviewer should not be the author. If running
   single-session, state that limitation at the top of the final report.
