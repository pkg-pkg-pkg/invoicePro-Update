import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import {
  requireAdminForMobileUserManagement,
  requireMobileSubscriptionActive,
} from '../middleware/mobileAccess';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function normalizeIndianMobile(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  const last10 = digits.slice(-10);
  return `+91${last10}`;
}

function temporaryEmailForMobile(mobileNumber: string): string {
  const clean = mobileNumber.replace('+', '');
  return `${clean}@mobile.pve.local`;
}

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const usernameOrMobile = String(req.body.usernameOrMobile ?? '').trim();
    const password = String(req.body.password ?? '');

    if (!usernameOrMobile || !password) {
      return res.status(400).json({ error: 'usernameOrMobile and password are required' });
    }

    const normalizedMobile = normalizeIndianMobile(usernameOrMobile);
    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        isMobileUser: true,
        OR: [
          { username: usernameOrMobile },
          ...(normalizedMobile ? [{ mobileNumber: normalizedMobile }] : []),
        ],
      },
      include: { company: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyId: user.companyId ?? undefined,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    return res.json({
      success: true,
      token,
      passwordChangeRequired: user.mustChangePassword,
      user: {
        id: user.id,
        username: user.username,
        mobileNumber: user.mobileNumber,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        mobilePermissions: user.mobilePermissions,
        company: user.company,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Mobile login failed' });
  }
});

router.post('/auth/change-password-first-login', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const currentPassword = String(req.body.currentPassword ?? '');
    const newPassword = String(req.body.newPassword ?? '');
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'currentPassword and newPassword(min 6 chars) are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const nextHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: nextHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    return res.json({ success: true, message: 'Password updated' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Password change failed' });
  }
});

router.get(
  '/admin/subscription',
  authenticate,
  requireAdminForMobileUserManagement,
  async (req: Request, res: Response) => {
    try {
      const companyId = req.user!.companyId!;
      const settings = await prisma.companySettings.findUnique({
        where: { companyId },
      });
      if (!settings) {
        return res.status(404).json({ error: 'Company settings not found' });
      }

      const activeMobileUsers = await prisma.user.count({
        where: { companyId, isMobileUser: true, isActive: true },
      });

      return res.json({
        mobileAccessEnabled: settings.mobileAccessEnabled,
        mobilePlanStart: settings.mobilePlanStart,
        mobilePlanEnd: settings.mobilePlanEnd,
        mobileIncludedUsers: settings.mobileIncludedUsers,
        mobileExtraUsersAllowed: settings.mobileExtraUsersAllowed,
        activeMobileUsers,
        pricing: {
          baseYearly: settings.mobileBasePrice,
          extraUserYearly: settings.mobileExtraUserPrice,
          gstPercent: settings.mobileGstPercent,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to fetch subscription status' });
    }
  }
);

router.get(
  '/admin/users',
  authenticate,
  requireAdminForMobileUserManagement,
  async (req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          companyId: req.user!.companyId!,
          isMobileUser: true,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          mobileNumber: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          mobilePermissions: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(users);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to fetch mobile users' });
    }
  }
);

router.post(
  '/admin/users',
  authenticate,
  requireAdminForMobileUserManagement,
  requireMobileSubscriptionActive,
  async (req: Request, res: Response) => {
    try {
      const companyId = req.user!.companyId!;
      const username = String(req.body.username ?? '').trim();
      const fullName = String(req.body.fullName ?? '').trim();
      const tempPassword = String(req.body.tempPassword ?? '');
      const mobileNumber = normalizeIndianMobile(String(req.body.mobileNumber ?? ''));
      const role = String(req.body.role ?? 'SALESPERSON');
      const mobilePermissions = req.body.mobilePermissions ?? {};

      if (!username || !fullName || !tempPassword || !mobileNumber) {
        return res.status(400).json({
          error: 'username, fullName, mobileNumber and tempPassword are required',
        });
      }

      const settings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: {
          mobileIncludedUsers: true,
          mobileExtraUsersAllowed: true,
        },
      });
      if (!settings) return res.status(404).json({ error: 'Company settings not found' });

      const activeMobileUsers = await prisma.user.count({
        where: { companyId, isMobileUser: true, isActive: true },
      });
      const maxUsers = settings.mobileIncludedUsers + settings.mobileExtraUsersAllowed;
      if (activeMobileUsers >= maxUsers) {
        return res.status(403).json({
          error: `Mobile user limit reached (${activeMobileUsers}/${maxUsers}). Increase extra users in subscription.`,
        });
      }

      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { mobileNumber }],
        },
      });
      if (existing) {
        return res.status(409).json({ error: 'Username or mobile number already exists' });
      }

      const password = await bcrypt.hash(tempPassword, 10);
      const created = await prisma.user.create({
        data: {
          username,
          fullName,
          email: temporaryEmailForMobile(mobileNumber),
          mobileNumber,
          password,
          companyId,
          role: role as any,
          isMobileUser: true,
          mustChangePassword: true,
          mobilePermissions,
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          mobileNumber: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          mobilePermissions: true,
          createdAt: true,
        },
      });

      return res.status(201).json(created);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to create mobile user' });
    }
  }
);

router.patch(
  '/admin/users/:id/reset-password',
  authenticate,
  requireAdminForMobileUserManagement,
  async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.id ?? '');
      const nextTempPassword = String(req.body.tempPassword ?? '');
      if (!userId || !nextTempPassword) {
        return res.status(400).json({ error: 'User id and tempPassword are required' });
      }

      const target = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId: req.user!.companyId!,
          isMobileUser: true,
        },
      });
      if (!target) return res.status(404).json({ error: 'Mobile user not found' });

      const hash = await bcrypt.hash(nextTempPassword, 10);
      await prisma.user.update({
        where: { id: target.id },
        data: { password: hash, mustChangePassword: true },
      });

      return res.json({ success: true, message: 'Temporary password reset successfully' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to reset password' });
    }
  }
);

router.patch(
  '/admin/users/:id/permissions',
  authenticate,
  requireAdminForMobileUserManagement,
  async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.id ?? '');
      const mobilePermissions = req.body.mobilePermissions ?? {};
      const updated = await prisma.user.updateMany({
        where: {
          id: userId,
          companyId: req.user!.companyId!,
          isMobileUser: true,
        },
        data: { mobilePermissions },
      });
      if (updated.count === 0) return res.status(404).json({ error: 'Mobile user not found' });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to update permissions' });
    }
  }
);

export default router;

