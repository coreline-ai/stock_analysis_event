interface TripleCrownGateProps {
  socialLayerPassed?: boolean;
  eventLayerPassed?: boolean;
  hardFilterPassed?: boolean;
  volumeGuardPassed?: boolean;
  flowGuardPassed?: boolean;
  technicalGuardPassed?: boolean;
  tripleCrownPassed?: boolean;
  verdict?: "BUY_NOW" | "WATCH" | "AVOID";
}

function passText(value?: boolean): string {
  if (value === true) return "통과";
  if (value === false) return "미통과";
  return "미평가";
}

function buildFailures(props: TripleCrownGateProps): string[] {
  const reasons: string[] = [];
  if (props.socialLayerPassed === false) reasons.push("시장 반응 기준 미충족");
  if (props.eventLayerPassed === false) reasons.push("이벤트 기준 미충족");
  if (props.hardFilterPassed === false) reasons.push("기본 안전 기준 미충족");
  if (props.volumeGuardPassed === false) reasons.push("거래량 관문 실패");
  if (props.flowGuardPassed === false) reasons.push("수급 관문 실패");
  if (props.technicalGuardPassed === false) reasons.push("기술 관문 실패");
  if (reasons.length === 0) reasons.push("관문 이상 없음");
  return reasons;
}

export function TripleCrownGate(props: TripleCrownGateProps) {
  const quantGatePassed = props.hardFilterPassed === true;
  const failures = buildFailures(props);

  return (
    <section className={`chart-card ${props.tripleCrownPassed ? "triple-on" : ""}`} role="group" aria-label="3중 확인 관문 상태">
      <div className="chart-head">
        <h4>3중 확인 관문</h4>
        <span className="badge-alt">{props.tripleCrownPassed ? "3중 확인 충족" : "관문 점검"}</span>
      </div>

      <div className="step-row">
        <span className={`step-pill ${props.socialLayerPassed ? "on" : "off"}`}>시장 반응 {passText(props.socialLayerPassed)}</span>
        <span className={`step-pill ${props.eventLayerPassed ? "on" : "off"}`}>이벤트 {passText(props.eventLayerPassed)}</span>
        <span className={`step-pill ${quantGatePassed ? "on" : "off"}`}>기본 안전 {passText(quantGatePassed)}</span>
      </div>

      <div className="step-line">
        <div className={`step-line-seg ${props.socialLayerPassed ? "on" : ""}`} />
        <div className={`step-line-seg ${props.eventLayerPassed ? "on" : ""}`} />
        <div className={`step-line-seg ${quantGatePassed ? "on" : ""}`} />
      </div>

      {props.verdict && props.verdict !== "BUY_NOW" ? (
        <p className="muted-line">즉시 진입 미선정 이유: {failures.filter((item) => item !== "관문 이상 없음").join(", ") || "근거 데이터 부족"}</p>
      ) : null}
      <div className="tag-row">
        {failures.slice(0, 3).map((reason) => (
          <span key={reason} className={`tag ${reason === "관문 이상 없음" ? "" : "tag-risk"}`}>
            {reason}
          </span>
        ))}
      </div>
    </section>
  );
}
