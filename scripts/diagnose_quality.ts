import pg from "pg";

const KR_SOURCES = ["naver", "dart", "kr_community", "kr_news", "kr_research", "kr_global_context"] as const;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

type DiagnoseScope = "US" | "KR" | "ALL";

function parseScopeArg(): DiagnoseScope {
  const raw = process.argv.find((arg) => arg.startsWith("--scope="))?.split("=")?.[1]?.toUpperCase();
  if (raw === "US" || raw === "KR") return raw;
  return "ALL";
}

async function main() {
  const scope = parseScopeArg();
  const client = new pg.Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  try {
    const rows = await client.query(
      `
      with scoped as (
        select s.*, r.source
        from signals_scored s
        join signals_raw r on r.id = s.raw_id
        where
          case
            when $1::text = 'KR' then r.source = any($2::text[])
            when $1::text = 'US' then not (r.source = any($2::text[]))
            else true
          end
      ),
      score_stats as (
        select
          round(avg(final_score)::numeric,4) as avg_final_score,
          round(avg(case when sentiment_score=0 then 1 else 0 end)::numeric*100,2) as sentiment_zero_pct,
          round(avg(case when final_score=0 then 1 else 0 end)::numeric*100,2) as final_zero_pct,
          round(avg(case when hard_filter_passed then 1 else 0 end)::numeric*100,2) as hard_pass_pct
        from scoped
      ),
      meta_cov as (
        select
          round(avg(case when raw_payload ? 'volume_ratio' then 1 else 0 end)::numeric*100,2) as volume_ratio_cov_pct,
          round(avg(case when raw_payload ? 'price_above_ma5' then 1 else 0 end)::numeric*100,2) as ma5_cov_pct,
          round(avg(case when raw_payload ? 'price_above_ma20' then 1 else 0 end)::numeric*100,2) as ma20_cov_pct
        from (
          select r.raw_payload
          from scoped s
          join signals_raw r on r.id = s.raw_id
          where s.symbol ~ '^\\d{6}$'
        ) k
      ),
      verdicts as (
        select coalesce(jsonb_object_agg(verdict, cnt), '{}'::jsonb) as verdict_dist
        from (
          select verdict, count(*)::int as cnt
          from decisions
          where
            case
              when $1::text = 'US' then market_scope = 'US'
              when $1::text = 'KR' then market_scope = 'KR'
              else true
            end
          group by verdict
        ) x
      ),
      latest_ref as (
        select run_ref
        from scoped
        where run_ref is not null
        order by scored_at desc
        limit 1
      ),
      latest_run_stats as (
        select
          count(*)::int as scored_cnt,
          round(avg(final_score)::numeric,4) as avg_final_score,
          round(avg(case when final_score=0 then 1 else 0 end)::numeric*100,2) as final_zero_pct,
          round(avg(case when hard_filter_passed then 1 else 0 end)::numeric*100,2) as hard_pass_pct
        from scoped s
        where s.run_ref = (select run_ref from latest_ref)
      )
      select
        $1::text as scope,
        (select row_to_json(score_stats) from score_stats) as score_stats,
        (select row_to_json(meta_cov) from meta_cov) as kr_meta_coverage,
        (select verdict_dist from verdicts) as verdict_distribution,
        (select run_ref from latest_ref) as latest_run_ref,
        (select row_to_json(latest_run_stats) from latest_run_stats) as latest_run_stats
      `,
      [scope, KR_SOURCES]
    );

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(rows.rows[0] ?? {}, null, 2));
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
