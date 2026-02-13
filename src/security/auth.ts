import type { NextRequest } from "next/server";
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
  const devBypass = getBooleanEnv("DEV_AUTH_BYPASS", getBooleanEnv("DEEPSTOCK_DEV_AUTH_BYPASS", true));
  // In local/dev, auth can be bypassed unless explicitly disabled.
  if (process.env.NODE_ENV !== "production" && devBypass) {
    return;
  }

  const expected = process.env.API_TOKEN ?? process.env.DEEPSTOCK_API_TOKEN;
  if (!expected) {
    throw new Error("Missing required env: API_TOKEN");
  }
  const token = getAuthToken(req);
  if (!token || token !== expected) {
    throw new Error("unauthorized");
  }
}
