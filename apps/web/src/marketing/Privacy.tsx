import { LegalPage } from "./LegalPage";

export function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      updated="1 July 2026"
      sections={[
        {
          heading: "Scope",
          body: "This policy covers the Kwartaal web app and marketing site. Kwartaal is GDPR-native: your data lives on EU infrastructure, is processed only to run the product, and is never sold or used to train models.",
        },
        {
          heading: "What we store",
          body: "Your account email, business profile (legal form, KOR status, registration date), the tax figures you enter (income, expense, and hours records), receipt files, and billing metadata from Stripe. We practice data minimization by design: BSN and DigiD credentials are never requested, and free-text fields are validated to refuse them if detected.",
        },
        {
          heading: "Processors",
          body: "Cloudflare (hosting, database, file storage — EU region), Stripe (payments), Resend (transactional email), and Sentry (error monitoring, optional). Each processes only what's needed for its function, under a data processing agreement.",
        },
        {
          heading: "Your rights",
          body: "Export everything as a machine-readable zip at any time from Vault or Settings. Request account deletion from Settings — a full export is generated immediately, and your account and all data are permanently deleted 30 days later unless you cancel the request.",
        },
        {
          heading: "Analytics",
          body: "Cookie-less, aggregate analytics only (or none) — no consent banner, because there's nothing to consent to.",
        },
        {
          heading: "Contact",
          body: (
            <>
              Questions about this policy:{" "}
              <a href="mailto:privacy@kwartaal.nl">privacy@kwartaal.nl</a>.
            </>
          ),
        },
      ]}
    />
  );
}
