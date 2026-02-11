import { detectSentimentKr } from "./sentiment_kr";

export function detectSentiment(text: string): number {
  if (/[가-힣]/.test(text)) return detectSentimentKr(text);
  const lower = text.toLowerCase();
  const bullish = [
    "moon",
    "rocket",
    "buy",
    "calls",
    "long",
    "bullish",
    "yolo",
    "tendies",
    "gains",
    "diamond",
    "squeeze",
    "pump",
    "breakout",
    "undervalued",
    "accumulate"
  ];
  const bearish = [
    "puts",
    "short",
    "sell",
    "bearish",
    "crash",
    "dump",
    "tank",
    "overvalued",
    "bubble",
    "avoid"
  ];

  let bull = 0;
  let bear = 0;
  for (const w of bullish) if (lower.includes(w)) bull++;
  for (const w of bearish) if (lower.includes(w)) bear++;

  const total = bull + bear;
  if (total === 0) return 0;
  return (bull - bear) / total;
}

export function computeSentimentFromMeta(meta?: Record<string, unknown> | null): number | null {
  if (!meta) return null;
  const sentiment = meta["sentiment"];
  if (typeof sentiment === "number" && Number.isFinite(sentiment)) return sentiment;

  const bullish = meta["bullish"];
  const bearish = meta["bearish"];
  if (typeof bullish === "number" && typeof bearish === "number") {
    const total = bullish + bearish;
    if (total > 0) return (bullish - bearish) / total;
  }

  return null;
}
