CREATE OR REPLACE FUNCTION deepstock_legacy_term()
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CHR(109) || CHR(97) || CHR(104) || CHR(111) || CHR(114) || CHR(97) || CHR(103) || CHR(97);
$$;

CREATE OR REPLACE FUNCTION deepstock_rebrand_text(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input_text IS NULL THEN NULL
    ELSE REPLACE(
      REPLACE(
        REPLACE(input_text, UPPER(deepstock_legacy_term()), UPPER('deepstock')),
        INITCAP(deepstock_legacy_term()), INITCAP('deepstock')
      ),
      deepstock_legacy_term(), 'deepstock'
    )
  END;
$$;

UPDATE signals_raw
SET
  external_id = deepstock_rebrand_text(external_id),
  title = deepstock_rebrand_text(title),
  body = deepstock_rebrand_text(body),
  url = deepstock_rebrand_text(url),
  author = deepstock_rebrand_text(author),
  raw_payload = CASE WHEN raw_payload IS NULL THEN NULL ELSE deepstock_rebrand_text(raw_payload::TEXT)::JSONB END
WHERE
  COALESCE(external_id, '') ~* deepstock_legacy_term()
  OR COALESCE(title, '') ~* deepstock_legacy_term()
  OR COALESCE(body, '') ~* deepstock_legacy_term()
  OR COALESCE(url, '') ~* deepstock_legacy_term()
  OR COALESCE(author, '') ~* deepstock_legacy_term()
  OR COALESCE(raw_payload::TEXT, '') ~* deepstock_legacy_term();

UPDATE signals_scored
SET
  symbol = deepstock_rebrand_text(symbol),
  reason_summary = deepstock_rebrand_text(reason_summary)
WHERE
  COALESCE(symbol, '') ~* deepstock_legacy_term()
  OR COALESCE(reason_summary, '') ~* deepstock_legacy_term();

UPDATE decisions
SET
  symbol = deepstock_rebrand_text(symbol),
  thesis_summary = deepstock_rebrand_text(thesis_summary),
  entry_trigger = deepstock_rebrand_text(entry_trigger),
  invalidation = deepstock_rebrand_text(invalidation),
  llm_model = deepstock_rebrand_text(llm_model),
  prompt_version = deepstock_rebrand_text(prompt_version),
  schema_version = deepstock_rebrand_text(schema_version),
  risk_notes = (
    SELECT ARRAY(SELECT deepstock_rebrand_text(item) FROM UNNEST(risk_notes) AS item)
  ),
  bull_case = (
    SELECT ARRAY(SELECT deepstock_rebrand_text(item) FROM UNNEST(bull_case) AS item)
  ),
  bear_case = (
    SELECT ARRAY(SELECT deepstock_rebrand_text(item) FROM UNNEST(bear_case) AS item)
  ),
  red_flags = (
    SELECT ARRAY(SELECT deepstock_rebrand_text(item) FROM UNNEST(red_flags) AS item)
  ),
  catalysts = (
    SELECT ARRAY(SELECT deepstock_rebrand_text(item) FROM UNNEST(catalysts) AS item)
  )
WHERE
  COALESCE(symbol, '') ~* deepstock_legacy_term()
  OR COALESCE(thesis_summary, '') ~* deepstock_legacy_term()
  OR COALESCE(entry_trigger, '') ~* deepstock_legacy_term()
  OR COALESCE(invalidation, '') ~* deepstock_legacy_term()
  OR COALESCE(llm_model, '') ~* deepstock_legacy_term()
  OR COALESCE(prompt_version, '') ~* deepstock_legacy_term()
  OR COALESCE(schema_version, '') ~* deepstock_legacy_term()
  OR COALESCE(ARRAY_TO_STRING(risk_notes, ','), '') ~* deepstock_legacy_term()
  OR COALESCE(ARRAY_TO_STRING(bull_case, ','), '') ~* deepstock_legacy_term()
  OR COALESCE(ARRAY_TO_STRING(bear_case, ','), '') ~* deepstock_legacy_term()
  OR COALESCE(ARRAY_TO_STRING(red_flags, ','), '') ~* deepstock_legacy_term()
  OR COALESCE(ARRAY_TO_STRING(catalysts, ','), '') ~* deepstock_legacy_term();

UPDATE daily_reports
SET
  summary_markdown = deepstock_rebrand_text(summary_markdown),
  themes = (
    SELECT ARRAY(SELECT deepstock_rebrand_text(item) FROM UNNEST(themes) AS item)
  ),
  risks = (
    SELECT ARRAY(SELECT deepstock_rebrand_text(item) FROM UNNEST(risks) AS item)
  )
WHERE
  COALESCE(summary_markdown, '') ~* deepstock_legacy_term()
  OR COALESCE(ARRAY_TO_STRING(themes, ','), '') ~* deepstock_legacy_term()
  OR COALESCE(ARRAY_TO_STRING(risks, ','), '') ~* deepstock_legacy_term();

UPDATE agent_runs
SET
  error_summary = deepstock_rebrand_text(error_summary),
  gathered_counts = CASE
    WHEN gathered_counts IS NULL THEN NULL
    ELSE deepstock_rebrand_text(gathered_counts::TEXT)::JSONB
  END,
  stage_timings = CASE
    WHEN stage_timings IS NULL THEN NULL
    ELSE deepstock_rebrand_text(stage_timings::TEXT)::JSONB
  END
WHERE
  COALESCE(error_summary, '') ~* deepstock_legacy_term()
  OR COALESCE(gathered_counts::TEXT, '') ~* deepstock_legacy_term()
  OR COALESCE(stage_timings::TEXT, '') ~* deepstock_legacy_term();

DROP FUNCTION deepstock_rebrand_text(TEXT);
DROP FUNCTION deepstock_legacy_term();
