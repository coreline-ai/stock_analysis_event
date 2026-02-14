export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function buildRiskTags(input: {
  contextRiskScore?: number;
  volumeGuardPassed?: boolean;
  flowGuardPassed?: boolean;
  technicalGuardPassed?: boolean;
}): string[] {
  const tags: string[] = [];
  const risk = typeof input.contextRiskScore === "number" ? clamp01(input.contextRiskScore) : null;

  if (risk !== null && risk >= 0.75) {
    tags.push("이격도 과열");
    tags.push("52주 고점 근접");
  } else if (risk !== null && risk >= 0.45) {
    tags.push("변동성 주의");
  }

  if (input.flowGuardPassed === false) tags.push("기관 매도 우위");
  if (input.volumeGuardPassed === false) tags.push("거래량 미달");
  if (input.technicalGuardPassed === false) tags.push("기술 관문 미충족");

  if (tags.length === 0) tags.push("특이 리스크 없음");
  return Array.from(new Set(tags));
}

export function analyzeRadarPattern(input: {
  socialScore?: number;
  eventScore?: number;
  volumeScore?: number;
  flowScore?: number;
}): string[] {
  const social = clamp01(input.socialScore ?? 0);
  const event = clamp01(input.eventScore ?? 0);
  const volume = clamp01(input.volumeScore ?? 0);
  const flow = clamp01(input.flowScore ?? 0);
  const hints: string[] = [];

  if (social >= 0.75 && volume <= 0.45 && flow <= 0.45) {
    hints.push("허수 경고");
  }
  if (event >= 0.6 && volume >= 0.7 && flow >= 0.65) {
    hints.push("실수급 후보");
  }
  if (hints.length === 0) hints.push("중립");
  return hints;
}

export interface ParsedEntryTrigger {
  mode: "price" | "percent" | "text";
  targetPrice?: number;
  targetPercent?: number;
}

const TIME_UNIT_PATTERN = /^(?:거래일|일|주|개월|년|시간|분|day|days|week|weeks|month|months|year|years)\b/i;

function toPositiveNumber(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function extractPriceFromText(text: string): number | null {
  const prefixedCurrency = text.match(/(?:₩|\$|USD|KRW)\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  if (prefixedCurrency?.[1]) {
    const value = toPositiveNumber(prefixedCurrency[1]);
    if (value !== null) return value;
  }

  const suffixedCurrency = text.match(/([0-9][0-9,]*(?:\.\d+)?)\s*(?:원|KRW|USD|달러|불)\b/i);
  if (suffixedCurrency?.[1]) {
    const value = toPositiveNumber(suffixedCurrency[1]);
    if (value !== null) return value;
  }

  const keywordPrice = text.match(
    /(?:목표가|진입가|매수가|가격|price|target)\s*[:=]?\s*([0-9][0-9,]*(?:\.\d+)?)(?!\s*(?:거래일|일|주|개월|년|day|days|week|weeks|month|months|year|years))/i
  );
  if (keywordPrice?.[1]) {
    const value = toPositiveNumber(keywordPrice[1]);
    if (value !== null) return value;
  }

  const numericMatches = text.matchAll(/([0-9][0-9,]*(?:\.\d+)?)/g);
  for (const match of numericMatches) {
    const raw = match[1];
    const index = match.index ?? -1;
    if (index < 0) continue;
    const end = index + raw.length;
    const trailing = text.slice(end).trimStart();
    if (TIME_UNIT_PATTERN.test(trailing)) continue;

    const value = toPositiveNumber(raw);
    if (value === null) continue;
    const hasComma = raw.includes(",");
    const hasDecimal = raw.includes(".");
    if (hasComma || hasDecimal || value >= 100) return value;
  }

  return null;
}

export function parseEntryTrigger(trigger: string): ParsedEntryTrigger {
  const text = trigger.trim();
  if (!text) return { mode: "text" };

  const percentMatch = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const value = Number(percentMatch[1]);
    if (Number.isFinite(value)) return { mode: "percent", targetPercent: value };
  }

  const targetPrice = extractPriceFromText(text);
  if (targetPrice !== null) return { mode: "price", targetPrice };

  return { mode: "text" };
}

export interface TriggerProgress {
  progressPct: number;
  remainingPct: number;
  nearEntry: boolean;
}

export function computeTriggerProgress(currentPrice: number, targetPrice: number): TriggerProgress {
  const remainingPct = Math.abs(targetPrice - currentPrice) / currentPrice * 100;
  const progressPct = clamp01(1 - remainingPct / 10) * 100;
  return {
    progressPct,
    remainingPct,
    nearEntry: remainingPct <= 2
  };
}
