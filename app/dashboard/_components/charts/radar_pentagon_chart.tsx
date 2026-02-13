import { analyzeRadarPattern, clamp01 } from "./utils";

interface RadarPentagonChartProps {
  socialScore?: number;
  eventScore?: number;
  volumeScore?: number;
  flowScore?: number;
  technicalScore?: number;
}

interface AxisPoint {
  key: string;
  label: string;
  value: number;
}

function interpretAxisScore(value: number): string {
  if (value < 0.35) return "약함";
  if (value < 0.7) return "중립";
  return "강함";
}

function buildPoints(axes: AxisPoint[], center: number, radius: number): string {
  return axes
    .map((axis, idx) => {
      const angle = -Math.PI / 2 + idx * (2 * Math.PI / axes.length);
      const x = center + Math.cos(angle) * radius * axis.value;
      const y = center + Math.sin(angle) * radius * axis.value;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function RadarPentagonChart(props: RadarPentagonChartProps) {
  const axes: AxisPoint[] = [
    { key: "social", label: "Social", value: clamp01(props.socialScore ?? 0) },
    { key: "event", label: "Event", value: clamp01(props.eventScore ?? 0) },
    { key: "volume", label: "Volume", value: clamp01(props.volumeScore ?? 0) },
    { key: "flow", label: "Flow", value: clamp01(props.flowScore ?? 0) },
    { key: "technical", label: "Tech", value: clamp01(props.technicalScore ?? 0) }
  ];
  const center = 90;
  const radius = 70;
  const dataPath = buildPoints(axes, center, radius);
  const insights = analyzeRadarPattern({
    socialScore: props.socialScore,
    eventScore: props.eventScore,
    volumeScore: props.volumeScore,
    flowScore: props.flowScore
  });

  return (
    <section className="chart-card" role="img" aria-label="5대 정량 지표 레이더 차트">
      <div className="chart-head">
        <h4>정량 레이더</h4>
        <span className="badge-alt">5대 지표</span>
      </div>
      <svg viewBox="0 0 180 180" className="radar-svg">
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
            key={level}
            points={buildPoints(axes.map((axis) => ({ ...axis, value: level })), center, radius)}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />
        ))}
        {axes.map((axis, idx) => {
          const angle = -Math.PI / 2 + idx * (2 * Math.PI / axes.length);
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const lx = center + Math.cos(angle) * (radius + 14);
          const ly = center + Math.sin(angle) * (radius + 14);
          return (
            <g key={axis.key}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" fontSize={9} fill="rgba(230,236,245,0.85)">
                {axis.label}
              </text>
              <title>{`${axis.label}: ${axis.value.toFixed(2)} (${interpretAxisScore(axis.value)})`}</title>
            </g>
          );
        })}
        <polygon points={dataPath} fill="rgba(91,140,255,0.28)" stroke="#5b8cff" strokeWidth={2}>
          <title>{`레이더 종합: ${axes.map((axis) => `${axis.label} ${axis.value.toFixed(2)}`).join(", ")}`}</title>
        </polygon>
      </svg>
      <div className="mini-grid" aria-label="레이더 점수 상세">
        {axes.map((axis) => (
          <div
            key={axis.key}
            className="mini-metric"
            title={`${axis.label} 원점수 ${axis.value.toFixed(2)} / 해석 ${interpretAxisScore(axis.value)}`}
          >
            <span>{axis.label}</span>
            <strong>{axis.value.toFixed(2)}</strong>
          </div>
        ))}
      </div>
      <div className="tag-row">
        {insights.map((hint) => (
          <span key={hint} className={`tag ${hint === "허수 경고" ? "tag-risk" : ""}`}>
            {hint}
          </span>
        ))}
      </div>
    </section>
  );
}
