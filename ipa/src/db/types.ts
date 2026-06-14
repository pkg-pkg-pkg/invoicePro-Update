export const OUT_FORMAT_OBJECT = 1;

export interface ExecuteOptions {
  autoCommit?: boolean;
  outFormat?: number;
}

export interface ExecuteResult<T = Record<string, unknown>> {
  rows?: T[];
  rowsAffected?: number;
}

export interface DbConnection {
  execute<T = Record<string, unknown>>(
    sql: string,
    binds?: Record<string, unknown> | unknown[],
    options?: ExecuteOptions
  ): Promise<ExecuteResult<T>>;
  commit(): Promise<void>;
}
