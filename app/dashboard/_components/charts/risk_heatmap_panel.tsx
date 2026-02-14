import { buildRiskTags, clamp01 } from "./utils";

interface RiskHeatmapPanelProps {
  contextRiskScore?: number;
  socialScore?: number;
  eventScore?: number;
  volumeScore?: number;
  flowScore?: number;
  technicalScore?: number;
  volumeGuardPassed?: boolean;
  flowGuardPassed?: boolean;
  technicalGuardPassed?: boolean;
}

function riskLevel(score: number): "낮음" | "중간" | "높음" {
  if (score < 0.35) return "낮음";
  if (score < 0.7) return "중간";
  return "높음";
}

export function RiskHeatmapPanel(props: RiskHeatmapPanelProps) {
  // Composite risk = context risk + score deficits + guard failures.
  // This avoids over-clustering around a single value when guard states are similar.
  const contextRisk = clamp01(props.contextRiskScore ?? 0);
  const socialScore = clamp01(props.socialScore ?? 0);
  const eventScore = clamp01(props.eventScore ?? 0);
  const volumeScore = clamp01(props.volumeScore ?? 0);
  const flowScore = clamp01(props.flowScore ?? 0);
  const technicalScore = clamp01(props.technicalScore ?? 0);

  let displayRisk = contextRisk * 0.45;
  displayRisk += (1 - volumeScore) * 0.2;
  displayRisk += (1 - flowScore) * 0.15;
  displayRisk += (1 - technicalScore) * 0.1;
  displayRisk += (1 - eventScore) * 0.05;
  displayRisk += (1 - socialScore) * 0.05;

  if (props.volumeGuardPassed === false) displayRisk += 0.03;
  if (props.flowGuardPassed === false) displayRisk += 0.03;
  if (props.technicalGuardPassed === false) displayRisk += 0.03;

  const risk = clamp01(displayRisk);
  const level = riskLevel(risk);
  const tags = buildRiskTags(props);

  return (
    <section className="chart-card" role="group" aria-label="리스크 히트맵">
      <div className="chart-head">
        <h4>리스크 히트맵</h4>
        <span className={`badge ${level === "높음" ? "badge-red" : "badge-alt"}`}>{level}</span>
      </div>
      <div className="heatmap-track">
        <div className="heatmap-marker" style={{ left: `${risk * 100}%` }} />
      </div>
      <p className="muted-line">
        종합 리스크: {risk.toFixed(2)} <span className="muted-sub">(컨텍스트: {contextRisk.toFixed(2)})</span>
      </p>
      <div className="tag-row">
        {tags.map((tag) => (
          <span key={tag} className={`tag ${tag === "특이 리스크 없음" ? "" : "tag-risk"}`}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
