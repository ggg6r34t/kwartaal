import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/auth-client";

/** Renders nothing while pending (a deliberate blank over a flash); a missing session redirects to sign-in. */
export function RequireAuth() {
  const { data, isPending } = useSession();
  if (isPending) return null;
  if (!data?.session) return <Navigate to="/signin" replace />;
  return <Outlet />;
}
