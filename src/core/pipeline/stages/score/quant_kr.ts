import type { NormalizedSignal } from "../normalize";

export interface KrQuantAnalysis {
  socialScore: number;
  eventScore: number;
  volumeScore: number;
  flowScore: number;
  technicalScore: number;
  quantScore: number;
  contextRiskScore: number;
  quantMultiplier: number;
  socialLayerPassed: boolean;
  eventLayerPassed: boolean;
  volumeGuardPassed: boolean;
  flowGuardPassed: boolean;
  technicalGuardPassed: boolean;
  tripleCrownPassed: boolean;
  hardFilterPassed: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hasAny(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) hits += 1;
  }
  return hits;
}

function ratioToScore(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  if (ratio >= 2) return 1;
  if (ratio >= 1.5) return 0.78;
  if (ratio >= 1.2) return 0.55;
  if (ratio >= 1.0) return 0.4;
  return 0.2;
}

function extractPercentRatio(text: string): number {
  const matches = Array.from(text.matchAll(/(\d{2,3}(?:\.\d+)?)\s*%/g));
  if (matches.length === 0) return 0;
  const maxPercent = Math.max(...matches.map((m) => Number(m[1] ?? "0")));
  return maxPercent > 0 ? maxPercent / 100 : 0;
}

function computeVolumeScore(text: string, meta: Record<string, unknown>): number {
  const metaRatio = Number(meta["volume_ratio"] ?? meta["turnover_ratio"]);
  if (Number.isFinite(metaRatio) && metaRatio > 0) return ratioToScore(metaRatio);

  const ratioFromPercent = extractPercentRatio(text);
  const ratioFromKeyword =
    text.includes("2배") || text.includes("200%") ? 2 : text.includes("1.5배") || text.includes("150%") ? 1.5 : 0;
  const ratio = Math.max(ratioFromPercent, ratioFromKeyword);
  if (ratio > 0) return ratioToScore(ratio);

  const volumeHits = hasAny(text, ["거래량", "거래대금", "대량거래", "폭증", "급증"]);
  return volumeHits >= 2 ? 0.55 : volumeHits >= 1 ? 0.35 : 0.1;
}

function computeFlowScore(text: string, meta: Record<string, unknown>): number {
  const foreignNetBuy = Number(meta["foreign_net_buy"]);
  const institutionNetBuy = Number(meta["institution_net_buy"]);
  if (Number.isFinite(foreignNetBuy) || Number.isFinite(institutionNetBuy)) {
    const value = (Number.isFinite(foreignNetBuy) ? foreignNetBuy : 0) + (Number.isFinite(institutionNetBuy) ? institutionNetBuy : 0);
    if (value > 0) return 0.85;
    if (value < 0) return 0.15;
  }

  const positive = hasAny(text, ["외국인 순매수", "기관 순매수", "연기금 순매수", "수급 양호", "매수 우위"]);
  const negative = hasAny(text, ["외국인 순매도", "기관 순매도", "연기금 순매도", "수급 악화", "매도 우위"]);
  if (positive + negative === 0) return 0.5;
  return clamp01((positive - negative) / 3 + 0.5);
}

function computeTechnicalScore(text: string, meta: Record<string, unknown>): number {
  const ma5 = Number(meta["price_above_ma5"]);
  const ma20 = Number(meta["price_above_ma20"]);
  if (Number.isFinite(ma5) || Number.isFinite(ma20)) {
    const score = (Number.isFinite(ma5) ? ma5 : 0) * 0.45 + (Number.isFinite(ma20) ? ma20 : 0) * 0.55;
    return clamp01(score);
  }

  const positive = hasAny(text, ["5일선 상회", "20일선 상회", "골든크로스", "추세 돌파", "신고가"]);
  const negative = hasAny(text, ["5일선 이탈", "20일선 이탈", "데드크로스", "추세 이탈", "신저가"]);
  if (positive + negative === 0) return 0.5;
  return clamp01((positive - negative) / 3 + 0.5);
}

