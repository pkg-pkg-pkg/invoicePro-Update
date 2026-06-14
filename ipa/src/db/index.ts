import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import * as oracle from './oracle';
import * as sqlite from './sqliteDb';
import type { DbConnection } from './types';

export { OUT_FORMAT_OBJECT } from './types';
export type { DbConnection, ExecuteResult } from './types';

function walletExists(): boolean {
  try {
    return fs.existsSync(path.join(env.oracle?.walletPath ?? '', 'tnsnames.ora'));
  } catch {
    return false;
  }
}

export function useSqlite(): boolean {
  if (env.skipOracle) return true;
  return !walletExists();
}

export async function initPool(): Promise<void> {
  if (useSqlite()) {
    sqlite.initSqlitePool();
    return;
  }
  await oracle.initOraclePool();
}

export async function withConnection<T>(
  fn: (conn: DbConnection) => Promise<T>
): Promise<T> {
  if (useSqlite()) {
    return sqlite.withSqliteConnection(fn);
  }
  return oracle.withConnection(fn);
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<T[]> {
  if (useSqlite()) {
    return sqlite.query<T>(sql, binds);
  }
  return oracle.withConnection(async (conn) => {
    const rs = await (conn as DbConnection).execute<T>(sql, binds, { outFormat: 1 });
    return rs.rows ?? [];
  });
}

export async function closePool(): Promise<void> {
  if (useSqlite()) {
    sqlite.closeSqlitePool();
    return;
  }
  await oracle.closePool();
}
