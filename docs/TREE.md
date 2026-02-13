# 권장 레포 구조 (현재 단계 / 원본 참조 포함)

deepstock-research/
  README.md

  docs/
    REFACTORING_PLAN.md
    PRD.md
    TRD.md
    DEVELOPMENT_PLAN.md

  reference/
    DEEPSTOCK-original/
      (원본 저장소를 서브트리/서브모듈/그냥 복사로 보관)
      (절대 수정하지 않음 - 읽기 전용)

  app/
    (Next.js App Router 기준)
    layout.tsx
    page.tsx
    api/
      agent/
        status/route.ts
        decisions/route.ts
        reports/route.ts
        trigger/route.ts
      health/route.ts

  src/
    core/
      pipeline/
        run_pipeline.ts
        stages/
          gather/
            index.ts
            reddit.ts
            stocktwits.ts
            news.ts
          normalize/
            index.ts
            symbol_map.ts
          score/
            index.ts
            source_config.ts
            freshness.ts
            sentiment.ts
          decide/
            index.ts
            schema.ts
            prompts.ts
          report/
            index.ts
            daily_report.ts
      domain/
        types.ts
        decision.ts
        signal.ts
        report.ts
        run.ts
      utils/
        time.ts
        hash.ts
        retry.ts
        logger.ts

    adapters/
      db/
        client.ts
        repositories/
          signals_raw_repo.ts
          signals_scored_repo.ts
          decisions_repo.ts
          daily_reports_repo.ts
          agent_runs_repo.ts
      lock/
        redis_lock.ts
      llm/
        provider.ts
        openai.ts
      notify/
        notifier.ts
        discord.ts

    security/
      auth.ts

    config/
      runtime.ts
      limits.ts

  db/
    migrations/
      (empty for now)
    schema/
      conceptual_schema.md

  scripts/
    seed_dev_data.ts
    export_reports.ts

  .env.example
  .gitignore
  package.json
  tsconfig.json


# 운영 원칙 (중요)

1) reference/DEEPSTOCK-original 은 절대 수정하지 않는다
2) 새 개발은 src/ 와 app/ 에서만 진행한다
3) db/migrations 는 스키마 확정 후에만 추가한다
4) db/schema/conceptual_schema.md 에 먼저 스키마를 문서로 고정하고,
   이후 migrations로 옮긴다
