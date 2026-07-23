import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../lib/auth-client";

/**
 * Renders nothing while pending (a deliberate blank over a flash); a
 * missing session redirects to sign-in with the attempted destination
 * preserved as `returnTo` (validated on the way back in — see
 * lib/return-to.ts — so this can never become an open redirect).
 */
export function RequireAuth() {
  const { data, isPending } = useSession();
  const location = useLocation();
  if (isPending) return null;
  if (!data?.session) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <Outlet />;
}
