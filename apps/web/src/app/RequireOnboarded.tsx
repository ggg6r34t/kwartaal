import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "../hooks/useMe";

/** Routes to the onboarding wizard until BusinessProfile.onboardedAt is set. */
export function RequireOnboarded() {
  const { me, loading } = useMe();
  if (loading) return null;
  if (me && !me.businessProfile?.onboardedAt)
    return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
