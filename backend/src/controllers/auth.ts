// FILE: src/routes/auth.routes.ts - FIXED VERSION WITH DEBUGGING
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req: Request, res: Response) => {
  try {
    console.log('Login attempt:', { email: req.body.email });
    
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    // Find user
    console.log('Looking for user:', email);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { company: true },
    });

    if (!user) {
      console.log('User not found');
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    console.log('User found:', { id: user.id, username: user.username, isActive: user.isActive });

    if (!user.isActive) {
      console.log('User is not active');
      return res.status(401).json({ 
        success: false,
        error: 'Account is not active' 
      });
    }

    // Verify password
    console.log('Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('Invalid password');
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    console.log('Password verified successfully');

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    console.log('Generating token with payload:', tokenPayload);

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: '7d' }
    );

    console.log('Token generated successfully');

    // Return success response
    const response = {
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
    };

    console.log('Login successful for user:', user.email);
    res.json(response);

  } catch (error: any) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Login failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Password reset/change helper route (for testing)
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log(`Password reset for user: ${email}`);

    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });

  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Get me request for user:', req.user?.id);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { company: true },
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.json({ success: true, data: userWithoutPassword });

  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user' 
    });
  }
});

// Test route to check if user exists
router.post('/check-user', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        isActive: true,
        role: true,
      },
    });

    if (!user) {
      return res.json({ 
        exists: false,
        message: 'User not found' 
      });
    }

    res.json({ 
      exists: true,
      user: {
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        isActive: user.isActive,
        role: user.role,
      }
    });

  } catch (error: any) {
    console.error('Check user error:', error);
    res.status(500).json({ error: 'Failed to check user' });
  }
});

export default router;