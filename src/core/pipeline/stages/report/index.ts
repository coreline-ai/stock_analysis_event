import type { Decision, DailyReport } from "@/core/domain/types";
import { buildDailyReport } from "./daily_report";

export function generateReport(decisions: Decision[]): DailyReport {
  return buildDailyReport(decisions);
}
