# CI Guide

## Workflow

- Location: `.github/workflows/ci.yml`
- Runs on PRs and pushes to `main`
- Steps: install -> test

## Failure Checks

- GitHub Actions > 해당 워크플로우 로그 확인
- 실패 단계의 표준 출력/에러에서 원인 파악
- 로컬 재현: `npm ci` 후 `npm test`
