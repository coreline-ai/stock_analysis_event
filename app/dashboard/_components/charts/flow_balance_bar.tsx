import { clamp01 } from "./utils";

interface FlowBalanceBarProps {
  flowScore?: number;
  socialScore?: number;
}

export function FlowBalanceBar(props: FlowBalanceBarProps) {
  const flow = clamp01(props.flowScore ?? 0);
  const social = clamp01(props.socialScore ?? 0);
  const gap = social - flow;
  const warning = gap > 0.25;

  return (
    <section className="chart-card" role="group" aria-label="스마트 머니 수급 밸런스">
      <div className="chart-head">
        <h4>관심 대비 수급</h4>
        <span className="badge-alt">차이 {gap.toFixed(2)}</span>
      </div>
      <div className="flow-track">
        <div className="flow-social" style={{ width: `${social * 100}%` }} />
        <div className="flow-money" style={{ width: `${flow * 100}%` }} />
      </div>
      <div className="mini-grid">
        <div className="mini-metric">
          <span>관심도(시장 반응)</span>
          <strong>{social.toFixed(2)}</strong>
        </div>
        <div className="mini-metric">
          <span>실수급(매수 유입)</span>
          <strong>{flow.toFixed(2)}</strong>
        </div>
      </div>
      {warning ? <span className="tag tag-risk">관심 대비 실수급 부족</span> : <span className="tag">수급 균형 양호</span>}
    </section>
  );
}
