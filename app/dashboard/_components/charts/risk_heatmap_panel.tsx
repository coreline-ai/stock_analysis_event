import { buildRiskTags, clamp01 } from "./utils";

interface RiskHeatmapPanelProps {
  contextRiskScore?: number;
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
  // Calculate a composite risk score for display
  // Base: Context Risk (active dangers)
  // Penalty: Failed hard filters (passive dangers/missing requirements)
  let displayRisk = props.contextRiskScore ?? 0;
  if (props.volumeGuardPassed === false) displayRisk += 0.15;
  if (props.flowGuardPassed === false) displayRisk += 0.15;
  if (props.technicalGuardPassed === false) displayRisk += 0.15;

  const risk = clamp01(displayRisk);
  const contextRisk = props.contextRiskScore ?? 0;
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
        종합 리스크: {risk.toFixed(2)} <span style={{ opacity: 0.7, fontSize: "0.8em" }}>(컨텍스트: {contextRisk.toFixed(2)})</span>
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
