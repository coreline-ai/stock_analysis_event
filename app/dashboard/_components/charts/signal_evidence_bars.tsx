import type { SignalScored } from "@/core/domain/types";
import { clamp01 } from "./utils";

interface SignalEvidenceBarsProps {
  signals: SignalScored[];
}

interface EvidenceMetricDef {
  key: string;
  label: string;
  help: string;
}

const METRIC_DEFS: EvidenceMetricDef[] = [
  { key: "감성", label: "감성 점수", help: "시장 반응이 긍정적인지 부정적인지" },
  { key: "신선도", label: "신선도", help: "뉴스/신호가 얼마나 최근 정보인지" },
  { key: "가중치", label: "소스 신뢰 가중치", help: "해당 출처를 얼마나 신뢰할지" },
  { key: "미국이벤트", label: "미국 이벤트 점수", help: "실적/공시/이벤트 영향도" },
  { key: "증거점수", label: "종합 증거 점수", help: "여러 근거를 합친 최종 강도" }
];

function parseReasonMetric(reasonSummary: string | null | undefined, key: string): number | null {
  if (!reasonSummary) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|,\\s*)${escaped}=(-?\\d+(?:\\.\\d+)?)`);
  const match = reasonSummary.match(regex);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function SignalEvidenceBars(props: SignalEvidenceBarsProps) {
  const metrics = METRIC_DEFS.map((metric) => {
    const values = props.signals
      .map((signal) => parseReasonMetric(signal.reasonSummary, metric.key))
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    const avg = average(values);
    return {
      ...metric,
      value: avg,
      normalized: clamp01(avg),
      samples: values.length
    };
  }).filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  if (metrics.length === 0) return null;

  return (
    <section className="chart-card" role="group" aria-label="시그널 근거 그래프">
      <div className="chart-head">
        <h4>시그널 근거 그래프</h4>
        <span className="badge-alt">근거 {props.signals.length}개 집계</span>
      </div>
      <p className="muted-line">
        선택한 판단에 연결된 시그널의 핵심 수치를 평균으로 시각화했습니다.
      </p>
      <div className="metric-list">
        {metrics.map((metric) => (
          <div className="mini-metric" key={metric.key} title={metric.help}>
            <div className="list-item-head">
              <strong>{metric.label}</strong>
              <span>{metric.value.toFixed(2)}</span>
            </div>
            <div className="gauge-track" aria-hidden="true">
              <div
                className="gauge-fill"
                style={{
                  width: `${Math.round(metric.normalized * 100)}%`,
                  background:
                    "linear-gradient(90deg, rgba(91,140,255,0.9), rgba(46,230,166,0.9))"
                }}
              />
            </div>
            <span className="muted-line">{metric.help} · {metric.samples}개 신호</span>
          </div>
        ))}
      </div>
    </section>
  );
}
