import { clamp01 } from "./utils";

interface StackedWeightBarProps {
  socialScore?: number;
  eventScore?: number;
  quantScore?: number;
  quantMultiplier?: number;
  finalScore?: number;
}

export function StackedWeightBar(props: StackedWeightBarProps) {
  const social = clamp01(props.socialScore ?? 0) * 0.35;
  const event = clamp01(props.eventScore ?? 0) * 0.25;
  const quant = clamp01(props.quantScore ?? 0) * 0.4;
  const baseTotal = social + event + quant;
  const normalizedTotal = baseTotal <= 0 ? 1 : baseTotal;
  const multiplier = props.quantMultiplier ?? 1;
  const estimated = clamp01(baseTotal * multiplier);
  const finalScore = typeof props.finalScore === "number" ? clamp01(props.finalScore) : estimated;

  const socialPct = social / normalizedTotal * 100;
  const eventPct = event / normalizedTotal * 100;
  const quantPct = quant / normalizedTotal * 100;
  const socialBubble = socialPct >= 55 && quantPct <= 25;
  const delta = finalScore - estimated;

  return (
    <section className="chart-card" role="group" aria-label="융합 가중치 분해 막대">
      <div className="chart-head">
        <h4>융합 가중치</h4>
        <span className="badge-alt">Final {finalScore.toFixed(2)}</span>
      </div>
      <div className="stacked-bar" aria-label="social event quant 누적 막대">
        <span className="seg social" style={{ width: `${socialPct}%` }}>S {Math.round(socialPct)}%</span>
        <span className="seg event" style={{ width: `${eventPct}%` }}>E {Math.round(eventPct)}%</span>
        <span className="seg quant" style={{ width: `${quantPct}%` }}>Q {Math.round(quantPct)}%</span>
      </div>
      <div className="mini-grid">
        <div className="mini-metric">
          <span>Quant 승수</span>
          <strong>{multiplier.toFixed(2)}x</strong>
        </div>
        <div className="mini-metric">
          <span>정합성 Δ</span>
          <strong>{delta >= 0 ? "+" : ""}{delta.toFixed(2)}</strong>
        </div>
      </div>
      {socialBubble ? <span className="tag tag-risk">소셜 거품</span> : null}
    </section>
  );
}
