import type { DailyReport, MarketScope } from "@/core/domain/types";
import { clamp01 } from "./utils";

interface ParsedReportSummary {
  total: number;
  buyNow: number;
  watch: number;
  avoid: number;
  avgConfidence: number;
  placeholderCount: number;
  quant?: number;
  social?: number;
  event?: number;
  contextRisk?: number;
  hardPass?: number;
  hardTotal?: number;
  triplePass?: number;
  tripleTotal?: number;
}

interface ParsedEvidenceSignal {
  symbol: string;
  score: number;
  metrics: Record<string, number>;
}

interface ReportSummaryPanelProps {
  report: DailyReport;
  marketScope?: MarketScope;
  krSymbolNames?: Record<string, string>;
  usSymbolNames?: Record<string, string>;
}

interface EvidenceMetricDef {
  key: string;
  label: string;
  help: string;
}

const EVIDENCE_METRIC_DEFS: EvidenceMetricDef[] = [
  { key: "감성", label: "감성 점수", help: "시장 반응의 긍정/부정 정도" },
  { key: "신선도", label: "신선도", help: "신호의 최신성" },
  { key: "가중치", label: "소스 가중치", help: "출처별 신뢰도 가중치" },
  { key: "미국이벤트", label: "미국 이벤트", help: "실적/공시/이벤트 반영 점수" },
  { key: "이벤트", label: "이벤트", help: "종목 이벤트 반영 점수" },
  { key: "증거점수", label: "종합 증거", help: "종합 근거 강도" }
];

function parseIntSafe(input: string | undefined, fallback = 0): number {
  const parsed = Number(input ?? "");
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function parseFloatSafe(input: string | undefined, fallback = 0): number {
  const parsed = Number(input ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSummary(markdown: string, report: DailyReport): ParsedReportSummary {
  const distMatch =
    markdown.match(/즉시 진입\(BUY_NOW\):\s*(\d+),\s*관망\(WATCH\):\s*(\d+),\s*회피\(AVOID\):\s*(\d+)/) ??
    markdown.match(/즉시 진입:\s*(\d+),\s*관망:\s*(\d+),\s*회피:\s*(\d+)/);
  const buyNow = parseIntSafe(distMatch?.[1], report.topBuyNow.length);
  const watch = parseIntSafe(distMatch?.[2], report.topWatch.length);
  const avoidFromLine = parseIntSafe(distMatch?.[3], -1);

  const totalMatch = markdown.match(/총 판단 종목:\s*(\d+)/);
  const totalFallback = buyNow + watch + Math.max(0, avoidFromLine);
  const total = parseIntSafe(totalMatch?.[1], totalFallback);
  const avoid = avoidFromLine >= 0 ? avoidFromLine : Math.max(0, total - buyNow - watch);

  const confidenceMatch = markdown.match(/평균 (?:신뢰도|확신도):\s*([0-9.]+)%/);
  const avgConfidence = parseFloatSafe(confidenceMatch?.[1], 0);

  const placeholderMatch = markdown.match(/(?:임시값 응답 수|placeholder 응답 수\(stub\/tbd\)):\s*(\d+)/i);
  const placeholderCount = parseIntSafe(placeholderMatch?.[1], 0);

  const hybridMatch =
    markdown.match(/혼합 요약:\s*정량\s*([0-9.]+),\s*시장반응\s*([0-9.]+),\s*이벤트\s*([0-9.]+),\s*과열위험\s*([0-9.]+)/) ??
    markdown.match(/하이브리드 요약:\s*quant=([0-9.]+),\s*social=([0-9.]+),\s*event=([0-9.]+),\s*contextRisk=([0-9.]+)/);

  const gateMatch =
    markdown.match(/안전장치 통과:\s*기본 안전필터\s*(\d+)\/(\d+),\s*3중 조건\s*(\d+)\/(\d+)/) ??
    markdown.match(/강화 조건 통과:\s*hard filter=(\d+)\/(\d+),\s*triple crown=(\d+)\/(\d+)/);

  return {
    total,
    buyNow,
    watch,
    avoid,
    avgConfidence,
    placeholderCount,
    quant: hybridMatch ? parseFloatSafe(hybridMatch[1]) : undefined,
    social: hybridMatch ? parseFloatSafe(hybridMatch[2]) : undefined,
    event: hybridMatch ? parseFloatSafe(hybridMatch[3]) : undefined,
    contextRisk: hybridMatch ? parseFloatSafe(hybridMatch[4]) : undefined,
    hardPass: gateMatch ? parseIntSafe(gateMatch[1]) : undefined,
    hardTotal: gateMatch ? parseIntSafe(gateMatch[2]) : undefined,
    triplePass: gateMatch ? parseIntSafe(gateMatch[3]) : undefined,
    tripleTotal: gateMatch ? parseIntSafe(gateMatch[4]) : undefined
  };
}

function ratio(part: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, part / total));
}

function parseEvidenceSignals(markdown: string): ParsedEvidenceSignal[] {
  const rows: ParsedEvidenceSignal[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[([^\]]+)\]\s*score=([0-9.]+)\s*(?:\(([^)]*)\))?\s*(.*)$/);
    if (!match) continue;
    const score = Number(match[2]);
    if (!Number.isFinite(score)) continue;
    const metricSource = [match[3] ?? "", match[4] ?? ""].join(", ");
    const metrics: Record<string, number> = {};
    const metricRegex = /([가-힣A-Za-z_]+)\s*=\s*(-?\d+(?:\.\d+)?)/g;
    let metricMatch: RegExpExecArray | null = null;
    while ((metricMatch = metricRegex.exec(metricSource)) !== null) {
      const key = metricMatch[1];
      const value = Number(metricMatch[2]);
      if (Number.isFinite(value)) metrics[key] = value;
    }
    rows.push({
      symbol: match[1].trim(),
      score,
      metrics
    });
  }
  return rows;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function isKrTickerCode(symbol: string): boolean {
  return /^\d{6}$/.test(symbol.trim());
}

