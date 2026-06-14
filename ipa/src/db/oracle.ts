import oracledb from 'oracledb';
import { env } from '../config/env';
import { wrapOracleConnection } from './oracleAdapter';
import type { DbConnection } from './types';

let pool: oracledb.Pool | null = null;

/**
 * Initialise Oracle connection pool using Instance Wallet (mTLS).
 * Wallet path and credentials come from environment variables only.
 */
export async function initOraclePool(): Promise<void> {
  if (pool) return;

  const ora = env.oracle!;
  process.env.TNS_ADMIN = ora.walletPath;

  pool = await oracledb.createPool({
    user: ora.user,
    password: ora.password,
    connectString: ora.dsn,
    configDir: ora.walletPath,
    walletLocation: ora.walletPath,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD,
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
  });
}

export async function getConnection(): Promise<oracledb.Connection> {
  if (!pool) {
    await initOraclePool();
  }
  return pool!.getConnection();
}

export async function withConnection<T>(
  fn: (conn: DbConnection) => Promise<T>
): Promise<T> {
  const conn = await getConnection();
  try {
    return await fn(wrapOracleConnection(conn));
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
