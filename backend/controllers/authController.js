import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    storageQuotaBytes: user.storageQuotaBytes,
    autoBackupEnabled: user.autoBackupEnabled,
    createdAt: user.createdAt,
  };
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Name, email, and password must be valid text values.' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
    });

    const token = signToken(user._id);
    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ error: 'Unable to create account. Please try again.' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user._id);
    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Unable to sign in. Please try again.' });
  }
}

export async function getMe(req, res) {
  return res.json({ user: sanitizeUser(req.user) });
}

export async function updateSettings(req, res) {
  try {
    const { name, autoBackupEnabled } = req.body || {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
      }
      req.user.name = name.trim();
    }

    if (autoBackupEnabled !== undefined) {
      if (typeof autoBackupEnabled !== 'boolean') {
        return res.status(400).json({ error: 'autoBackupEnabled must be a boolean.' });
      }
      req.user.autoBackupEnabled = autoBackupEnabled;
    }

    await req.user.save();
    return res.json({ user: sanitizeUser(req.user), message: 'Settings updated.' });
  } catch (err) {
    console.error('[Auth] Update settings error:', err);
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const userWithHash = await User.findById(req.user._id).select('+passwordHash');
    const matches = await bcrypt.compare(currentPassword, userWithHash.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    userWithHash.passwordHash = await bcrypt.hash(newPassword, 12);
    await userWithHash.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[Auth] Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
}
