import { signIn, requestPasswordReset } from "./auth-client";

export type AuthLinkKind = "signin" | "signup" | "reset";

/** Shared by CheckYourInbox's resend button and LinkExpired's "send a fresh link" action. */
export async function resendAuthLink(kind: AuthLinkKind, email: string): Promise<void> {
  if (kind === "reset") {
    await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}`,
    });
    return;
  }
  await signIn.magicLink({
    email,
    callbackURL: `${window.location.origin}/app`,
    errorCallbackURL: `${window.location.origin}/link-expired?kind=${kind}&email=${encodeURIComponent(email)}`,
  });
}

export function authStartUrlFor(kind: AuthLinkKind): string {
  if (kind === "reset") return "/forgot-password";
  if (kind === "signup") return "/signup";
  return "/signin";
}
