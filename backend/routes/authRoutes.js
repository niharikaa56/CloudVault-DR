import express from 'express';
import {
  changePassword,
  getMe,
  login,
  register,
  updateSettings,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { requireDbConnection } from '../middleware/dbGuard.js';

const router = express.Router();

router.post('/register', requireDbConnection, register);
router.post('/login', requireDbConnection, login);
router.get('/me', requireDbConnection, protect, getMe);
router.patch('/settings', requireDbConnection, protect, updateSettings);
router.patch('/password', requireDbConnection, protect, changePassword);

export default router;
