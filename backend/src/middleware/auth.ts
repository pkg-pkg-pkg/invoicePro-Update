// D:\PVEB\backend\src\middleware\auth.ts

import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

// Ensure that this union matches your actual roles in DB / Prisma
export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "SALESPERSON"
  | "ACCOUNTANT"
  | "STAFF"
  | "USER";

export interface AuthUser extends JwtPayload {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: UserRole;
  companyId?: string;
  isMobileUser?: boolean;
  mobilePermissions?: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("Security misconfiguration: JWT_SECRET must be set and at least 32 chars long");
}

/**
 * Authenticate:
 * - Reads JWT from Authorization: Bearer <token>
 * - Validates token
 * - Attaches decoded user on req.user
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // 1) Header missing or wrong format
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1]?.trim();

    // 2) Token string malformed (client sent null/undefined/empty)
    if (!token || token === "null" || token === "undefined") {
      return res
        .status(401)
        .json({ error: "Authorization token missing or invalid" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
      return next();
    } catch (err: any) {
      // TokenExpiredError / JsonWebTokenError dono ke liye
      // yahan sirf 401 bhej rahe hain, console pe kuch nahi likh rahe
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (err) {
    // Ye sirf tab chalega jab middleware me hi koi fatal error ho
    console.error("Authenticate middleware error (Fatal):", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

/**
 * Authorize:
 * - Usage: router.get('/route', authorize('ADMIN', 'MANAGER'), handler)
 */
export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (roles.length > 0 && !roles.includes(req.user.role)) {
        return res
          .status(403)
          .json({ error: "You do not have permission to access this resource" });
      }

      return next();
    } catch (err) {
      console.error("Authorize middleware error:", err);
      return res.status(500).json({ error: "Authorization failed" });
    }
  };

// Backward-compatible aliases
export const authMiddleware = authenticate;
export const requireRole = (...roles: UserRole[]) => authorize(...roles);

export default {
  authenticate,
  authorize,
  authMiddleware,
  requireRole,
};
