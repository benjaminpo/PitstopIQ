import { Pool, type QueryResultRow } from "pg";

export type DbKind = "pg" | "sqlite";

let pgPool: Pool | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqliteDb: any = null;

export function getDbKind(): DbKind {
  return process.env.DATABASE_URL ? "pg" : "sqlite";
}

/** Shared Postgres pool (Neon in production). */
export function getPgPool(): Pool {
  if (!pgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pgPool = new Pool({ connectionString: url });
  }
  return pgPool;
}

/** Shared local SQLite handle (dev only). */
export function getSqlite() {
  if (!sqliteDb) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as typeof import("better-sqlite3");
    sqliteDb = new Database("pitstopiq.db");
  }
  return sqliteDb as import("better-sqlite3").Database;
}

/** Better Auth + app tables share one connection. */
export function createAuthDatabase() {
  return getDbKind() === "pg" ? getPgPool() : getSqlite();
}

/** Convert `?` placeholders to Postgres `$1`, `$2`, … */
function toPg(sql: string): string {
  let i = 0;
  return sql.replaceAll("?", () => `$${++i}`);
}

export async function dbAll<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (getDbKind() === "pg") {
    const result = await getPgPool().query<T>(toPg(sql), params);
    return result.rows;
  }
  return getSqlite().prepare(sql).all(...params) as T[];
}

export async function dbGet<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await dbAll<T>(sql, params);
  return rows[0];
}

export async function dbRun(
  sql: string,
  params: unknown[] = []
): Promise<void> {
  if (getDbKind() === "pg") {
    await getPgPool().query(toPg(sql), params);
    return;
  }
  getSqlite().prepare(sql).run(...params);
}
