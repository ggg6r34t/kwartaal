import { LegalPage } from "./LegalPage";

export function Dpa() {
  return (
    <LegalPage
      title="DPA"
      updated="1 July 2026"
      sections={[
        {
          heading: "Roles",
          body: "For the personal data you enter into Kwartaal, you are the data controller and Kwartaal B.V. is the data processor. This summary describes the terms available in full in our Data Processing Agreement — request the signed version at privacy@kwartaal.nl.",
        },
        {
          heading: "Sub-processors",
          body: "Cloudflare (infrastructure, EU region), Stripe (payment processing), Resend (email delivery), and Sentry (error monitoring, optional). Each is bound by its own data processing agreement with Kwartaal B.V.",
        },
        {
          heading: "Security measures",
          body: "Encryption in transit and at rest, tenant-isolated data access enforced at the database layer, audit logging of every mutation and export, and encrypted storage for any third-party integration secrets.",
        },
        {
          heading: "Data subject requests",
          body: "Export and deletion are self-service from within the product (Settings → Your data / Account deletion). For anything the product doesn't cover, contact privacy@kwartaal.nl.",
        },
      ]}
    />
  );
}
