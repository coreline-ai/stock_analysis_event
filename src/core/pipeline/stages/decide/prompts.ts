import type { MarketScope } from "@/core/domain/types";
import { lookupKrTickerName } from "../normalize/kr_ticker_cache";
import { lookupSecTickerName } from "../normalize/ticker_cache";

function isKrSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(symbol.trim());
}

export function buildDecisionPrompt(input: {
  symbol: string;
  signalSummary: string;
  marketScope?: MarketScope;
}): { system: string; user: string } {
  const marketScope = input.marketScope ?? "US";
  const krContext = marketScope === "KR" || (marketScope === "ALL" && isKrSymbol(input.symbol));
  const krName = krContext ? lookupKrTickerName(input.symbol) : null;
  const usName = !krContext ? lookupSecTickerName(input.symbol) : null;
  const symbolLabel = krName ? `${input.symbol} (${krName})` : usName ? `${input.symbol} (${usName})` : input.symbol;

  if (krContext) {
    const system = [
      "당신은 한국 주식시장 리서치 애널리스트입니다.",
      "KRX 거래 특성(장중 변동성, 외국인/기관 수급, 공시 민감도)을 반영해 보수적으로 판단하세요.",
      "Hybrid Quant-Social 힌트(hybrid_* 라인)를 우선적으로 해석하세요.",
      "특히 삼관왕 미통과 또는 강화 필터 미통과면 BUY_NOW를 피하고 WATCH/AVOID를 우선 검토하세요.",
      "반드시 유효한 JSON만 출력하세요.",
      "모든 설명 필드(요약/트리거/무효화/리스크/강세/약세/경고/촉매)는 한국어로 작성하세요.",
      "어려운 영어 용어는 피하고, 초보 투자자도 이해할 수 있는 쉬운 표현으로 작성하세요.",
      "symbol, verdict enum, time_horizon enum은 영문 규격을 유지하세요."
    ].join(" ");

    const user = `다음 시그널을 분석하여 한국 시장 Research-Only 판단을 생성하세요.

SYMBOL: ${symbolLabel}
MARKET: KR

SIGNALS:
${input.signalSummary}

아래 필드를 가진 JSON을 반환하세요:
{
  "verdict": "BUY_NOW|WATCH|AVOID",
  "confidence": 0.0-1.0,
  "time_horizon": "intraday|swing|long_term",
  "thesis_summary": "핵심 근거 요약(한국어)",
  "entry_trigger": "진입 조건(한국어)",
  "invalidation": "무효화 조건(한국어)",
  "risk_notes": ["리스크1", "리스크2"],
  "bull_case": ["강세 근거1"],
  "bear_case": ["약세 근거1"],
  "red_flags": ["경고1"],
  "catalysts": ["촉매1"]
}`;

    return { system, user };
  }

  const system = [
    "당신은 미국 주식시장 리서치 애널리스트입니다.",
    "미국 시장 맥락(실적 발표, SEC 공시, 유동성)을 반영해 보수적으로 판단하세요.",
    "반드시 유효한 JSON만 출력하세요.",
    "모든 설명 필드는 한국어로 작성하세요.",
    "어려운 영어 용어는 피하고, 초보 투자자도 이해할 수 있는 쉬운 표현으로 작성하세요.",
    "symbol, verdict enum, time_horizon enum은 영문 규격을 유지하세요."
  ].join(" ");

  const user = `다음 시그널을 분석하여 미국 시장 Research-Only 판단을 생성하세요.

SYMBOL: ${symbolLabel}
MARKET: US

SIGNALS:
${input.signalSummary}

아래 필드를 가진 JSON을 반환하세요:
{
  "verdict": "BUY_NOW|WATCH|AVOID",
  "confidence": 0.0-1.0,
  "time_horizon": "intraday|swing|long_term",
  "thesis_summary": "핵심 근거 요약(한국어)",
  "entry_trigger": "진입 조건(한국어)",
  "invalidation": "무효화 조건(한국어)",
  "risk_notes": ["리스크1", "리스크2"],
  "bull_case": ["강세 근거1"],
  "bear_case": ["약세 근거1"],
  "red_flags": ["경고1"],
  "catalysts": ["촉매1"]
}`;

  return { system, user };
}
