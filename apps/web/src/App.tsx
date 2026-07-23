import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./app/RequireAuth";
import { RequireOnboarded } from "./app/RequireOnboarded";
import { AppShell } from "./app/AppShell";
import { SignIn } from "./routes/SignIn";
import { AcceptInvite } from "./routes/AcceptInvite";
import { Onboarding } from "./routes/Onboarding";
import { Today } from "./routes/Today";
import { Vat } from "./routes/Vat";
import { IncomeTax } from "./routes/IncomeTax";
import { Money } from "./routes/Money";
import { Vault } from "./routes/Vault";
import { Glossary } from "./routes/Glossary";
import { Settings } from "./routes/Settings";
import { Home } from "./marketing/Home";
import { Pricing } from "./marketing/Pricing";
import { HowItWorks } from "./marketing/HowItWorks";
import { Guide } from "./marketing/Guide";
import { About } from "./marketing/About";
import { Companion } from "./marketing/Companion";
import { Privacy } from "./marketing/Privacy";
import { Terms } from "./marketing/Terms";
import { Dpa } from "./marketing/Dpa";
import { Impressum } from "./marketing/Impressum";
import { NotFound } from "./marketing/NotFound";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/about" element={<About />} />
      <Route path="/companion" element={<Companion />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/dpa" element={<Dpa />} />
      <Route path="/impressum" element={<Impressum />} />

      <Route path="/signin" element={<SignIn />} />
      <Route path="/accept-invite/:token" element={<AcceptInvite />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />

        <Route element={<RequireOnboarded />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={<Today />} />
            <Route path="vat" element={<Vat />} />
            <Route path="income-tax" element={<IncomeTax />} />
            <Route path="money" element={<Money />} />
            <Route path="vault" element={<Vault />} />
            <Route path="glossary" element={<Glossary />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
