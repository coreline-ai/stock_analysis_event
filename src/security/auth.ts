import type { NextRequest } from "next/server";
import { requireEnv } from "@/config/runtime";

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
  const expected = requireEnv("MAHORAGA_API_TOKEN");
  const token = getAuthToken(req);
  if (!token || token !== expected) {
    throw new Error("unauthorized");
  }
}
