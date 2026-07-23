import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./app/RequireAuth";
import { AppShell } from "./app/AppShell";
import { Landing } from "./routes/Landing";
import { SignIn } from "./routes/SignIn";
import { PlaceholderScreen } from "./routes/PlaceholderScreen";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={<PlaceholderScreen title="Today" pillar={3} />} />
          <Route path="vat" element={<PlaceholderScreen title="VAT" pillar={3} />} />
          <Route
            path="income-tax"
            element={<PlaceholderScreen title="Income tax" pillar={4} />}
          />
          <Route path="money" element={<PlaceholderScreen title="Money" pillar={4} />} />
          <Route path="vault" element={<PlaceholderScreen title="Vault" pillar={4} />} />
          <Route
            path="glossary"
            element={<PlaceholderScreen title="Glossary" pillar={3} />}
          />
          <Route
            path="settings"
            element={<PlaceholderScreen title="Settings" pillar={3} />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
