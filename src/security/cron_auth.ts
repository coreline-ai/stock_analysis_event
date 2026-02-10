import type { NextRequest } from "next/server";
import { requireEnv } from "@/config/runtime";

export function assertCronAuth(req: NextRequest): void {
  const expected = requireEnv("CRON_SECRET");
  const token = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token !== expected) {
    throw new Error("unauthorized");
  }
}
