import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { getBooleanEnv } from "@/config/runtime";

export function getAuthToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const headerToken = req.headers.get("x-api-token");
  if (headerToken) return headerToken.trim();
  return null;
}

export function assertApiAuth(req: NextRequest): void {
  const devBypass = getBooleanEnv("DEV_AUTH_BYPASS", getBooleanEnv("DEEPSTOCK_DEV_AUTH_BYPASS", false));
  // In local/dev, auth bypass is allowed only when explicitly enabled.
  if (process.env.NODE_ENV !== "production" && devBypass) {
    return;
  }

  const expected = process.env.API_TOKEN ?? process.env.DEEPSTOCK_API_TOKEN;
  if (!expected) {
    throw new Error("Missing required env: API_TOKEN");
  }
  const token = getAuthToken(req);
  if (!token || !secureTokenEquals(expected, token)) {
    throw new Error("unauthorized");
  }
}

function digestToken(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function secureTokenEquals(expected: string, provided: string): boolean {
  return timingSafeEqual(digestToken(expected), digestToken(provided));
}
