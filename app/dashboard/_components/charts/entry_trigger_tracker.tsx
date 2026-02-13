"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api_client";
import { computeTriggerProgress, parseEntryTrigger } from "./utils";

interface QuoteItem {
  symbol: string;
  price: number;
  currency: "USD" | "KRW";
  asOf: string;
}

interface EntryTriggerTrackerProps {
  symbol: string;
  entryTrigger: string;
  token: string;
}

interface QuoteResponse {
  items: QuoteItem[];
  unavailable: string[];
}

export function EntryTriggerTracker(props: EntryTriggerTrackerProps) {
  const [quote, setQuote] = useState<QuoteItem | null>(null);
  const [error, setError] = useState("");
  const parsed = useMemo(() => parseEntryTrigger(props.entryTrigger), [props.entryTrigger]);

  useEffect(() => {
    let cancelled = false;
    async function loadQuote() {
      setError("");
      const res = await apiRequest<QuoteResponse>(
        `/api/agent/quotes?symbols=${encodeURIComponent(props.symbol)}`,
        { token: props.token }
      );
      if (cancelled) return;
      if (!res.ok) {
        setQuote(null);
        setError(res.code ?? res.error);
        return;
      }
      setQuote(res.data.items?.[0] ?? null);
    }
    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, [props.symbol, props.token]);

  return (
    <section className="chart-card" role="group" aria-label="진입 트리거 도달률">
      <div className="chart-head">
        <h4>트리거 도달률</h4>
        <span className="badge-alt">{props.symbol}</span>
      </div>

      <p className="muted-line">조건: {props.entryTrigger}</p>

      {parsed.mode !== "price" ? (
        <p className="muted-line">가격 파싱 불가: 텍스트 조건 모드</p>
      ) : quote ? (
        (() => {
          const progress = computeTriggerProgress(quote.price, parsed.targetPrice ?? quote.price);
          return (
            <>
              <div
                className="gauge-track"
                role="progressbar"
                aria-label="진입 트리거 접근도"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress.progressPct)}
              >
                <div className="gauge-fill mid" style={{ width: `${progress.progressPct}%` }} />
              </div>
              <div className="mini-grid">
                <div className="mini-metric">
                  <span>현재가</span>
                  <strong>{quote.price.toLocaleString()} {quote.currency}</strong>
                </div>
                <div className="mini-metric">
                  <span>목표가</span>
                  <strong>{(parsed.targetPrice ?? 0).toLocaleString()}</strong>
                </div>
                <div className="mini-metric">
                  <span>남은 거리</span>
                  <strong>{progress.remainingPct.toFixed(2)}%</strong>
                </div>
              </div>
              {progress.nearEntry ? <span className="tag">진입권 근접 (2% 이내)</span> : null}
            </>
          );
        })()
      ) : (
        <p className="muted-line">시세 데이터 없음{error ? ` (${error})` : ""}</p>
      )}
    </section>
  );
}
