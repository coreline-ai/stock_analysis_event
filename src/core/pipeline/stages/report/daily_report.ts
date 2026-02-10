import type { Decision, DailyReport } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";

export function buildDailyReport(decisions: Decision[]): DailyReport {
  const buyNow = decisions.filter((d) => d.verdict === "BUY_NOW");
  const watch = decisions.filter((d) => d.verdict === "WATCH");

  const lines: string[] = [];
  lines.push(`# Daily Report (${new Date().toISOString().slice(0, 10)})`);
  lines.push("");
  lines.push("## BUY_NOW");
  lines.push(buyNow.length ? buyNow.map((d) => `- ${d.symbol}: ${d.thesisSummary}`).join("\n") : "- None");
  lines.push("");
  lines.push("## WATCH");
  lines.push(watch.length ? watch.map((d) => `- ${d.symbol}: ${d.thesisSummary}`).join("\n") : "- None");
  lines.push("");
  lines.push("## Themes");
  lines.push("- TBD");
  lines.push("");
  lines.push("## Risks");
  lines.push("- TBD");

  return {
    reportDate: new Date().toISOString().slice(0, 10),
    summaryMarkdown: lines.join("\n"),
    topBuyNow: buyNow.map((d) => d.id || "").filter(Boolean),
    topWatch: watch.map((d) => d.id || "").filter(Boolean),
    themes: [],
    risks: [],
    createdAt: nowIso()
  };
}
