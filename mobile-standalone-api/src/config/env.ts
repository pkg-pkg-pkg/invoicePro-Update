import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT || 3002),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: requireEnv('JWT_SECRET'),
  otpStubCode: process.env.OTP_STUB_CODE || '123456',
  oracle: {
    walletPath: path.resolve(requireEnv('ORACLE_WALLET_PATH', './wallet')),
    user: requireEnv('ORACLE_USER_MOBILE'),
    password: requireEnv('ORACLE_PASS_MOBILE'),
    dsn: requireEnv('ORACLE_DSN', 'pvedatabase_high'),
  },
  corsOrigins: String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
};
