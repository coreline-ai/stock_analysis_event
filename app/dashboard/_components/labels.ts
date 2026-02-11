import type { AgentRunStatus, DecisionVerdict, MarketScope, SignalSource } from "@/core/domain/types";

export function verdictLabel(verdict: DecisionVerdict | string): string {
  if (verdict === "BUY_NOW") return "즉시진입";
  if (verdict === "WATCH") return "관망";
  if (verdict === "AVOID") return "회피";
  return verdict;
}

export function horizonLabel(horizon: string): string {
  if (horizon === "intraday") return "당일";
  if (horizon === "swing") return "스윙";
  if (horizon === "long_term") return "장기";
  return horizon;
}

export function runStatusLabel(status?: AgentRunStatus | string | null): string {
  if (!status) return "없음";
  if (status === "success") return "성공";
  if (status === "partial") return "부분";
  if (status === "failed") return "실패";
  return status;
}

export function triggerLabel(trigger?: "manual" | "cron" | string | null): string {
  if (!trigger) return "-";
  if (trigger === "manual") return "수동";
  if (trigger === "cron") return "스케줄";
  return trigger;
}

export function sourceLabel(source: SignalSource | string): string {
  if (source === "reddit") return "레딧";
  if (source === "stocktwits") return "스톡트윗";
  if (source === "sec") return "SEC";
  if (source === "news") return "뉴스";
  if (source === "naver") return "네이버";
  if (source === "dart") return "DART 공시";
  if (source === "kr_community") return "한국 커뮤니티";
  if (source === "kr_news") return "한국 뉴스";
  if (source === "kr_research") return "한국 리서치";
  if (source === "kr_global_context") return "글로벌 맥락";
  if (source === "crypto") return "크립토";
  return source;
}

export function stageLabel(stage: string): string {
  if (stage === "gather") return "수집";
  if (stage === "normalize") return "정규화";
  if (stage === "score") return "스코어링";
  if (stage === "decide") return "판단";
  if (stage === "report") return "리포트";
  if (stage === "persist") return "저장";
  if (stage === "total") return "전체";
  if (stage.endsWith("_ms")) return `${stage.replace(/_ms$/, "")} 단계`;
  return stage;
}

export function marketScopeLabel(scope?: MarketScope | string | null): string {
  if (!scope) return "-";
  if (scope === "US") return "미국";
  if (scope === "KR") return "한국";
  if (scope === "ALL") return "통합";
  return scope;
}
