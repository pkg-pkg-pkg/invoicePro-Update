import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { MobileAuthUser, ModuleName, AccessLevel } from '../types/express';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }
  const token = header.split(' ')[1]?.trim();
  if (!token) return res.status(401).json({ error: 'Authorization token missing' });

  try {
    req.user = jwt.verify(token, env.jwtSecret) as MobileAuthUser;
    req.dataOwnerId =
      req.user.is_child && req.user.parent_user_id
        ? req.user.parent_user_id
        : req.user.user_id;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const ACTION_MAP: Record<string, AccessLevel[]> = {
  read: ['read', 'add', 'add_edit', 'full'],
  add: ['add', 'add_edit', 'full'],
  edit: ['add_edit', 'full'],
  delete: ['full'],
};

export function requirePermission(module: ModuleName, action: keyof typeof ACTION_MAP) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.is_child) return next();

    const level = req.user.permissions?.[module] ?? 'none';
    if (level === 'none' || !ACTION_MAP[action].includes(level)) {
      return res.status(403).json({ error: `Permission denied for ${module}:${action}` });
    }
    return next();
  };
}

export function requireParent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.is_child) {
    return res.status(403).json({ error: 'Only parent users can perform this action' });
  }
  return next();
}
