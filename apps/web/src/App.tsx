import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./app/RequireAuth";
import { RequireOnboarded } from "./app/RequireOnboarded";
import { AppShell } from "./app/AppShell";
import { Landing } from "./routes/Landing";
import { SignIn } from "./routes/SignIn";
import { Onboarding } from "./routes/Onboarding";
import { Today } from "./routes/Today";
import { Vat } from "./routes/Vat";
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
            <Route
              path="income-tax"
              element={<PlaceholderScreen title="Income tax" pillar={4} />}
            />
            <Route
              path="money"
              element={<PlaceholderScreen title="Money" pillar={4} />}
            />
            <Route
              path="vault"
              element={<PlaceholderScreen title="Vault" pillar={4} />}
            />
            <Route path="glossary" element={<Glossary />} />
            <Route
              path="settings"
              element={<PlaceholderScreen title="Settings" pillar={4} />}
            />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
