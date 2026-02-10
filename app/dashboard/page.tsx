import { listDecisions } from "@/adapters/db/repositories/decisions_repo";
import { listReports } from "@/adapters/db/repositories/daily_reports_repo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const hasDb = Boolean(process.env.DATABASE_URL);

  let decisions = [] as Awaited<ReturnType<typeof listDecisions>>;
  let reports = [] as Awaited<ReturnType<typeof listReports>>;
  let error = "";

  if (hasDb) {
    try {
      decisions = await listDecisions(20);
      reports = await listReports(5);
    } catch (err) {
      error = err instanceof Error ? err.message : "failed_to_load";
    }
  }

  const buyNow = decisions.filter((d) => d.verdict === "BUY_NOW");
  const watch = decisions.filter((d) => d.verdict === "WATCH");
  const avoid = decisions.filter((d) => d.verdict === "AVOID");

  return (
    <main className="page">
      <section className="hero">
        <div className="pill-row">
          <span className="pill">Dashboard</span>
          <span className="pill">Latest Runs</span>
          <span className="pill">Research-Only</span>
        </div>
        <h1 className="hero-title">Signal Overview</h1>
        <p className="hero-subtitle">Live view of latest decisions and daily reports.</p>

        <div className="grid grid-3">
          <div className="card kpi">
            <span className="badge">BUY_NOW</span>
            <strong>{buyNow.length}</strong>
            <span className="hero-subtitle">High conviction</span>
          </div>
          <div className="card kpi">
            <span className="badge badge-alt">WATCH</span>
            <strong>{watch.length}</strong>
            <span className="hero-subtitle">Monitor for triggers</span>
          </div>
          <div className="card kpi">
            <span className="badge" style={{ color: "#ff8b8b", background: "rgba(255,139,139,0.15)" }}>
              AVOID
            </span>
            <strong>{avoid.length}</strong>
            <span className="hero-subtitle">Risk or noise</span>
          </div>
        </div>
      </section>

      {error ? (
        <section className="card" style={{ marginTop: 24 }}>
          <h3>Data Error</h3>
          <p>{error}</p>
        </section>
      ) : null}

      {!hasDb ? (
        <section className="card" style={{ marginTop: 24 }}>
          <h3>Local Setup Needed</h3>
          <p>This dashboard reads from Postgres. Right now `DATABASE_URL` is not set.</p>
          <p>Fastest local path (docker + migrate + dev server):</p>
          <pre style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflowX: "auto" }}>
            <code>npm run dev:local</code>
          </pre>
          <p style={{ marginTop: 12 }}>
            After the server is up, trigger a run (auth required):
          </p>
          <pre style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflowX: "auto" }}>
            <code>
              {`curl -X POST http://localhost:3333/api/agent/trigger \\\n  -H 'x-api-token: dev-token'`}
            </code>
          </pre>
        </section>
      ) : null}

      <section>
        <h2 className="section-title">Latest Decisions</h2>
        <div className="list">
          {decisions.length === 0 ? (
            <div className="list-item">No decisions yet.</div>
          ) : (
            decisions.map((d) => (
              <div key={d.id} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{d.symbol}</strong>
                  <span className="badge">{d.verdict}</span>
                </div>
                <p style={{ marginTop: 6 }}>{d.thesisSummary}</p>
                <p className="hero-subtitle">Confidence: {Math.round(d.confidence * 100)}%</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">Daily Reports</h2>
        <div className="list">
          {reports.length === 0 ? (
            <div className="list-item">No reports yet.</div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="list-item">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{new Date(r.reportDate).toISOString().slice(0, 10)}</strong>
                  <span className="badge badge-alt">Report</span>
                </div>
                <p style={{ marginTop: 6 }}>{r.summaryMarkdown.slice(0, 140)}...</p>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="footer">Use /api/agent/trigger for manual runs. Cron runs on schedule.</p>
    </main>
  );
}
