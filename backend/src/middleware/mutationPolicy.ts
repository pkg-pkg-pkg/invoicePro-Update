import { Request, Response, NextFunction } from 'express';

export function isMobileActor(req: Request): boolean {
  if (req.user?.isMobileUser) return true;
  const email = String(req.user?.email ?? '').toLowerCase();
  if (email.endsWith('@mobile.pve.local')) return true;
  return false;
}

export function blockMobileUpdateDelete(req: Request, res: Response, next: NextFunction) {
  if (!isMobileActor(req)) return next();
  if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    return res.status(403).json({
      error: 'Mobile policy: edit/delete is not allowed. You can create new entries only.',
    });
  }
  return next();
}

export function blockMobileAction(actionLabel: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isMobileActor(req)) return next();
    return res.status(403).json({
      error: `Mobile policy: ${actionLabel} is not allowed. Use desktop for this action.`,
    });
  };
}

