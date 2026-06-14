import oracledb from 'oracledb';
import jwt from 'jsonwebtoken';
import { generateUuid } from '@pve/utils';
import { withConnection } from '../db/oracle';
import { env } from '../config/env';
import type { ModuleName, AccessLevel } from '../types/express';

// In-memory OTP store (replace with Redis/SMS in production)
const otpStore = new Map<string, { code: string; expires: number }>();

export async function register(mobileNo: string, name: string) {
  const code = env.otpStubCode;
  otpStore.set(mobileNo, { code, expires: Date.now() + 10 * 60 * 1000 });
  return { message: 'OTP sent', mobile_no: mobileNo };
}

export async function verifyOtp(mobileNo: string, otp: string, name?: string) {
  const stored = otpStore.get(mobileNo);
  if (!stored || stored.code !== otp || stored.expires < Date.now()) {
    throw new Error('Invalid or expired OTP');
  }
  otpStore.delete(mobileNo);

  const userId = generateUuid();
  await withConnection(userId, async (conn) => {
    const existing = await conn.execute(
      `SELECT user_id FROM users WHERE mobile_no = :mobile`,
      { mobile: mobileNo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if ((existing.rows?.length ?? 0) > 0) return;

    await conn.execute(
      `INSERT INTO users (user_id, mobile_no, name) VALUES (:id, :mobile, :name)`,
      { id: userId, mobile: mobileNo, name: name || mobileNo },
      { autoCommit: true }
    );
  });

  const rs = await withConnection(userId, async (conn) => {
    return conn.execute(
      `SELECT user_id, mobile_no, name FROM users WHERE mobile_no = :mobile`,
      { mobile: mobileNo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
  });

  const user = (rs.rows as Record<string, string>[])?.[0];
  const token = jwt.sign({ user_id: user.USER_ID, mobile_no: user.MOBILE_NO }, env.jwtSecret, {
    expiresIn: '30d',
  });

  return { token, user: { user_id: user.USER_ID, name: user.NAME } };
}

export async function login(mobileNo: string) {
  return withConnection('system', async (conn) => {
    const parentRs = await conn.execute(
      `SELECT user_id, mobile_no, name FROM users WHERE mobile_no = :mobile`,
      { mobile: mobileNo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const parent = (parentRs.rows as Record<string, string>[])?.[0];

    if (parent) {
      const token = jwt.sign(
        { user_id: parent.USER_ID, mobile_no: parent.MOBILE_NO },
        env.jwtSecret,
        { expiresIn: '30d' }
      );
      return { token, user: { user_id: parent.USER_ID, name: parent.NAME, is_child: false } };
    }

    const childRs = await conn.execute(
      `SELECT c.*, s.status AS sub_status, s.paid_until
       FROM child_users c
       LEFT JOIN child_subscriptions s ON s.child_id = c.child_id AND s.status = 'active'
       WHERE c.mobile_no = :mobile`,
      { mobile: mobileNo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const child = (childRs.rows as Record<string, unknown>[])?.[0];
    if (!child) throw new Error('User not found');
    if (child.STATUS !== 'active') throw new Error('Account deactivated');

    const paidUntil = child.PAID_UNTIL as Date | null;
    const readOnly = !paidUntil || paidUntil < new Date();

    const permRs = await conn.execute(
      `SELECT module, access_level FROM child_permissions WHERE child_id = :childId`,
      { childId: child.CHILD_ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const permissions: Partial<Record<ModuleName, AccessLevel>> = {};
    for (const row of (permRs.rows as { MODULE: ModuleName; ACCESS_LEVEL: AccessLevel }[]) || []) {
      permissions[row.MODULE] = row.ACCESS_LEVEL;
    }

    const token = jwt.sign(
      {
        user_id: child.CHILD_ID,
        mobile_no: child.MOBILE_NO,
        is_child: true,
        child_id: child.CHILD_ID,
        parent_user_id: child.PARENT_USER_ID,
        permissions,
        read_only: readOnly,
      },
      env.jwtSecret,
      { expiresIn: '30d' }
    );

    return {
      token,
      user: {
        user_id: child.CHILD_ID,
        name: child.NAME,
        is_child: true,
        read_only: readOnly,
        permissions,
      },
    };
  });
}
