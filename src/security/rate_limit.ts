import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

interface RateBucket {
  count: number;
  resetAtMs: number;
}

interface RateLimitOptions {
  namespace: string;
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 10_000;

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function extractIdentity(req: NextRequest): string {
  const bearer = req.headers.get("authorization");
  const apiToken = req.headers.get("x-api-token");
  const token = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : apiToken?.trim();
  if (token && token.length > 0) return `token:${stableHash(token)}`;

  const xff = req.headers.get("x-forwarded-for");
  const forwardedIp = xff?.split(",")[0]?.trim();
  const ip = forwardedIp || req.headers.get("x-real-ip")?.trim() || "unknown";
  return `ip:${stableHash(ip)}`;
}

function compactBuckets(nowMs: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAtMs <= nowMs) buckets.delete(key);
  }
}

export function assertRateLimit(req: NextRequest, options: RateLimitOptions): void {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1_000, Math.floor(options.windowMs));
  const nowMs = Date.now();
  compactBuckets(nowMs);

  const key = `${options.namespace}:${extractIdentity(req)}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAtMs <= nowMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return;
  }
  if (bucket.count >= limit) {
    throw new Error("rate_limited");
  }
  bucket.count += 1;
}