function computeEventScore(item: NormalizedSignal, text: string): number {
  const sourceBoost =
    item.source === "dart" ? 0.45 : item.source === "kr_research" ? 0.35 : item.source === "kr_news" ? 0.25 : 0.15;
  const eventHits = hasAny(text, ["공시", "수주", "계약", "실적", "컨센서스", "목표가 상향", "earnings"]);
  return clamp01(sourceBoost + Math.min(0.55, eventHits * 0.2));
}

function computeSocialScore(item: NormalizedSignal, text: string, sentimentScore: number): number {
  const socialHits = hasAny(text, ["종토방", "커뮤니티", "투표", "토론", "급등주", "밈주식"]);
  const sourceBoost = item.source === "kr_community" ? 0.2 : item.source === "naver" ? 0.1 : 0;
  const sentimentBoost = clamp01((sentimentScore + 1) / 2) * 0.5;
  return clamp01(sourceBoost + sentimentBoost + Math.min(0.35, socialHits * 0.15));
}

function computeContextRiskScore(text: string, volumeScore: number, flowScore: number, technicalScore: number): number {
  const overheatedHints = hasAny(text, ["52주 고점", "과열", "급등 피로", "고평가"]);
  const overheatByPercent = extractPercentRatio(text) >= 0.9 && text.includes("고점") ? 1 : 0;
  const flowRisk = flowScore < 0.45 ? 0.35 : 0;
  const technicalRisk = technicalScore < 0.4 ? 0.3 : 0;
  const bubbleRisk = volumeScore >= 0.85 && flowScore <= 0.45 ? 0.22 : 0;
  const divergenceRisk = technicalScore < 0.4 && flowScore < 0.45 ? 0.18 : 0;
  const lexicalRisk = Math.min(0.55, overheatedHints * 0.18 + overheatByPercent * 0.35);
  return clamp01(Math.max(lexicalRisk, flowRisk + technicalRisk, bubbleRisk + divergenceRisk));
}

export function analyzeKrQuantSignal(item: NormalizedSignal, sentimentScore: number): KrQuantAnalysis {
  const text = item.text.toLowerCase();
  const meta = item.metadata ?? {};

  const socialScore = computeSocialScore(item, text, sentimentScore);
  const eventScore = computeEventScore(item, text);
  const volumeScore = computeVolumeScore(text, meta);
  const flowScore = computeFlowScore(text, meta);
  const technicalScore = computeTechnicalScore(text, meta);
  const contextRiskScore = computeContextRiskScore(text, volumeScore, flowScore, technicalScore);

  const quantScore = clamp01(volumeScore * 0.45 + flowScore * 0.35 + technicalScore * 0.2);
  const tripleCrownComposite = clamp01(socialScore * 0.35 + eventScore * 0.25 + quantScore * 0.4);
  const baseMultiplier = 0.8 + tripleCrownComposite * 0.6;
  const riskPenalty = 1 - contextRiskScore * 0.2;
  const quantMultiplier = Math.max(0.75, Math.min(1.4, baseMultiplier * riskPenalty));

  const socialLayerPassed = socialScore >= 0.7;
  const eventLayerPassed = eventScore >= 0.5;
  const volumeGuardPassed = volumeScore >= 0.75;
  const flowGuardPassed = flowScore >= 0.5;
  const technicalGuardPassed = technicalScore >= 0.5;
  const hardFilterPassed = volumeGuardPassed && flowGuardPassed && technicalGuardPassed;
  const tripleCrownPassed = socialLayerPassed && eventLayerPassed && hardFilterPassed;

  return {
    socialScore,
    eventScore,
    volumeScore,
    flowScore,
    technicalScore,
    quantScore,
    contextRiskScore,
    quantMultiplier,
    socialLayerPassed,
    eventLayerPassed,
    volumeGuardPassed,
    flowGuardPassed,
    technicalGuardPassed,
    tripleCrownPassed,
    hardFilterPassed
  };
}
