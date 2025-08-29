const requests: Record<string, { count: number; reset: number }> = {};

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
