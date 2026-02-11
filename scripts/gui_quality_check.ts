import { chromium, webkit, type BrowserType, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3333";
const TOKEN = process.env.MAHORAGA_API_TOKEN ?? process.env.API_TOKEN ?? "dev-token";

function seedToken(token: string) {
  // Keep legacy and generic keys for backward compatibility.
  window.sessionStorage.setItem("mahoraga_api_token", token);
  window.sessionStorage.setItem("api_token", token);
}

async function waitDashboardLoaded(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.getByText("운영 콕핏").waitFor({ timeout: 30_000 });
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

  await page.getByRole("button", { name: /미국 분석 실행/ }).click();
  await page.waitForSelector(".toast.success, .toast.info", { timeout: 60_000 });

  // Consecutive trigger scenario.
  await page.getByRole("button", { name: /미국 분석 실행/ }).click();
  await page.waitForSelector(".toast.success, .toast.info, .toast.error", { timeout: 20_000 });

  await page.goto(`${BASE_URL}/dashboard/decisions`);
  await page.getByPlaceholder("TSLA").fill("A");
  await page.waitForSelector(".list-item.as-button", { timeout: 20_000 });
  await page.locator(".list-item.as-button").first().click();
  await page.getByRole("link", { name: "관련 신호 보기" }).click();
  await page.waitForURL(/\/dashboard\/signals/);

  await page.goto(`${BASE_URL}/dashboard/reports`);
  await page.waitForSelector(".list-item.as-button", { timeout: 20_000 });
  await page.locator(".list-item.as-button").first().click();
  await page.getByText("리포트", { exact: false }).first().waitFor();

  await page.goto(`${BASE_URL}/dashboard/runs`);
  await page.getByRole("button", { name: "지우기" }).click();
  await page.getByRole("button", { name: /미국 분석 실행/ }).click();
  const authModal = page.getByText("인증 필요");
  const outcome = await Promise.race([
    authModal
      .waitFor({ timeout: 30_000 })
      .then(() => "auth" as const)
      .catch(() => "none" as const),
    page
      .waitForSelector(".toast.success, .toast.info, .toast.error", { timeout: 30_000 })
      .then(() => "toast" as const)
      .catch(() => "none" as const)
  ]);
  if (outcome === "auth") {
    await page.getByRole("button", { name: "닫기" }).click();
  } else if (outcome === "none") {
    throw new Error("Neither auth modal nor toast appeared after trigger");
  }

  await page.goto(`${BASE_URL}/dashboard/signals?tab=scored`);
  await page.getByRole("button", { name: "스코어 신호", exact: true }).click();
  await page.locator("table tbody tr").first().click();
  await page.getByText("신호-판단 추적").waitFor();

  await context.close();
  await browser.close();
}

async function main() {
  console.log(`[gui] base=${BASE_URL}`);
  const chromViolations = await runViewportMatrix("chromium", chromium);
  const webkitViolations = await runViewportMatrix("webkit", webkit);
  await runScenarioE2E();
  console.log(`[gui] done chromium_violations=${chromViolations} webkit_violations=${webkitViolations}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
