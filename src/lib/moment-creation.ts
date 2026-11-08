/** Only reviewed transaction-aborting creation errors establish non-creation. */
export function isMomentCreationRejection(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "P0001" &&
    "message" in error && typeof error.message === "string" && [
      "Authentication required",
      "Invalid visibility",
      "Invalid event type",
      "Category is required",
      "Friction intensity must be between 1 and 5",
      "Private moments cannot contain shared topics",
      "Relationship membership required",
    ].includes(error.message);
}

export function isMomentId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type CreationAttempt = {
  userId: string;
  routeKey: string;
  phase: "idle" | "pending" | "uncertain" | "acknowledged";
};

export const UNCERTAIN_CREATION_NOTICE =
  "We couldn't confirm the result. Your moment may already have been saved or shared. Check Moments before starting a new one. This attempt will not be sent again.";

export const ACKNOWLEDGED_CREATION_NOTICE =
  "Your moment was saved. Check Moments to find it. This attempt will not be sent again.";
