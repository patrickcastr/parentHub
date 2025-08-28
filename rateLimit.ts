const requests: Record<string, { count: number; reset: number }> = {};

/**
 * Simple in‑memory rate limiter keyed by email.  Not suitable for production or multi‑instance setups.
 * @param email identifier to track
 * @param maxRequests maximum allowed requests in the window
 * @param windowMs length of the rate window in milliseconds
 * @returns true if the request is within the limit
 */
export function checkRateLimit(email: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = requests[email] || { count: 0, reset: now + windowMs };
  if (now > record.reset) {
    record.count = 0;
    record.reset = now + windowMs;
  }
  record.count += 1;
  requests[email] = record;
  return record.count <= maxRequests;
}