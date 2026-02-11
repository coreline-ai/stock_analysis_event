const KR_BULLISH = [
  "급등",
  "상한가",
  "돌파",
  "신고가",
  "매수",
  "상승",
  "호재",
  "실적 개선",
  "턴어라운드",
  "저평가",
  "외국인 매수",
  "기관 매수",
  "수급 양호",
  "목표가 상향",
  "반등",
  "갭상승",
  "양봉"
];

const KR_BEARISH = [
  "급락",
  "하한가",
  "폭락",
  "손절",
  "매도",
  "하락",
  "악재",
  "실적 악화",
  "고평가",
  "외국인 매도",
  "기관 매도",
  "수급 악화",
  "목표가 하향",
  "음봉",
  "반대매매",
  "공매도"
];

export function detectSentimentKr(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;

  let bull = 0;
  let bear = 0;
  for (const keyword of KR_BULLISH) if (normalized.includes(keyword)) bull += 1;
  for (const keyword of KR_BEARISH) if (normalized.includes(keyword)) bear += 1;

  const total = bull + bear;
  if (total === 0) return 0;
  return (bull - bear) / total;
}
