import pg from "pg";
import { requireEnv } from "@/config/runtime";

const { Pool } = pg;
let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!pool) {
    const connectionString = requireEnv("DATABASE_URL");
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = getDbPool();
  const result = await db.query(text, params);
  return result.rows as T[];
}
