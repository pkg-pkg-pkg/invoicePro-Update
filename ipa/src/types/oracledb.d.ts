declare module 'oracledb' {
  export interface Pool {
    getConnection(): Promise<Connection>;
    close(drainTime: number): Promise<void>;
  }

  export interface Connection {
    execute<T = unknown>(
      sql: string,
      binds?: Record<string, unknown> | unknown[],
      options?: Record<string, unknown>
    ): Promise<{ rows?: T[]; rowsAffected?: number }>;
    commit(): Promise<void>;
    close(): Promise<void>;
  }

  export const OUT_FORMAT_OBJECT: number;

  export function createPool(options: Record<string, unknown>): Promise<Pool>;
}
