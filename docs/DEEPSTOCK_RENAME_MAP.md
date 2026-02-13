# DEEPSTOCK Rename Map

본 문서는 리브랜딩 치환의 기준 사전이다. 실제 치환 작업과 코드 리뷰는 이 문서를 기준으로 수행한다.

## 1. 문자열 치환 규칙

| Legacy | Target | Scope |
|---|---|---|
| `\u004d\u0041\u0048\u004f\u0052\u0041\u0047\u0041` | `DEEPSTOCK` | 문서/상수/헤더 |
| `\u004d\u0061\u0068\u006f\u0072\u0061\u0067\u0061` | `Deepstock` | 제목/문장 |
| `\u006d\u0061\u0068\u006f\u0072\u0061\u0067\u0061` | `deepstock` | 코드/경로/로그 |

## 2. 환경변수/토큰 키

| Legacy | Target | 정책 |
|---|---|---|
| `\u004d\u0041\u0048\u004f\u0052\u0041\u0047\u0041_API_TOKEN` | `DEEPSTOCK_API_TOKEN` | 신규 키로 이관, 레거시 fallback 단계적 제거 |
| `\u004d\u0041\u0048\u004f\u0052\u0041\u0047\u0041_DEV_AUTH_BYPASS` | `DEEPSTOCK_DEV_AUTH_BYPASS` | 신규 키 우선 사용 |
| `\u006d\u0061\u0068\u006f\u0072\u0061\u0067\u0061_api_token` | `deepstock_api_token` | sessionStorage 키 이관 |

## 3. 런타임 식별자

| Legacy | Target |
|---|---|
| `\u006d\u0061\u0068\u006f\u0072\u0061\u0067\u0061:pipeline:*` | `deepstock:pipeline:*` |
| `\u006d\u0061\u0068\u006f\u0072\u0061\u0067\u0061-research-only` | `deepstock-research-only` |
| `/tmp/\u006d\u0061\u0068\u006f\u0072\u0061\u0067\u0061-*` | `/tmp/deepstock-*` |

## 4. 작업 규칙

- 새 코드/문서에는 Legacy 식별자를 추가하지 않는다.
- 기존 Legacy 식별자는 워크스트림 단위로 일괄 치환한다.
- 레거시 호환이 필요한 경우 사유와 제거 일정(후속 태스크 ID)을 함께 기록한다.
