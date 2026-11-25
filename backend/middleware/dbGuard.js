import { connectDB, getDbStatus, isDbConnected } from '../config/db.js';

export async function requireDbConnection(req, res, next) {
  if (!isDbConnected()) {
    await connectDB();
  }

  if (!isDbConnected()) {
    const status = getDbStatus();
    return res.status(503).json({
      error:
        status.error ||
        'MongoDB Atlas is not connected yet. Configure MONGODB_URI and allow 0.0.0.0/0 in Atlas Network Access.',
      code: 'DB_NOT_CONNECTED',
    });
  }
  next();
}
