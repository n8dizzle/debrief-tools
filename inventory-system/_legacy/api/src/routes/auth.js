'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const authService = require('../services/authService');

const router = Router();

// POST /api/v1/auth/login
router.post(
  '/login',
  validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  validate({ body: z.object({ refresh_token: z.string() }) }),
  async (req, res, next) => {
    try {
      const result = await authService.refresh(req.body.refresh_token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/v1/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  validate({
    body: z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }),
  }),
  async (req, res, next) => {
    try {
      await authService.changePassword(
        req.user.id,
        req.body.currentPassword,
        req.body.newPassword,
      );
      res.json({ message: 'Password updated' });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
