import { chromium, webkit, type BrowserType, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { ensureGuiTestServer } from "./gui_test_server";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3333";
const TOKEN = process.env.DEEPSTOCK_API_TOKEN ?? process.env.API_TOKEN ?? "dev-token";

function seedToken(token: string) {
  window.sessionStorage.setItem("deepstock_api_token", token);
  window.sessionStorage.setItem("api_token", token);
}

async function waitDashboardLoaded(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.getByText("운영 현황").waitFor({ timeout: 30_000 });
}

async function runA11y(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const violations = results.violations;
  const ids = violations.map((v) => v.id).join(", ");
  console.log(`[a11y] ${label} violations=${violations.length}${ids ? ` ids=${ids}` : ""}`);
  return violations.length;
}

async function runViewportMatrix(name: string, browserType: BrowserType) {
  const browser = await browserType.launch({ headless: true });
  const viewports = [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 }
  ];
  const routes = [
    "/dashboard",
    "/dashboard/decisions",
    "/dashboard/reports",
    "/dashboard/runs",
    "/dashboard/signals",
    "/dashboard/settings"
  ];

  let violations = 0;
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addInitScript(seedToken, TOKEN);
    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);
      violations += await runA11y(page, `${name}:${vp.name}:${route}`);
    }
    await context.close();
  }

  await browser.close();
  return violations;
}

async function runScenarioE2E() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(seedToken, TOKEN);
  const page = await context.newPage();

  await waitDashboardLoaded(page);
  await page.getByLabel("API 토큰 입력").fill(TOKEN);
  await page.getByRole("button", { name: "저장" }).click();

  async function waitTriggerOutcome(timeoutMs: number): Promise<"toast" | "auth" | "progress"> {
    const authModal = page.getByText("인증 필요");
    const progressCard = page.locator(".run-progress-card").first();
    const outcome = await Promise.race([
      authModal
        .waitFor({ timeout: timeoutMs })
        .then(() => "auth" as const)
        .catch(() => "none" as const),
      progressCard
        .waitFor({ timeout: timeoutMs })
        .then(() => "progress" as const)
        .catch(() => "none" as const),
      page
        .waitForSelector(".toast.success, .toast.info, .toast.error", { timeout: timeoutMs })
        .then(() => "toast" as const)
        .catch(() => "none" as const)
    ]);
    if (outcome === "auth") {
      await page.getByRole("button", { name: "닫기" }).click();
      return "auth";
    }
    if (outcome === "progress") return "progress";
    if (outcome === "toast") return "toast";
    throw new Error("Neither auth modal, progress, nor toast appeared after trigger");
  }

  await page.getByRole("button", { name: /미국 분석 실행/ }).click();
  await waitTriggerOutcome(60_000);

  // Consecutive trigger scenario.
  await page.getByRole("button", { name: /미국 분석 실행/ }).click();
  await waitTriggerOutcome(20_000);

  await page.goto(`${BASE_URL}/dashboard/decisions`);
  await page.getByPlaceholder("TSLA").fill("A");
  const hasDecisionList = await page
    .waitForSelector(".list-item.as-button", { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (hasDecisionList) {
    await page.locator(".list-item.as-button").first().click();
    await page.getByRole("link", { name: "관련 신호 보기" }).click();
    await page.waitForURL(/\/dashboard\/signals/);
  } else {
    await page.getByText("목록에서 판단을 선택하세요.").waitFor({ timeout: 20_000 });
  }

  await page.goto(`${BASE_URL}/dashboard/reports`);
  const hasReportList = await page
    .waitForSelector(".list-item.as-button", { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (hasReportList) {
    await page.locator(".list-item.as-button").first().click();
    await page.getByText("리포트", { exact: false }).first().waitFor();
  } else {
    await page.getByText("리포트를 선택하세요.").waitFor({ timeout: 20_000 });
  }

  await page.goto(`${BASE_URL}/dashboard/runs`);
  await page.getByRole("button", { name: "지우기" }).click();
  await page.getByRole("button", { name: /미국 분석 실행/ }).click();
  await waitTriggerOutcome(30_000);

  await page.goto(`${BASE_URL}/dashboard/signals?tab=scored`);
  await page.getByRole("button", { name: "점수 데이터", exact: true }).click();
  const hasScoredRows = await page
    .waitForSelector("table tbody tr", { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (hasScoredRows) {
    await page.locator("table tbody tr").first().click();
    await page.getByText("신호-판단 추적").waitFor({ timeout: 20_000 });
  } else {
    await page.getByText("테이블에서 점수 데이터를 선택하세요.").waitFor({ timeout: 20_000 });
  }

  await context.close();
  await browser.close();
}

async function main() {
  console.log(`[gui] base=${BASE_URL}`);
  const server = await ensureGuiTestServer(BASE_URL);
  try {
    const chromViolations = await runViewportMatrix("chromium", chromium);
    const webkitViolations = await runViewportMatrix("webkit", webkit);
    await runScenarioE2E();
    const totalViolations = chromViolations + webkitViolations;
    if (totalViolations > 0) {
      throw new Error(`a11y_violations_detected: total=${totalViolations}`);
    }
    console.log(`[gui] done chromium_violations=${chromViolations} webkit_violations=${webkitViolations}`);
  } finally {
    await server.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
