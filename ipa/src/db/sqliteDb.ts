import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { env } from '../config/env';
import { SQLITE_SCHEMA_SQL } from './sqliteSchema';
import { createSqliteConnection } from './sqliteExecute';
import type { DbConnection } from './types';

let db: Database.Database | null = null;

export function initSqlitePool(): void {
  if (db) return;

  const dbPath = env.sqlite.dbPath;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SQLITE_SCHEMA_SQL);

  console.log(`[invoicepro-api] SQLite ready at ${dbPath}`);
}

export async function withSqliteConnection<T>(
  fn: (conn: DbConnection) => Promise<T>
): Promise<T> {
  if (!db) initSqlitePool();
  const conn = createSqliteConnection(db!);
  return fn(conn);
}

/** Run a parameterized query — same entry point as Oracle helpers. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<T[]> {
  return withSqliteConnection(async (conn) => {
    const rs = await conn.execute<T>(sql, binds, { outFormat: 1 });
    return rs.rows ?? [];
  });
}

export function closeSqlitePool(): void {
  if (db) {
    db.close();
    db = null;
  }
}
