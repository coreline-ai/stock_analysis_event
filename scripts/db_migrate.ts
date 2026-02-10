import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForDb(connectionString: string, timeoutMs: number) {
  const started = Date.now();
  // Simple ping loop to handle dockerized postgres startup.
  while (true) {
    try {
      const client = new pg.Client({ connectionString });
      await client.connect();
      await client.query("select 1 as ok");
      await client.end();
      return;
    } catch (e) {
      if (Date.now() - started > timeoutMs) throw e;
      await sleep(250);
    }
  }
}

type MigrationRow = { filename: string };

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const migrationsDir = path.join(rootDir, "db", "migrations");

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await waitForDb(databaseUrl, 60_000);

    await pool.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const applied = await pool.query<MigrationRow>("select filename from schema_migrations order by filename asc");
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    let appliedCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");

      await pool.query("begin");
      try {
        await pool.query(sql);
        await pool.query("insert into schema_migrations(filename) values ($1)", [file]);
        await pool.query("commit");
      } catch (e) {
        await pool.query("rollback");
        throw e;
      }
      appliedCount++;
      // eslint-disable-next-line no-console
      console.log(`applied ${file}`);
    }

    // eslint-disable-next-line no-console
    console.log(`done (new=${appliedCount}, total=${files.length})`);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
