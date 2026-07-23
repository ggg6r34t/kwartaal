import { LegalPage } from "./LegalPage";

export function Terms() {
  return (
    <LegalPage
      title="Terms"
      updated="1 July 2026"
      sections={[
        {
          heading: "The service",
          body: "Kwartaal guides, estimates, and reminds. It does not file tax returns, does not provide tax advice, and does not act as your bookkeeper or accountant. Every computed figure is an estimate for the tax year shown; Mijn Belastingdienst has the final word.",
        },
        {
          heading: "Your account",
          body: "One org per account. Owners have full access; a Pro subscription includes one read-only bookkeeper seat that can view and export but never mutate data. You're responsible for the accuracy of what you enter.",
        },
        {
          heading: "Trial and billing",
          body: "New accounts get full access until their first quarter closes (filed and paid), with no card required. After that, continued access to Pro features requires an active subscription, billed monthly or annually via Stripe. Cancel any time in Settings; access continues until the end of the current billing period.",
        },
        {
          heading: "Data ownership",
          body: "Your data is yours. It remains readable and exportable regardless of subscription status, and is only deleted on your explicit request (with a 30-day grace period) or after account closure.",
        },
        {
          heading: "Limitation of liability",
          body: "Kwartaal is provided as guidance software, not professional advice. To the extent permitted by law, Kwartaal B.V. is not liable for tax filings, penalties, or decisions made based on estimates shown in the product.",
        },
      ]}
    />
  );
}
