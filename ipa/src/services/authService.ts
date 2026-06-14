import jwt from 'jsonwebtoken';
import { generateUuid } from '@pve/utils';
import { withConnection, OUT_FORMAT_OBJECT } from '../db';
import { env } from '../config/env';
import { isChildSubscriptionActive } from './childService';

export async function registerUser(mobileNo: string, name: string, email?: string) {
  const userId = generateUuid();

  await withConnection(async (conn) => {
    await conn.execute(
      `INSERT INTO users (user_id, mobile_no, name, email) VALUES (:id, :mobile, :name, :email)`,
      { id: userId, mobile: mobileNo, name, email: email || null },
      { autoCommit: true }
    );
  });

  return { user_id: userId };
}

export async function loginUser(mobileNo: string) {
  return withConnection(async (conn) => {
    // Check parent user first
    const parentRs = await conn.execute(
      `SELECT user_id, mobile_no, name FROM users WHERE mobile_no = :mobile`,
      { mobile: mobileNo },
      { outFormat: OUT_FORMAT_OBJECT }
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

    // Check child user
    const childRs = await conn.execute(
      `SELECT c.child_id, c.parent_user_id, c.mobile_no, c.name, c.status
       FROM child_users c WHERE c.mobile_no = :mobile`,
      { mobile: mobileNo },
      { outFormat: OUT_FORMAT_OBJECT }
    );
    const child = (childRs.rows as Record<string, string>[])?.[0];

    if (!child) {
      throw new Error('User not found');
    }
    if (child.STATUS !== 'active') {
      throw new Error('Child account is deactivated');
    }

    const active = await isChildSubscriptionActive(child.CHILD_ID);
    if (!active) {
      throw new Error('Child subscription expired — account is read-only');
    }

    const token = jwt.sign(
      {
        user_id: child.CHILD_ID,
        mobile_no: child.MOBILE_NO,
        is_child: true,
        child_id: child.CHILD_ID,
        parent_user_id: child.PARENT_USER_ID,
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
        parent_user_id: child.PARENT_USER_ID,
      },
    };
  });
}
