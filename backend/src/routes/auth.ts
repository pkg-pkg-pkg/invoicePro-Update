// D:\PVEB\backend\src\routes\auth.ts

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt, {
  JwtPayload,
  Secret,
  SignOptions,
} from "jsonwebtoken";
import { authenticate, AuthUser, UserRole } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Types ko explicitly define kar rahe hain:
const JWT_SECRET: string =
  process.env.JWT_SECRET || "your-secret-key";

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as string;


/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { success, token, user }
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    console.log("=================================");
    console.log("📥 LOGIN REQUEST");
    console.log("Body:", req.body);

    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email) {
      console.log("❌ Email missing");
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    if (!password) {
      console.log("❌ Password missing");
      return res.status(400).json({
        success: false,
        error: "Password is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log("✅ Looking for user:", normalizedEmail);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { company: true },
    });

    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    console.log("✅ User found:", {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    });

    if (!user.isActive) {
      console.log("❌ User not active");
      return res.status(401).json({
        success: false,
        error: "Account is not active",
      });
    }

    console.log("🔐 Checking password...");
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log("❌ Invalid password");
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    console.log("✅ Password correct");

    // JWT payload – AuthUser ke shape ke according
    const payload: AuthUser = {
      id: String(user.id),
      username: user.username,
      email: user.email,
      fullName: user.fullName || undefined,
      role: user.role as UserRole,
      companyId: user.companyId ? String(user.companyId) : undefined,
    };

    // Yahan pe types fix kiye hain (JWT_SECRET: Secret, expiresIn: SignOptions["expiresIn"])
    const token = jwt.sign(payload, JWT_SECRET as Secret, {
      expiresIn: JWT_EXPIRES_IN,
    } as SignOptions);

    console.log("✅ LOGIN SUCCESS!");
    console.log("=================================");

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        company: user.company,
      },
    });
  } catch (error: any) {
    console.error("❌ LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed",
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Requires: Authorization: Bearer <token>
 * Response: { user }
 */
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const authUser = req.user; // from authenticate middleware

    if (!authUser?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { company: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password, ...userWithoutPassword } = user as any;

    return res.json({
      user: userWithoutPassword,
    });
  } catch (error: any) {
    console.error("❌ Get /me error:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
