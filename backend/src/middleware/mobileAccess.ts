import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isAdminLike(role?: string): boolean {
  return role === 'ADMIN' || role === 'MANAGER';
}

export const requireAdminForMobileUserManagement = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!isAdminLike(req.user.role)) {
    return res.status(403).json({ error: 'Only admin/manager can manage mobile users' });
  }
  if (!req.user.companyId) {
    return res.status(400).json({ error: 'User is not mapped to a company' });
  }
  next();
};

export const requireMobileSubscriptionActive = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.companyId) {
    return res.status(400).json({ error: 'Company context missing in token' });
  }

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: req.user.companyId },
    select: {
      mobileAccessEnabled: true,
      mobilePlanEnd: true,
    },
  });

  if (!settings?.mobileAccessEnabled) {
    return res.status(403).json({ error: 'Mobile access subscription is disabled' });
  }

  if (settings.mobilePlanEnd && settings.mobilePlanEnd.getTime() < Date.now()) {
    return res.status(403).json({ error: 'Mobile access subscription has expired' });
  }

  next();
};

