import { Router } from 'express';
import { z } from 'zod';
import { loginUser, registerUser } from '../services/authService';

const router = Router();

const registerSchema = z.object({
  mobile_no: z.string().min(10).max(15),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

const loginSchema = z.object({
  mobile_no: z.string().min(10).max(15),
});

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await registerUser(body.mobile_no, body.name, body.email);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body.mobile_no);
    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'User not found') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
