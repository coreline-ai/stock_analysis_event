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
  if (value === true) return "PASS";
  if (value === false) return "FAIL";
  return "N/A";
}

function buildFailures(props: TripleCrownGateProps): string[] {
  const reasons: string[] = [];
  if (props.socialLayerPassed === false) reasons.push("소셜 레이어 미통과");
  if (props.eventLayerPassed === false) reasons.push("이벤트 레이어 미통과");
  if (props.hardFilterPassed === false) reasons.push("퀀트 하드필터 미충족");
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
    <section className={`chart-card ${props.tripleCrownPassed ? "triple-on" : ""}`} role="group" aria-label="삼관왕 관문 상태">
      <div className="chart-head">
        <h4>삼관왕 관문</h4>
        <span className="badge-alt">{props.tripleCrownPassed ? "Triple Crown" : "Gate Check"}</span>
      </div>

      <div className="step-row">
        <span className={`step-pill ${props.socialLayerPassed ? "on" : "off"}`}>관 {passText(props.socialLayerPassed)}</span>
        <span className={`step-pill ${props.eventLayerPassed ? "on" : "off"}`}>모 {passText(props.eventLayerPassed)}</span>
        <span className={`step-pill ${quantGatePassed ? "on" : "off"}`}>신 {passText(quantGatePassed)}</span>
      </div>

      <div className="step-line">
        <div className={`step-line-seg ${props.socialLayerPassed ? "on" : ""}`} />
        <div className={`step-line-seg ${props.eventLayerPassed ? "on" : ""}`} />
        <div className={`step-line-seg ${quantGatePassed ? "on" : ""}`} />
      </div>

      {props.verdict && props.verdict !== "BUY_NOW" ? (
        <p className="muted-line">BUY_NOW 미달 사유: {failures.filter((item) => item !== "관문 이상 없음").join(", ") || "근거 데이터 부족"}</p>
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
