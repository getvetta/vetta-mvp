// lib/ratelimit.ts
type Bucket = { count: number; resetAt: number };
type CacheEntry = { value: any; expiresAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __vettaBuckets: Map<string, Bucket> | undefined;
  // eslint-disable-next-line no-var
  var __vettaIdem: Map<string, CacheEntry> | undefined;
}

function buckets() {
  if (!globalThis.__vettaBuckets) globalThis.__vettaBuckets = new Map();
  return globalThis.__vettaBuckets;
}

function idem() {
  if (!globalThis.__vettaIdem) globalThis.__vettaIdem = new Map();
  return globalThis.__vettaIdem;
}

function ipKey(req: Request) {
  // works best on Vercel/edge; otherwise may be empty
  const xf = req.headers.get("x-forwarded-for") || "";
  const ip = xf.split(",")[0]?.trim();
  return ip || "unknown";
}

/**
 * Best-effort rate limiter (per instance).
 * For true multi-instance scaling, swap this to Redis/Upstash.
 */
export async function rateLimitOrThrow(
  req: Request,
  opts: { limit: number; windowMs: number; prefix?: string }
) {
  const key = `${opts.prefix || "api"}:${ipKey(req)}`;
  const now = Date.now();
  const map = buckets();
  const b = map.get(key);

  if (!b || now > b.resetAt) {
    map.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  b.count += 1;
  if (b.count > opts.limit) {
    const retrySec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    const err = new Error(`Rate limit exceeded. Try again in ${retrySec}s.`);
    (err as any).status = 429;
    throw err;
  }

  map.set(key, b);
}

/** Idempotency cache (per instance) */
export function idempotencyGet(key: string) {
  const now = Date.now();
  const m = idem();
  const e = m.get(key);
  if (!e) return null;
  if (now > e.expiresAt) {
    m.delete(key);
    return null;
  }
  return e.value;
}

export function idempotencySet(key: string, value: any, ttlMs = 2 * 60_000) {
  const m = idem();
  m.set(key, { value, expiresAt: Date.now() + ttlMs });
}
