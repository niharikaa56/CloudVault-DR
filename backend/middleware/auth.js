import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();
  return configured && configured.length > 0 ? configured : EPHEMERAL_SECRET;
}

export function signToken(userId) {
  return jwt.sign({ id: String(userId) }, getJwtSecret(), { expiresIn: '7d' });
}

export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Authentication token is missing.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}
