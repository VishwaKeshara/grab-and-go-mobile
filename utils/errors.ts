/**
 * Turns anything a service can reject with into a message worth showing.
 *
 * WHY THIS EXISTS
 *
 * `error instanceof Error ? error.message : "Something went wrong."` is the
 * usual shape, and it silently hides every database failure: supabase-js
 * rejects with plain objects (PostgrestError, AuthError), never with Error
 * instances, so `instanceof Error` is false and the fallback is shown instead.
 * That is how a missing column reached Shop Management as "We could not load
 * your listings." with no hint that the column was the problem, and how the
 * real message got lost for every other screen that used the same pattern.
 *
 * The fallback is therefore used only when there is genuinely no message to
 * show, never as a way of covering up one that exists.
 */

/** The parts of a supabase-js error that are worth surfacing. */
type SupabaseLikeError = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export function describeError(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return text(error) || fallback;
  }

  if (error instanceof Error) {
    return text(error.message) || fallback;
  }

  if (error && typeof error === "object") {
    const candidate = error as SupabaseLikeError;

    // PostgREST puts the cause in `message` and the context in `details`, so
    // message is preferred and details is only used if it is somehow alone.
    const message = text(candidate.message) || text(candidate.details);
    if (message) {
      const code = text(candidate.code);
      return code ? `${message} (${code})` : message;
    }
  }

  return fallback;
}