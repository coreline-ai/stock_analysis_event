import { clamp01 } from "./utils";

interface EnergyGaugeProps {
  volumeScore?: number;
}

function zoneLabel(score: number): "저활성" | "관찰" | "폭발" {
  if (score < 0.4) return "저활성";
  if (score < 0.75) return "관찰";
  return "폭발";
}

export function EnergyGauge(props: EnergyGaugeProps) {
  const score = clamp01(props.volumeScore ?? 0);
  const percent = score * 100;
  const zone = zoneLabel(score);

  return (
    <section className="chart-card" role="meter" aria-label="VSI 에너지 게이지" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div className="chart-head">
        <h4>VSI 에너지</h4>
        <span className="badge-alt">{zone}</span>
      </div>
      <div className="gauge-track">
        <div className={`gauge-fill ${zone === "폭발" ? "high" : zone === "관찰" ? "mid" : "low"}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="muted-line">거래량 폭발 지수: {score.toFixed(2)} ({Math.round(percent)}%)</p>
      <div className="mini-grid">
        <div className="mini-metric"><span>0.00~0.39</span><strong>저활성</strong></div>
        <div className="mini-metric"><span>0.40~0.74</span><strong>관찰</strong></div>
        <div className="mini-metric"><span>0.75~1.00</span><strong>폭발</strong></div>
      </div>
    </section>
  );
}
