import PublicHealthCard from "./_components/public_health_card";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <div className="pill-row">
          <span className="pill">리서치 전용</span>
          <span className="pill">실거래 실행 없음</span>
          <span className="pill">Vercel 배포 준비</span>
        </div>
        <h1 className="hero-title">시그널·타이밍 리서치 엔진</h1>
        <p className="hero-subtitle">
          브로커 실행 없이 시그널 수집, 점수화, 판단 요약을 자동화합니다. 리서치 품질의 타이밍 인사이트를
          제공합니다.
        </p>
        <div className="grid grid-3">
          <div className="card">
            <h3>신호</h3>
            <p>Reddit, StockTwits, SEC, 뉴스, 크립토 데이터를 가중치/정규화 후 저장하여 재현성을 확보합니다.</p>
          </div>
          <div className="card">
            <h3>판단</h3>
            <p>즉시진입(BUY_NOW) / 관망(WATCH) / 회피(AVOID)를 신뢰도, 진입 조건, 무효화 조건과 함께 제공합니다.</p>
          </div>
          <div className="card">
            <h3>리포트</h3>
            <p>테마와 리스크를 포함한 일일 요약을 제공하며 대시보드 검토 및 내보내기를 지원합니다.</p>
          </div>
        </div>
        <div className="button-row">
          <a className="link-button" href="/dashboard">
            GUI 대시보드 열기
          </a>
          <a className="link-button ghost" href="/dashboard/settings">
            설정 가이드
          </a>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 28 }}>
        <div className="card">
          <h3>빠른 링크</h3>
          <p>/api/health — 상태 확인</p>
          <p>/dashboard — 내부 대시보드</p>
          <p>/api/agent/trigger — 수동 실행 (운영 환경 인증 필요)</p>
        </div>
        <PublicHealthCard />
        <div className="card">
          <h3>안전 가드레일</h3>
          <p>브로커 관련 env 키가 있으면 부팅이 차단됩니다. 이 시스템은 리서치 전용으로 설계되었습니다.</p>
        </div>
      </section>

      <p className="footer">모듈형 파이프라인 단계와 엄격한 실행 경계 기반으로 동작합니다.</p>
    </main>
  );
}
