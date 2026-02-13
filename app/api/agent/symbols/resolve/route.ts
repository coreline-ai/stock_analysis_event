import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";
import { lookupKrTickerName, refreshKrTickersIfNeeded } from "@/core/pipeline/stages/normalize/kr_ticker_cache";

function parseCodes(raw: string | null): string[] {
  if (!raw) return [];
  const deduped = new Set<string>();
  for (const token of raw.split(",")) {
    const code = token.trim();
    if (!/^\d{6}$/.test(code)) continue;
    deduped.add(code);
    if (deduped.size >= 300) break;
  }
  return Array.from(deduped);
}

export async function GET(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);

    const codes = parseCodes(req.nextUrl.searchParams.get("codes"));
    await refreshKrTickersIfNeeded();

    const names: Record<string, string> = {};
    for (const code of codes) {
      const name = lookupKrTickerName(code);
      if (name) names[code] = name;
    }

    return jsonOk({ names });
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/symbols/resolve", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}

