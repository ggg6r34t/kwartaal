import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./app/RequireAuth";
import { RequireOnboarded } from "./app/RequireOnboarded";
import { AppShell } from "./app/AppShell";
import { Landing } from "./routes/Landing";
import { SignIn } from "./routes/SignIn";
import { Onboarding } from "./routes/Onboarding";
import { Today } from "./routes/Today";
import { Vat } from "./routes/Vat";
import { IncomeTax } from "./routes/IncomeTax";
import { Money } from "./routes/Money";
import { Vault } from "./routes/Vault";
import { Glossary } from "./routes/Glossary";
import { PlaceholderScreen } from "./routes/PlaceholderScreen";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />

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
            <Route
              path="settings"
              element={<PlaceholderScreen title="Settings" pillar={5} />}
            />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
