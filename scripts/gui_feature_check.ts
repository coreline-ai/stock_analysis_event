import assert from "node:assert";
import { chromium } from "playwright";
import { buildRiskTags, clamp01 } from "../app/dashboard/_components/charts/utils";
import type { Decision, SignalScored } from "@/core/domain/types";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3333";
const TOKEN = process.env.API_TOKEN ?? process.env.MAHORAGA_API_TOKEN ?? "dev-token";

function seedToken(token: string) {
  window.sessionStorage.setItem("api_token", token);
  window.sessionStorage.setItem("mahoraga_api_token", token);
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-token": TOKEN }
  });
  assert.ok(res.ok, `API failed: ${path} status=${res.status}`);
  const payload = (await res.json()) as { ok: boolean; data: T };
  assert.equal(payload.ok, true, `API envelope not ok: ${path}`);
  return payload.data;
}

function passText(value?: boolean): "PASS" | "FAIL" | "N/A" {
  if (value === true) return "PASS";
  if (value === false) return "FAIL";
  return "N/A";
}

function volumeZone(score?: number): "저활성" | "관찰" | "폭발" {
  const value = clamp01(score ?? 0);
  if (value < 0.4) return "저활성";
  if (value < 0.75) return "관찰";
  return "폭발";
}

async function main() {
  const scoredData = await fetchApi<{ items: SignalScored[] }>(
    "/api/agent/signals/scored?limit=200&offset=0&scope=KR"
  );
  const target = scoredData.items.find((item) => typeof item.quantScore === "number" && Boolean(item.id));
  assert.ok(target, "검증 대상 KR scored item이 없습니다.");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(seedToken, TOKEN);
  const page = await context.newPage();

  const params = new URLSearchParams({
    tab: "scored",
    scope: "KR",
    scoredId: target!.id ?? "",
    symbol: target!.symbol
  });
  await page.goto(`${BASE_URL}/dashboard/signals?${params.toString()}`, { waitUntil: "domcontentloaded" });
  await page.getByText("신호-판단 추적").waitFor({ timeout: 30_000 });

  const expectedRadar = [
    clamp01(target!.socialScore ?? 0).toFixed(2),
    clamp01(target!.eventScore ?? 0).toFixed(2),
    clamp01(target!.volumeScore ?? 0).toFixed(2),
    clamp01(target!.flowScore ?? 0).toFixed(2),
    clamp01(target!.technicalScore ?? 0).toFixed(2)
  ];
  const radarCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "정량 레이더" }) });
  await radarCard.first().waitFor();
  const radarText = await radarCard.first().innerText();
  for (const value of expectedRadar) {
    assert.ok(radarText.includes(value), `레이더 점수 불일치: ${value}`);
  }
  console.log("[feature] radar score mapping check passed");

  const tripleCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "삼관왕 관문" }) });
  const tripleText = await tripleCard.first().innerText();
  assert.ok(tripleText.includes(passText(target!.socialLayerPassed)));
  assert.ok(tripleText.includes(passText(target!.eventLayerPassed)));
  assert.ok(tripleText.includes(passText(target!.hardFilterPassed)));
  console.log("[feature] triple crown step check passed");

  const energyCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "VSI 에너지" }) });
  const energyText = await energyCard.first().innerText();
  assert.ok(energyText.includes(volumeZone(target!.volumeScore)));
  console.log("[feature] vsi zone check passed");

  const flowCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "스마트 머니" }) });
  const flowText = await flowCard.first().innerText();
  const gap = clamp01(target!.socialScore ?? 0) - clamp01(target!.flowScore ?? 0);
  if (gap > 0.25) {
    assert.ok(flowText.includes("관심 대비 실수급 부족"));
  } else {
    assert.ok(flowText.includes("수급 균형 양호"));
  }
  console.log("[feature] flow gap warning check passed");

  const riskCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "리스크 히트맵" }) });
  const riskText = await riskCard.first().innerText();
  const expectedTags = buildRiskTags({
    contextRiskScore: target!.contextRiskScore,
    volumeGuardPassed: target!.volumeGuardPassed,
    flowGuardPassed: target!.flowGuardPassed,
    technicalGuardPassed: target!.technicalGuardPassed
  });
  for (const tag of expectedTags) {
    assert.ok(riskText.includes(tag), `리스크 태그 불일치: ${tag}`);
  }
  console.log("[feature] risk tags check passed");

  const stackedCard = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "융합 가중치" }) });
  const stackedText = await stackedCard.first().innerText();
  assert.ok(stackedText.includes(`Final ${clamp01(target!.finalScore).toFixed(2)}`));
  console.log("[feature] stacked weight score check passed");

  const searchInput = page.locator(".symbol-search-wrap input").first();
  await searchInput.waitFor({ timeout: 20_000 });
  await searchInput.fill("삼성");
  const dropdownVisible = await page
    .waitForSelector(".autocomplete-list .autocomplete-item", { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (dropdownVisible) {
    const firstSuggestion = page.locator(".autocomplete-list .autocomplete-item").first();
    const firstSuggestionText = await firstSuggestion.innerText();
    assert.ok(firstSuggestionText.length > 0, "자동완성 결과 없음");
    await firstSuggestion.click();
    const currentValue = await searchInput.inputValue();
    assert.ok(currentValue.trim().length > 0, "자동완성 클릭 후 입력값 미반영");
  } else {
    const rows = page.locator("table tbody tr");
    assert.ok((await rows.count()) > 0, "KR 필터 후 테이블 비어 있음");
    const symbolCell = rows.first().locator("td").first();
    const text = await symbolCell.innerText();
    assert.ok(text.includes("삼성") || text.includes("005930"), "KR 이름 필터 반영 실패");
  }
  console.log("[feature] KR autocomplete check passed");

  const decisionsData = await fetchApi<{ items: Decision[] }>("/api/agent/decisions?limit=200&offset=0");
  const numericDecision = decisionsData.items.find((item) => /\d+(?:\.\d+)?/.test(item.entryTrigger));
  if (numericDecision) {
    await page.goto(`${BASE_URL}/dashboard/decisions`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("TSLA").fill(numericDecision.symbol);
    await page.locator(".list-item.as-button").first().click();
    await page.getByRole("heading", { name: "트리거 도달률" }).waitFor({ timeout: 20_000 });
    const tracker = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: "트리거 도달률" }) });
    const hasProgressbar = (await tracker.getByRole("progressbar").count()) > 0;
    const trackerText = await tracker.first().innerText();
    assert.ok(
      hasProgressbar || trackerText.includes("가격 파싱 불가") || trackerText.includes("시세 데이터 없음"),
      "트리거 트래커 렌더링 실패"
    );
    console.log("[feature] entry trigger tracker check passed");
  } else {
    console.log("[feature] numeric entry trigger decision not found; tracker check skipped");
  }

  for (const vp of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 }
  ]) {
    const vpContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await vpContext.addInitScript(seedToken, TOKEN);
    const vpPage = await vpContext.newPage();
    await vpPage.goto(`${BASE_URL}/dashboard/signals?tab=scored&scope=KR&scoredId=${encodeURIComponent(target!.id ?? "")}`, {
      waitUntil: "domcontentloaded"
    });
    await vpPage.getByText("신호-판단 추적").waitFor({ timeout: 30_000 });
    const firstRow = vpPage.locator("table tbody tr").first();
    await firstRow.waitFor({ timeout: 20_000 });
    await firstRow.click();
    await vpPage.waitForSelector(".chart-card", { timeout: 20_000 });
    const chartCount = await vpPage.locator(".chart-card").count();
    assert.ok(chartCount >= 7, `${vp.name}: chart cards missing (${chartCount})`);
    const cardsInViewport = await vpPage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".chart-card"));
      if (cards.length === 0) return false;
      return cards.every((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left >= -2 && rect.right <= window.innerWidth + 2;
      });
    });
    assert.ok(cardsInViewport, `${vp.name}: chart card viewport overflow`);
    await vpContext.close();
  }
  console.log("[feature] responsive layout checks passed");

  await context.close();
  await browser.close();

  const krSearch = await fetchApi<{ items: Array<{ marketScope: string }> }>(
    "/api/agent/symbols/search?q=%EC%82%BC%EC%84%B1&scope=KR&limit=5"
  );
  assert.ok(krSearch.items.every((item) => item.marketScope === "KR"));
  const usSearch = await fetchApi<{ items: Array<{ marketScope: string }> }>("/api/agent/symbols/search?q=AA&scope=US&limit=5");
  assert.ok(usSearch.items.every((item) => item.marketScope === "US"));
  console.log("[feature] KR/US scope consistency check passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
