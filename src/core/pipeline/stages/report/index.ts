import type { Decision, DailyReport, MarketScope, SignalScored } from "@/core/domain/types";
import { buildDailyReport } from "./daily_report";

export function generateReport(
  decisions: Decision[],
  scoredSignals: SignalScored[] = [],
  marketScope: MarketScope = "US"
): DailyReport {
  return buildDailyReport(decisions, scoredSignals, marketScope);
}
