export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <div className="pill-row">
          <span className="pill">Research-Only</span>
          <span className="pill">No Trade Execution</span>
          <span className="pill">Vercel Ready</span>
        </div>
        <h1 className="hero-title">Mahoraga Signal & Timing Engine</h1>
        <p className="hero-subtitle">
          Automated signal gathering, scoring, and decision summaries without any broker execution. Built for
          research-grade timing insights.
        </p>
        <div className="grid grid-3">
          <div className="card">
            <h3>Signals</h3>
            <p>Reddit, StockTwits, SEC, News, Crypto — weighted, normalized, and stored for reproducibility.</p>
          </div>
          <div className="card">
            <h3>Decisions</h3>
            <p>BUY_NOW / WATCH / AVOID with confidence, entry triggers, and invalidation criteria.</p>
          </div>
          <div className="card">
            <h3>Reports</h3>
            <p>Daily summaries with themes and risks, ready for dashboard review or export.</p>
          </div>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 28 }}>
        <div className="card">
          <h3>Quick Links</h3>
          <p>/api/health — health check</p>
          <p>/dashboard — internal dashboard</p>
          <p>/api/agent/trigger — manual run (auth required)</p>
        </div>
        <div className="card">
          <h3>Safety Guardrails</h3>
          <p>Any broker-related env key triggers boot failure. This system is research-only by design.</p>
        </div>
      </section>

      <p className="footer">Powered by modular pipeline stages and strict execution boundaries.</p>
    </main>
  );
}
