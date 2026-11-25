import express from 'express';
import {
  getDashboardStats,
  getRecoverableCatalog,
  getRecoveryHistory,
  recoverAndDownloadFromBackup,
  restoreVersionToVault,
} from '../controllers/recoveryController.js';
import { protect } from '../middleware/auth.js';
import { requireDbConnection } from '../middleware/dbGuard.js';

const router = express.Router();

router.use(requireDbConnection, protect);

router.get('/dashboard', getDashboardStats);
router.get('/catalog', getRecoverableCatalog);
router.get('/history', getRecoveryHistory);
router.get('/recover/:backupId', recoverAndDownloadFromBackup);
router.post('/restore', restoreVersionToVault);

export default router;
