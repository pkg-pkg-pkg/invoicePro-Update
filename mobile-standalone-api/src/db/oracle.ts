import oracledb from 'oracledb';
import { env } from '../config/env';

let pool: oracledb.Pool | null = null;

export async function initOraclePool(): Promise<void> {
  if (pool) return;
  process.env.TNS_ADMIN = env.oracle.walletPath;
  pool = await oracledb.createPool({
    user: env.oracle.user,
    password: env.oracle.password,
    connectString: env.oracle.dsn,
    configDir: env.oracle.walletPath,
    walletLocation: env.oracle.walletPath,
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
  });
}

export async function withConnection<T>(
  userId: string,
  fn: (conn: oracledb.Connection) => Promise<T>
): Promise<T> {
  if (!pool) await initOraclePool();
  const conn = await pool!.getConnection();
  try {
    // Set RLS context — all queries scoped to data owner (parent for child users)
    await conn.execute(`BEGIN mobile_ctx_pkg.set_user(:userId); END;`, { userId });
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close(0);
    pool = null;
  }
}
