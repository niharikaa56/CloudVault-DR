import express from 'express';
import {
  downloadFile,
  emptyTrash,
  getFileById,
  listFiles,
  listTrash,
  permanentDeleteFile,
  restoreFromTrash,
  softDeleteFile,
  uploadFiles,
  verifyFile,
} from '../controllers/fileController.js';
import { protect } from '../middleware/auth.js';
import { requireDbConnection } from '../middleware/dbGuard.js';
import { uploadMultipleMiddleware } from '../middleware/upload.js';

const router = express.Router();

router.use(requireDbConnection, protect);

router.get('/', listFiles);
router.get('/trash', listTrash);
router.delete('/trash/empty', emptyTrash);
router.post('/upload', uploadMultipleMiddleware, uploadFiles);
router.get('/:id', getFileById);
router.get('/:id/download', downloadFile);
router.post('/:id/verify', verifyFile);
router.post('/:id/restore', restoreFromTrash);
router.delete('/:id', softDeleteFile);
router.delete('/:id/permanent', permanentDeleteFile);

export default router;
