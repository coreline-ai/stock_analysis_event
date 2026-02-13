interface BuildKrMarketMetaInput {
  title?: string | null;
  body?: string | null;
  base?: Record<string, unknown> | null;
}

function toText(input: BuildKrMarketMetaInput): string {
  return `${input.title ?? ""} ${input.body ?? ""}`.replace(/\s+/gu, " ").trim();
}

function parseNumber(raw: string): number | null {
  const value = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(value)) return null;
  return value;
}

function parseKoreanAmount(raw: string, unitRaw?: string): number | null {
  const value = parseNumber(raw);
  if (value === null) return null;
  const unit = (unitRaw ?? "").trim();
  if (!unit) return value;
  if (unit.includes("조")) return value * 1_0000_0000_0000;
  if (unit.includes("억")) return value * 1_0000_0000;
  if (unit.includes("만")) return value * 1_0000;
  if (unit.includes("천")) return value * 1_000;
  return value;
}

function extractPercentRatio(text: string): number | null {
  const match = text.match(/(?:거래량|거래대금)\s*([0-9]+(?:\.[0-9]+)?)\s*%/u);
  if (!match?.[1]) return null;
  const value = parseNumber(match[1]);
  if (value === null) return null;
  return value / 100;
}

function extractXRatio(text: string): number | null {
  const match = text.match(/(?:거래량|거래대금)\s*([0-9]+(?:\.[0-9]+)?)\s*배/u);
  if (!match?.[1]) return null;
  return parseNumber(match[1]);
}

function inferVolumeRatio(text: string): number | null {
  const ratioFromX = extractXRatio(text);
  if (ratioFromX && ratioFromX > 0) return ratioFromX;
  const ratioFromPercent = extractPercentRatio(text);
  if (ratioFromPercent && ratioFromPercent > 0) return ratioFromPercent;

  if (/(거래량|거래대금).*(폭증|급증|급등)/u.test(text)) return 1.8;
  if (/(거래량|거래대금).*(증가|증가세|개선)/u.test(text)) return 1.25;
  if (/(거래량|거래대금).*(감소|부진|저조|축소)/u.test(text)) return 0.8;
  return null;
}

function extractNet(text: string, actors: string[]): number | null {
  let total = 0;
  let found = false;

  for (const actor of actors) {
    const buyRegex = new RegExp(`${actor}\\s*순매수(?:\\s*([0-9][0-9,]*(?:\\.[0-9]+)?))?\\s*(조원|억원|만원|천원|조|억|만|천)?`, "gu");
    const sellRegex = new RegExp(`${actor}\\s*순매도(?:\\s*([0-9][0-9,]*(?:\\.[0-9]+)?))?\\s*(조원|억원|만원|천원|조|억|만|천)?`, "gu");

    for (const match of text.matchAll(buyRegex)) {
      found = true;
      if (match[1]) {
        const amount = parseKoreanAmount(match[1], match[2]);
        total += amount ?? 1;
      } else {
        total += 1;
      }
    }

    for (const match of text.matchAll(sellRegex)) {
      found = true;
      if (match[1]) {
        const amount = parseKoreanAmount(match[1], match[2]);
        total -= amount ?? 1;
      } else {
        total -= 1;
      }
    }
  }

  return found ? total : null;
}

function inferMaSignal(text: string, day: 5 | 20): number | null {
  const upPattern = new RegExp(`${day}일(?:\\s*이동평균)?선\\s*(상회|돌파|회복)`, "u");
  const downPattern = new RegExp(`${day}일(?:\\s*이동평균)?선\\s*(하회|이탈|붕괴)`, "u");
  if (upPattern.test(text)) return 1;
  if (downPattern.test(text)) return 0;

  if (/골든크로스/u.test(text)) return 1;
  if (/데드크로스/u.test(text)) return 0;
  return null;
}

export function buildKrMarketMetadata(input: BuildKrMarketMetaInput): Record<string, unknown> {
  const text = toText(input);
  const base: Record<string, unknown> = { ...(input.base ?? {}) };

  const volumeRatio = inferVolumeRatio(text);
  if (volumeRatio !== null) base.volume_ratio = volumeRatio;

  const foreignNetBuy = extractNet(text, ["외국인"]);
  if (foreignNetBuy !== null) base.foreign_net_buy = foreignNetBuy;

  const institutionNetBuy = extractNet(text, ["기관", "연기금", "투신"]);
  if (institutionNetBuy !== null) base.institution_net_buy = institutionNetBuy;

  const ma5 = inferMaSignal(text, 5);
  if (ma5 !== null) base.price_above_ma5 = ma5;

  const ma20 = inferMaSignal(text, 20);
  if (ma20 !== null) base.price_above_ma20 = ma20;

  return base;
}
