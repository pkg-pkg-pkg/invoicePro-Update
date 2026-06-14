import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { InvoiceProAuthUser } from '../types/express';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  const token = header.split(' ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret) as InvoiceProAuthUser;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Resolve the data-owner user_id — parent for child users, self otherwise. */
export function getDataOwnerId(req: Request): string {
  const user = req.user!;
  return user.is_child && user.parent_user_id ? user.parent_user_id : user.user_id;
}

export function requireParent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.is_child) {
    return res.status(403).json({ error: 'Only parent users can perform this action' });
  }
  return next();
}
