import { Router } from 'express';
import { z } from 'zod';
import * as auth from '../services/authService';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const body = z.object({ mobile_no: z.string(), name: z.string() }).parse(req.body);
    const result = await auth.register(body.mobile_no, body.name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const body = z
      .object({ mobile_no: z.string(), otp: z.string(), name: z.string().optional() })
      .parse(req.body);
    const result = await auth.verifyOtp(body.mobile_no, body.otp, body.name);
    res.json(result);
  } catch (err) {
    if (err instanceof Error) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = z.object({ mobile_no: z.string() }).parse(req.body);
    const result = await auth.login(body.mobile_no);
    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'User not found') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