function isUsTickerSymbol(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol.trim().toUpperCase());
}

function formatEvidenceSymbol(
  symbol: string,
  marketScope: MarketScope | undefined,
  krSymbolNames: Record<string, string>,
  usSymbolNames: Record<string, string>
): string {
  const trimmed = symbol.trim();
  if (!trimmed) return "-";
  if (trimmed.includes("(") && trimmed.includes(")")) return trimmed;
  if (isKrTickerCode(trimmed)) {
    const name = krSymbolNames[trimmed];
    return name ? `${trimmed} (${name})` : trimmed;
  }
  const upper = trimmed.toUpperCase();
  if (isUsTickerSymbol(upper) || marketScope === "US") {
    const name = usSymbolNames[upper];
    return name ? `${upper} (${name})` : upper;
  }
  return trimmed;
}

function classifyStrength(score: number): { label: "약" | "중간" | "강"; className: "weak" | "mid" | "strong" } {
  const normalized = clamp01(score / 1.5);
  if (normalized >= 0.55) return { label: "강", className: "strong" };
  if (normalized >= 0.3) return { label: "중간", className: "mid" };
  return { label: "약", className: "weak" };
}

export function ReportSummaryPanel(props: ReportSummaryPanelProps) {
  const parsed = parseSummary(props.report.summaryMarkdown, props.report);
  const evidenceSignals = parseEvidenceSignals(props.report.summaryMarkdown);
  const krSymbolNames = props.krSymbolNames ?? {};
  const usSymbolNames = props.usSymbolNames ?? {};
  const scoreScaleHint = "score는 0.00~1.50 범위이며, 높을수록 근거 강도가 큽니다.";
  const total = Math.max(1, parsed.total);
  const buyPct = ratio(parsed.buyNow, total) * 100;
  const watchPct = ratio(parsed.watch, total) * 100;
  const avoidPct = Math.max(0, 100 - buyPct - watchPct);
  const hardPct = ratio(parsed.hardPass ?? 0, parsed.hardTotal ?? 0) * 100;
  const triplePct = ratio(parsed.triplePass ?? 0, parsed.tripleTotal ?? 0) * 100;
  const evidenceMetricRows = EVIDENCE_METRIC_DEFS.map((metric) => {
    const values = evidenceSignals
      .map((signal) => signal.metrics[metric.key])
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    const value = average(values);
    return {
      ...metric,
      value,
      samples: values.length
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));

  const hybridRows = [
    { key: "quant", label: "숫자 근거", value: parsed.quant },
    { key: "social", label: "시장 반응", value: parsed.social },
    { key: "event", label: "이벤트", value: parsed.event },
    { key: "risk", label: "과열 위험", value: parsed.contextRisk }
  ].filter((row): row is { key: string; label: string; value: number } => typeof row.value === "number");

  return (
    <section className="chart-card" role="group" aria-label="리포트 요약 그래프">
      <div className="chart-head">
        <h4>리포트 요약 그래프</h4>
        <span className="badge-alt">평균 확신도 {parsed.avgConfidence.toFixed(1)}%</span>
      </div>

      <div className="stacked-bar" aria-label="판단 비율">
        <span className="seg buy" style={{ width: `${buyPct}%` }}>
          즉시 {Math.round(buyPct)}%
        </span>
        <span className="seg watch" style={{ width: `${watchPct}%` }}>
          관망 {Math.round(watchPct)}%
        </span>
        <span className="seg avoid" style={{ width: `${avoidPct}%` }}>
          회피 {Math.round(avoidPct)}%
        </span>
      </div>

      <div className="mini-grid">
        <div className="mini-metric">
          <span>총 판단 종목</span>
          <strong>{parsed.total}</strong>
        </div>
        <div className="mini-metric">
          <span>즉시 / 관망 / 회피</span>
          <strong>{parsed.buyNow} / {parsed.watch} / {parsed.avoid}</strong>
        </div>
        <div className="mini-metric">
          <span>임시값 응답</span>
          <strong>{parsed.placeholderCount}</strong>
        </div>
      </div>

      {hybridRows.length > 0 ? (
        <div className="metric-list">
          {hybridRows.map((row) => (
            <div className="mini-metric" key={row.key}>
              <div className="list-item-head">
                <span>{row.label}</span>
                <strong>{row.value.toFixed(2)}</strong>
              </div>
              <div className="gauge-track">
                <div className="gauge-fill mid" style={{ width: `${Math.round(Math.max(0, Math.min(1, row.value)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {typeof parsed.hardPass === "number" && typeof parsed.hardTotal === "number" ? (
        <div className="metric-list">
          <div className="mini-metric">
            <div className="list-item-head">
              <span>기본 안전필터 통과</span>
              <strong>
                {parsed.hardPass}/{parsed.hardTotal}
              </strong>
            </div>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${Math.round(hardPct)}%` }} />
            </div>
          </div>
          <div className="mini-metric">
            <div className="list-item-head">
              <span>3중 조건 통과</span>
              <strong>
                {parsed.triplePass ?? 0}/{parsed.tripleTotal ?? 0}
              </strong>
            </div>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${Math.round(triplePct)}%` }} />
            </div>
          </div>
        </div>
      ) : null}

      {evidenceSignals.length > 0 ? (
        <section className="chart-card" role="group" aria-label="근거 시그널 그래프">
          <div className="chart-head">
            <h4>근거 시그널 그래프</h4>
            <span className="badge-alt">근거 {evidenceSignals.length}개</span>
          </div>
          <p className="muted-line">
            리포트 본문의 근거 시그널 수치를 자동으로 집계해 시각화했습니다. (score 스케일 0.00~1.50)
          </p>
          <p className="muted-line">강도 기준: 약(0~0.45) · 중간(0.45~0.82) · 강(0.82~1.50)</p>
          <div className="metric-list">
            {evidenceSignals.slice(0, 8).map((signal, index) => {
              const strength = classifyStrength(signal.score);
              return (
                <div className="mini-metric" key={`${signal.symbol}-${index}`}>
                  <div className="list-item-head">
                    <strong>{formatEvidenceSymbol(signal.symbol, props.marketScope, krSymbolNames, usSymbolNames)}</strong>
                    <span title={scoreScaleHint}>score {signal.score.toFixed(3)}</span>
                  </div>
                  <div className="list-item-head">
                    <span className={`badge evidence-strength evidence-strength-${strength.className}`}>{strength.label}</span>
                  </div>
                  <div className="gauge-track" aria-hidden="true">
                    <div
                      className="gauge-fill mid"
                      style={{ width: `${Math.round(clamp01(signal.score / 1.5) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {evidenceMetricRows.length > 0 ? (
            <div className="metric-list">
              {evidenceMetricRows.map((metric) => (
                <div className="mini-metric" key={metric.key} title={metric.help}>
                  <div className="list-item-head">
                    <strong>{metric.label}</strong>
                    <span>{metric.value.toFixed(2)}</span>
                  </div>
                  <div className="gauge-track" aria-hidden="true">
                    <div
                      className="gauge-fill"
                      style={{
                        width: `${Math.round(clamp01(metric.value) * 100)}%`,
                        background: "linear-gradient(90deg, rgba(91,140,255,0.9), rgba(46,230,166,0.9))"
                      }}
                    />
                  </div>
                  <span className="muted-line">{metric.help} · {metric.samples}개</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
