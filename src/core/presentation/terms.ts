import type { AgentRunStatus, DecisionVerdict, MarketScope } from "@/core/domain/types";

export function verdictLabelKo(verdict: DecisionVerdict | string): string {
  if (verdict === "BUY_NOW") return "즉시 진입";
  if (verdict === "WATCH") return "관망";
  if (verdict === "AVOID") return "회피";
  return verdict;
}

export function horizonLabelKo(horizon: string): string {
  if (horizon === "intraday") return "당일";
  if (horizon === "swing") return "스윙(수일~수주)";
  if (horizon === "long_term") return "중장기(수주~수개월)";
  return horizon;
}

export function marketScopeLabelKo(scope?: MarketScope | string | null): string {
  if (!scope) return "-";
  if (scope === "US") return "미국";
  if (scope === "KR") return "한국";
  if (scope === "ALL") return "통합";
  return scope;
}

export function runStatusLabelKo(status?: AgentRunStatus | string | null): string {
  if (!status) return "없음";
  if (status === "success") return "성공";
  if (status === "partial") return "부분 성공";
  if (status === "failed") return "실패";
  return status;
}

export function triggerLabelKo(trigger?: "manual" | string | null): string {
  if (!trigger) return "-";
  if (trigger === "manual") return "수동 실행";
  if (trigger === "cron") return "스케줄 실행(레거시)";
  return trigger;
}

export function passLabelKo(value?: boolean): string {
  if (value === true) return "통과";
  if (value === false) return "미통과";
  return "미평가";
}
