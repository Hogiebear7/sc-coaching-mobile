// Reads the access fields out of a profile response from a server of unknown age, FAILING CLOSED.
//
// A server that predates the digital-plan change sends no `memberAccess` (it sent a ranked `memberTier`). The app must neither crash on that nor guess: it
// treats the member as having NO access to anything that depends on the new rules, says the server is out of date, and does not offer purchases (a purchase
// that the old server cannot verify must never be started). The legacy `memberTier` is deliberately ignored: under the old rules a gym Membership meant digital
// access, which is exactly what the owner's decision D1 removed, so mapping it across would grant what the new rules do not.
//
// Plain TypeScript, no React Native imports.
import { NO_ACCESS, type MemberAccess } from "./member-access";

export interface ProfileAccessFields {
  memberAccess: MemberAccess;
  digitalPlan: unknown;
  /** False when the server did not send valid access fields: older server, or a malformed answer. Billing is then unsupported. */
  accessSupported: boolean;
}

const isBool = (v: unknown): v is boolean => typeof v === "boolean";

export function readProfileAccess(raw: { memberAccess?: unknown; digitalPlan?: unknown } | null | undefined): ProfileAccessFields {
  const a = raw?.memberAccess as Partial<MemberAccess> | null | undefined;
  if (a && typeof a === "object" && isBool(a.digital) && isBool(a.gymMembership)) {
    return { memberAccess: { digital: a.digital, gymMembership: a.gymMembership }, digitalPlan: raw?.digitalPlan ?? null, accessSupported: true };
  }
  return { memberAccess: { ...NO_ACCESS }, digitalPlan: null, accessSupported: false };
}

export const OUT_OF_DATE_SERVER_MESSAGE =
  "This version of the app can't confirm your plan with the server yet, so subscriptions and paid features are switched off. Nothing has been charged. Please try again later or update the app.";
