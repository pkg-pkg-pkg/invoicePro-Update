import oracledb from 'oracledb';
import type { DbConnection, ExecuteOptions, ExecuteResult } from './types';
import { OUT_FORMAT_OBJECT } from './types';

export function wrapOracleConnection(conn: oracledb.Connection): DbConnection {
  return {
    async execute<T = Record<string, unknown>>(
      sql: string,
      binds?: Record<string, unknown> | unknown[],
      options: ExecuteOptions = {}
    ): Promise<ExecuteResult<T>> {
      const rs = await conn.execute<T>(sql, binds, {
        autoCommit: options.autoCommit,
        outFormat: options.outFormat === OUT_FORMAT_OBJECT ? oracledb.OUT_FORMAT_OBJECT : undefined,
      });
      return {
        rows: rs.rows as T[] | undefined,
        rowsAffected: rs.rowsAffected,
      };
    },
    async commit(): Promise<void> {
      await conn.commit();
    },
  };
}
