const DEFAULT_BLACKLIST = new Set([
  "CEO",
  "CFO",
  "USA",
  "USD",
  "ETF",
  "NYSE",
  "SEC",
  "WSB",
  "YOLO",
  "FOMO",
  "API",
  "AI",
  "IPO",
  "IMO",
  "LOL",
  "WTF",
  "CALL",
  "PUT",
  "BULL",
  "BEAR",
  "BUY",
  "SELL",
  "HOLD",
  "THIS",
  "THAT",
  "WITH",
  "FROM",
  "YOUR",
  "YOUR",
  "WHEN",
  "WHAT",
  "WHERE",
  "WHY",
  "NEWS",
  "DATA",
  "INFO",
  "CASH",
  "GAIN",
  "LOSS"
]);

export function normalizeSymbol(symbol: string): string | null {
  const upper = symbol.toUpperCase().trim();
  if (upper.length < 2 || upper.length > 5) return null;
  if (DEFAULT_BLACKLIST.has(upper)) return null;
  if (!/^[A-Z]+$/.test(upper)) return null;
  return upper;
}

export function normalizeKrSymbol(symbol: string): string | null {
  const trimmed = symbol.trim().toUpperCase();
  const strippedPrefix = trimmed.startsWith("A") ? trimmed.slice(1) : trimmed;
  const strippedSuffix = strippedPrefix.replace(/\.(KS|KQ)$/u, "");
  if (!/^\d{6}$/.test(strippedSuffix)) return null;
  return strippedSuffix;
}

export function extractTickerCandidates(text: string): string[] {
  const matches = new Set<string>();
  const regex = /\$([A-Za-z]{1,5})\b|\b([A-Z]{2,5})\b(?=\s+(?:stock|shares?|calls?|puts?|buy|sell|long|short|moon|pump|dump))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1] || match[2];
    if (!candidate) continue;
    const normalized = normalizeSymbol(candidate);
    if (normalized) matches.add(normalized);
  }
  return Array.from(matches);
}

export function extractKrTickerCandidates(text: string): string[] {
  const matches = new Set<string>();
  const regex = /\b(\d{6})\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1];
    if (!candidate) continue;
    const normalized = normalizeKrSymbol(candidate);
    if (normalized) matches.add(normalized);
  }
  return Array.from(matches);
}
