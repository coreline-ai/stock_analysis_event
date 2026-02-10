import { nowIso } from "@/core/utils/time";

export function logAuthFailure(route: string, reason: string) {
  // Unified auth failure log format
  const payload = {
    level: "warn",
    scope: "auth",
    route,
    reason,
    timestamp: nowIso()
  };
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(payload));
}
