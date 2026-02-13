import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

interface BrandingBaseline {
  term: string;
  total: number;
  counts: Record<string, number>;
}

const BASELINE_PATH = "docs/DEEPSTOCK_REBRANDING_BASELINE.md";
const MARKER_START = "<!-- branding-baseline:start -->";
const MARKER_END = "<!-- branding-baseline:end -->";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readBaseline(): BrandingBaseline {
  const content = readFileSync(BASELINE_PATH, "utf8");
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`invalid_baseline_markers: ${BASELINE_PATH}`);
  }

  const block = content.slice(start + MARKER_START.length, end);
  const jsonMatch = block.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch?.[1]) {
    throw new Error(`missing_baseline_json_block: ${BASELINE_PATH}`);
  }

  const parsed = JSON.parse(jsonMatch[1]) as BrandingBaseline;
  if (!parsed.term || typeof parsed.total !== "number" || typeof parsed.counts !== "object") {
    throw new Error(`invalid_baseline_json_shape: ${BASELINE_PATH}`);
  }
  return parsed;
}

function collectCurrentCounts(term: string): { total: number; counts: Record<string, number> } {
  const list = spawnSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" });
  if (list.status !== 0) {
    const stderr = (list.stderr ?? "").trim();
    throw new Error(`git_ls_files_failed: ${stderr || "unknown_error"}`);
  }

  const files = (list.stdout ?? "")
    .split("\n")
    .map((line) => normalizePath(line.trim()))
    .filter((line) => line.length > 0 && line !== BASELINE_PATH);

  const matcher = new RegExp(escapeRegex(term), "i");
  const counts: Record<string, number> = {};
  for (const path of files) {
    let content = "";
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    if (content.includes("\u0000")) continue;
    const lineCount = content.split(/\r?\n/).reduce((acc, line) => (matcher.test(line) ? acc + 1 : acc), 0);
    if (lineCount > 0) counts[path] = lineCount;
  }

  const total = Object.values(counts).reduce((acc, value) => acc + value, 0);
  return { total, counts };
}

function main() {
  const baseline = readBaseline();
  const current = collectCurrentCounts(baseline.term);

  const unexpectedFiles: Array<{ path: string; current: number }> = [];
  const increasedFiles: Array<{ path: string; baseline: number; current: number }> = [];

  for (const [path, currentCount] of Object.entries(current.counts)) {
    const baselineCount = baseline.counts[path] ?? 0;
    if (baselineCount === 0) {
      unexpectedFiles.push({ path, current: currentCount });
      continue;
    }
    if (currentCount > baselineCount) {
      increasedFiles.push({ path, baseline: baselineCount, current: currentCount });
    }
  }

  if (unexpectedFiles.length > 0 || increasedFiles.length > 0) {
    console.error("[branding-check] FAILED");
    console.error(`term=${baseline.term}`);
    console.error(`baseline_total=${baseline.total} current_total=${current.total}`);

    if (unexpectedFiles.length > 0) {
      console.error("unexpected files:");
      for (const row of unexpectedFiles.sort((a, b) => a.path.localeCompare(b.path))) {
        console.error(`  - ${row.path}: ${row.current}`);
      }
    }

    if (increasedFiles.length > 0) {
      console.error("increased occurrences:");
      for (const row of increasedFiles.sort((a, b) => a.path.localeCompare(b.path))) {
        console.error(`  - ${row.path}: baseline=${row.baseline} current=${row.current}`);
      }
    }

    process.exit(1);
  }

  const decreased = Object.entries(baseline.counts)
    .filter(([path, baselineCount]) => (current.counts[path] ?? 0) < baselineCount)
    .map(([path, baselineCount]) => ({ path, baseline: baselineCount, current: current.counts[path] ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));

  console.log("[branding-check] PASSED");
  console.log(`term=${baseline.term}`);
  console.log(`baseline_total=${baseline.total} current_total=${current.total}`);
  if (decreased.length > 0) {
    console.log("decreased occurrences (good):");
    for (const row of decreased) {
      console.log(`  - ${row.path}: baseline=${row.baseline} current=${row.current}`);
    }
  }
}

main();
