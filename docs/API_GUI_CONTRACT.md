# API GUI Contract

## Scope

This document defines the dashboard-facing API contract for the Research-Only GUI.

## Auth

- Header: `x-api-token: <API_TOKEN>` (레거시 `MAHORAGA_API_TOKEN`도 호환)
- Protected endpoints: all `/api/agent/*`
- Cron endpoint auth: `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`

## Response Envelope

- Success:
```json
{
  "ok": true,
  "data": {}
}
```
- Error:
```json
{
  "ok": false,
  "error": "human_readable_message",
  "code": "unauthorized | invalid_request | missing_env | forbidden_env | db_error | quote_unavailable | symbol_not_found | unknown_error"
}
```

## Endpoints

### `GET /api/health`

- Auth: none
- Response:
```json
{
  "status": "ok",
  "time": "2026-02-11T09:18:34.000Z"
}
```

### `POST /api/agent/trigger`

- Auth: required
- Request body (optional):
```json
{
  "marketScope": "US | KR | ALL",
  "strategyKey": "us_default | kr_default | all_default"
}
```
- Response:
```json
{
  "ok": true,
  "data": {
    "runId": "sha256...",
    "marketScope": "US",
    "strategyKey": "us_default",
    "status": "success | partial | failed",
    "errorSummary": null,
    "rawCount": 40,
    "scoredCount": 20,
    "decidedCount": 10,
    "reportId": "2"
  }
}
```

### `GET /api/agent/summary?scope=US|KR`

- Auth: required
- Response: cockpit aggregate payload (`kpi`에 `usDecisions`, `krDecisions` 포함)

### `GET /api/agent/status?limit=&offset=&scope=US|KR`

- Auth: required
- Response:
```json
{
  "ok": true,
  "data": {
    "items": [],
    "meta": {
      "total": 10,
      "limit": 50,
      "offset": 0,
      "count": 10
    }
  }
}
```

### `GET /api/agent/decisions?limit=&offset=&scope=US|KR`

- Auth: required
- Response: `items + meta(total, limit, offset, count)`

### `GET /api/agent/reports?limit=&offset=&scope=US|KR`

- Auth: required
- Response: `items + meta(total, limit, offset, count)`

### `GET /api/agent/signals/raw?limit=&offset=`

- Auth: required
- Response: `items + meta(total, limit, offset, count)`

### `GET /api/agent/signals/scored?limit=&offset=`

- Auth: required
- Response: `items + meta(total, limit, offset, count)`

### `GET /api/agent/symbols/resolve?codes=005930,000660`

- Auth: required
- Purpose: KR 종목코드 -> 한글 종목명 매핑
- Response:
```json
{
  "ok": true,
  "data": {
    "names": {
      "005930": "삼성전자",
      "000660": "SK하이닉스"
    }
  }
}
```

### `GET /api/agent/symbols/search?q=삼성&scope=KR&limit=8`

- Auth: required
- Purpose: KR/US 심볼 자동완성
- Cache: 5분
- Response:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "symbol": "005930",
        "name": "삼성전자",
        "display": "005930 삼성전자",
        "marketScope": "KR"
      }
    ]
  }
}
```

### `GET /api/agent/quotes?symbols=005930,AAPL`

- Auth: required
- Purpose: 엔트리 트리거 도달률 계산용 현재가 조회
- Source:
  - KR: `polling.finance.naver.com` (지연 시세)
  - US: `stooq.com` (지연 시세)
- Cache: 45초
- Response:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "symbol": "005930",
        "marketScope": "KR",
        "price": 167800,
        "currency": "KRW",
        "asOf": "2026-02-11T20:00:00.000000+09:00",
        "source": "naver"
      },
      {
        "symbol": "AAPL",
        "marketScope": "US",
        "price": 273.68,
        "currency": "USD",
        "asOf": "2026-02-10T22:00:18Z",
        "source": "stooq"
      }
    ],
    "unavailable": []
  }
}
```

### `POST /api/cron/run`

- Auth: cron secret required
- Response: same payload shape as `/api/agent/trigger`
