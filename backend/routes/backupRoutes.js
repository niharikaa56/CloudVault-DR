import express from 'express';
import {
  createManualBackup,
  deleteBackup,
  downloadBackup,
  listBackups,
  listFileBackups,
} from '../controllers/backupController.js';
import { protect } from '../middleware/auth.js';
import { requireDbConnection } from '../middleware/dbGuard.js';

const router = express.Router();

router.use(requireDbConnection, protect);

router.get('/', listBackups);
router.get('/file/:fileId', listFileBackups);
router.post('/file/:fileId', createManualBackup);
router.get('/:id/download', downloadBackup);
router.delete('/:id', deleteBackup);

export default router;
