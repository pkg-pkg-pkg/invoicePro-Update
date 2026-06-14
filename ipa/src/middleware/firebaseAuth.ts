import { Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin } from '../services/firebaseAdmin';

export async function authenticateFirebaseSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Firebase ID token required' });
  }

  const token = header.split(' ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Firebase ID token required' });
  }

  const fb = getFirebaseAdmin();
  if (!fb) {
    return res.status(503).json({ error: 'Firebase Admin not configured on IPA server' });
  }

  try {
    const decoded = await fb.auth().verifyIdToken(token);
    const allowed = await import('../services/firebaseAdmin').then((m) =>
      m.isSuperAdminUid(decoded.uid)
    );
    if (!allowed) {
      return res.status(403).json({ error: 'Super admin access denied' });
    }
    (req as Request & { firebaseUid?: string }).firebaseUid = decoded.uid;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
}
