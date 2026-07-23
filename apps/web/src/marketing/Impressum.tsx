import { LegalPage } from "./LegalPage";

export function Impressum() {
  return (
    <LegalPage
      title="Impressum"
      updated="1 July 2026"
      sections={[
        {
          heading: "Company",
          body: "Kwartaal B.V. · KVK 87654321 · Amsterdam, the Netherlands.",
        },
        {
          heading: "Contact",
          body: (
            <>
              <a href="mailto:hallo@kwartaal.nl">hallo@kwartaal.nl</a> — product and
              support, answered within one working day.
            </>
          ),
        },
        {
          heading: "Btw-id",
          body: "Available on request via hallo@kwartaal.nl.",
        },
      ]}
    />
  );
}
