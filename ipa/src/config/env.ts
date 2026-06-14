import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function walletExists(walletPath: string): boolean {
  try {
    return fs.existsSync(path.join(walletPath, 'tnsnames.ora'));
  } catch {
    return false;
  }
}

const walletPath = path.resolve(process.env.ORACLE_WALLET_PATH || '../Oracle/wallet');
const skipOracleExplicit = process.env.SKIP_ORACLE === 'true';
const skipOracle = skipOracleExplicit || !walletExists(walletPath);

export const env = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: requireEnv('JWT_SECRET'),
  skipOracle,
  sqlite: {
    dbPath: path.resolve(process.env.DB_PATH || './data/invoicepro.db'),
  },
  oracle: skipOracle
    ? null
    : {
        walletPath,
        user: requireEnv('ORACLE_USER_INVOICEPRO'),
        password: requireEnv('ORACLE_PASS_INVOICEPRO'),
        dsn: requireEnv('ORACLE_DSN', 'pvedatabase_high'),
      },
  corsOrigins: String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
};
