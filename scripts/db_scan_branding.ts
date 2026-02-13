import pg from "pg";

function getEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

async function main() {
  const databaseUrl = getEnv("DATABASE_URL");
  if (!databaseUrl) {
    console.log("skip: DATABASE_URL is not set (db branding scan is optional)");
    return;
  }

  const defaultTerm = String.fromCharCode(109, 97, 104, 111, 114, 97, 103, 97);
  const term = (getEnv("BRANDING_SCAN_TERM") ?? defaultTerm).toLowerCase();
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const failures: Array<{ table: string; column: string; rows: number }> = [];

  try {
    const columns = await pool.query<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('text', 'character varying', 'json', 'jsonb', 'ARRAY')
      ORDER BY table_name, ordinal_position
      `
    );

    for (const col of columns.rows) {
      const table = quoteIdent(col.table_name);
      const column = quoteIdent(col.column_name);
      const sql = `SELECT COUNT(*)::int AS count FROM ${table} WHERE ${column}::text ILIKE $1`;
      const result = await pool.query<{ count: number }>(sql, [`%${term}%`]);
      const count = Number(result.rows[0]?.count ?? 0);
      if (count > 0) {
        failures.push({ table: col.table_name, column: col.column_name, rows: count });
      }
    }
  } finally {
    await pool.end().catch(() => {});
  }

  if (failures.length > 0) {
    console.error(`db branding scan failed: found term="${term}"`);
    for (const item of failures) {
      console.error(`- ${item.table}.${item.column}: rows=${item.rows}`);
    }
    process.exit(1);
  }

  console.log(`db branding scan passed: term="${term}"`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
