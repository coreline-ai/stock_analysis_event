import pg from "pg";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

async function main() {
  const client = new pg.Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  try {
    const rows = await client.query(
      `
      with score_stats as (
        select
          round(avg(final_score)::numeric,4) as avg_final_score,
          round(avg(case when sentiment_score=0 then 1 else 0 end)::numeric*100,2) as sentiment_zero_pct,
          round(avg(case when final_score=0 then 1 else 0 end)::numeric*100,2) as final_zero_pct,
          round(avg(case when hard_filter_passed then 1 else 0 end)::numeric*100,2) as hard_pass_pct
        from signals_scored
      ),
      meta_cov as (
        select
          round(avg(case when r.raw_payload ? 'volume_ratio' then 1 else 0 end)::numeric*100,2) as volume_ratio_cov_pct,
          round(avg(case when r.raw_payload ? 'price_above_ma5' then 1 else 0 end)::numeric*100,2) as ma5_cov_pct,
          round(avg(case when r.raw_payload ? 'price_above_ma20' then 1 else 0 end)::numeric*100,2) as ma20_cov_pct
        from signals_raw r
        join signals_scored s on s.raw_id = r.id
        where s.symbol ~ '^\\d{6}$'
      ),
      verdicts as (
        select coalesce(jsonb_object_agg(verdict, cnt), '{}'::jsonb) as verdict_dist
        from (
          select verdict, count(*)::int as cnt
          from decisions
          group by verdict
        ) x
      ),
      latest_ref as (
        select run_ref
        from signals_scored
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
        from signals_scored s
        where s.run_ref = (select run_ref from latest_ref)
      )
      select
        (select row_to_json(score_stats) from score_stats) as score_stats,
        (select row_to_json(meta_cov) from meta_cov) as kr_meta_coverage,
        (select verdict_dist from verdicts) as verdict_distribution,
        (select run_ref from latest_ref) as latest_run_ref,
        (select row_to_json(latest_run_stats) from latest_run_stats) as latest_run_stats
      `
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
