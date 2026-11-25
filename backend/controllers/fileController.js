import mongoose from 'mongoose';
import FileRecord from '../models/File.js';
import Backup from '../models/Backup.js';
import RecoveryHistory from '../models/RecoveryHistory.js';
import { getBuckets } from '../config/db.js';
import { computeBufferSha256 } from '../utils/hash.js';
import {
  deleteFromBucket,
  fileExistsInBucket,
  openBucketDownloadStream,
  sanitizeFilename,
  uploadBufferToBucket,
} from '../utils/gridfs.js';
import { createBackupFromBuffer } from '../services/backupService.js';
import { verifyPrimaryFileIntegrity } from '../services/recoveryService.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCategoryFilter(category) {
  switch (category) {
    case 'documents':
      return /^(application\/(pdf|msword|vnd\.|rtf)|text\/)/i;
    case 'images':
      return /^image\//i;
    case 'archives':
      return /(zip|tar|gzip|rar|7z|compressed)/i;
    case 'media':
      return /^(video|audio)\//i;
    default:
      return null;
  }
}

export async function uploadFiles(req, res) {
  try {
    const incomingFiles = req.files;
    if (!incomingFiles || incomingFiles.length === 0) {
      return res.status(400).json({ error: 'Please select at least one file to upload.' });
    }

    const shouldAutoBackup =
      req.body?.autoBackup !== undefined
        ? req.body.autoBackup !== 'false'
        : req.user.autoBackupEnabled !== false;

    const [activeUsageAgg, backupUsageAgg] = await Promise.all([
      FileRecord.aggregate([
        { $match: { owner: req.user._id } },
        { $group: { _id: null, total: { $sum: '$size' } } },
      ]),
      Backup.aggregate([
        { $match: { owner: req.user._id } },
        { $group: { _id: null, total: { $sum: '$size' } } },
      ]),
    ]);

    const currentUsed = (activeUsageAgg[0]?.total || 0) + (backupUsageAgg[0]?.total || 0);
    const incomingTotal = incomingFiles.reduce((sum, f) => sum + f.size, 0);
    const projectedAdditional = shouldAutoBackup ? incomingTotal * 2 : incomingTotal;

    if (currentUsed + projectedAdditional > req.user.storageQuotaBytes) {
      return res.status(400).json({
        error: 'Upload exceeds your cloud storage quota. Free space in Recycle Bin or Backup Management.',
      });
    }

    const { uploadsBucket } = getBuckets();
    const uploadedResults = [];

    for (const file of incomingFiles) {
      const sha256Hash = computeBufferSha256(file.buffer);
      const safeOriginalName = sanitizeFilename(file.originalname);
      const mimeType = file.mimetype || 'application/octet-stream';

      const gridFsFileId = await uploadBufferToBucket(
        uploadsBucket,
        file.buffer,
        safeOriginalName,
        {
          owner: String(req.user._id),
          sha256Hash,
          uploadedAt: new Date().toISOString(),
        },
        mimeType
      );

      const fileRecord = await FileRecord.create({
        owner: req.user._id,
        originalName: safeOriginalName,
        mimeType,
        size: file.size,
        sha256Hash,
        gridFsFileId,
        currentVersion: 1,
        backupCount: 0,
        integrityStatus: 'verified',
        lastVerifiedAt: new Date(),
      });

      let backupRecord = null;
      if (shouldAutoBackup) {
        backupRecord = await createBackupFromBuffer({
          userId: req.user._id,
          fileRecord,
          buffer: file.buffer,
          backupType: 'auto',
        });
      }

      uploadedResults.push({
        file: fileRecord,
        backup: backupRecord,
      });
    }

    return res.status(201).json({
      message: `${uploadedResults.length} file${uploadedResults.length > 1 ? 's' : ''} uploaded to MongoDB Atlas GridFS${shouldAutoBackup ? ' with automatic backup copies' : ''}.`,
      items: uploadedResults,
    });
  } catch (err) {
    console.error('[Files] Upload error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload files.' });
  }
}

export async function listFiles(req, res) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : 'all';
    const sortBy = typeof req.query.sort === 'string' ? req.query.sort : 'newest';

    const query = {
      owner: req.user._id,
      isDeleted: false,
    };

    if (search) {
      query.originalName = { $regex: escapeRegex(search), $options: 'i' };
    }

    const mimeRegex = buildCategoryFilter(category);
    if (mimeRegex) {
      query.mimeType = { $regex: mimeRegex };
    }

    let sortOption = { createdAt: -1 };
    if (sortBy === 'oldest') sortOption = { createdAt: 1 };
    if (sortBy === 'largest') sortOption = { size: -1 };
    if (sortBy === 'name') sortOption = { originalName: 1 };

    const files = await FileRecord.find(query).sort(sortOption).lean();
    return res.json({ files });
  } catch (err) {
    console.error('[Files] List error:', err);
    return res.status(500).json({ error: 'Failed to load files.' });
  }
}

export async function getFileById(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOne({ _id: id, owner: req.user._id }).lean();
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const backups = await Backup.find({ owner: req.user._id, fileId: file._id })
      .sort({ versionNumber: -1 })
      .lean();

    return res.json({ file, backups });
  } catch (err) {
    console.error('[Files] Get by ID error:', err);
    return res.status(500).json({ error: 'Failed to load file details.' });
  }
}

export async function downloadFile(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOne({ _id: id, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    const { uploadsBucket } = getBuckets();
    const exists = await fileExistsInBucket(uploadsBucket, file.gridFsFileId);
    if (!exists) {
      return res.status(404).json({
        error: 'Primary GridFS object not found. Use Disaster Recovery to restore from a cloud backup copy.',
      });
    }

    const safeName = sanitizeFilename(file.originalName);
    const isInlinePreview = req.query.inline === 'true';

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${isInlinePreview ? 'inline' : 'attachment'}; filename="${safeName}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-File-SHA256', file.sha256Hash);

    if (!isInlinePreview) {
      await RecoveryHistory.create({
        owner: req.user._id,
        fileId: file._id,
        fileName: file.originalName,
        actionType: 'download_original',
        versionRestored: file.currentVersion,
        sha256Verified: true,
        sha256Hash: file.sha256Hash,
        status: 'success',
        details: `Downloaded cloud file copy (v${file.currentVersion}) to local computer.`,
      });
    }

    const stream = openBucketDownloadStream(uploadsBucket, file.gridFsFileId);
    stream.on('error', (streamErr) => {
      console.error('[Files] Download stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file from GridFS.' });
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('[Files] Download error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to download file.' });
    }
  }
}

export async function verifyFile(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOne({ _id: id, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const result = await verifyPrimaryFileIntegrity(req.user._id, file);
    return res.json({ ...result, file });
  } catch (err) {
    console.error('[Files] Verify error:', err);
    return res.status(500).json({ error: 'Failed to verify SHA-256 integrity.' });
  }
}

export async function softDeleteFile(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOneAndUpdate(
      { _id: id, owner: req.user._id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    return res.json({ message: 'File moved to Recycle Bin. Cloud backup copies remain protected.', file });
  } catch (err) {
    console.error('[Files] Soft delete error:', err);
    return res.status(500).json({ error: 'Failed to move file to Recycle Bin.' });
  }
}

export async function listTrash(req, res) {
  try {
    const files = await FileRecord.find({ owner: req.user._id, isDeleted: true })
      .sort({ deletedAt: -1 })
      .lean();
    return res.json({ files });
  } catch (err) {
    console.error('[Files] List trash error:', err);
    return res.status(500).json({ error: 'Failed to load Recycle Bin.' });
  }
}

export async function restoreFromTrash(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOneAndUpdate(
      { _id: id, owner: req.user._id, isDeleted: true },
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found in Recycle Bin.' });
    }

    await RecoveryHistory.create({
      owner: req.user._id,
      fileId: file._id,
      fileName: file.originalName,
      actionType: 'restore_from_bin',
      versionRestored: file.currentVersion,
      sha256Verified: true,
      sha256Hash: file.sha256Hash,
      status: 'success',
      details: 'Restored file from Recycle Bin back to active My Files vault.',
    });

    return res.json({ message: 'File restored to My Files.', file });
  } catch (err) {
    console.error('[Files] Restore from trash error:', err);
    return res.status(500).json({ error: 'Failed to restore file from Recycle Bin.' });
  }
}

export async function permanentDeleteFile(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOne({ _id: id, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const { uploadsBucket, backupsBucket } = getBuckets();
    const backups = await Backup.find({ owner: req.user._id, fileId: file._id });

    await deleteFromBucket(uploadsBucket, file.gridFsFileId);
    for (const backup of backups) {
      await deleteFromBucket(backupsBucket, backup.gridFsBackupId);
    }

    await Backup.deleteMany({ owner: req.user._id, fileId: file._id });
    await FileRecord.deleteOne({ _id: file._id, owner: req.user._id });

    return res.json({ message: 'File and all associated backup snapshots permanently purged from GridFS.' });
  } catch (err) {
    console.error('[Files] Permanent delete error:', err);
    return res.status(500).json({ error: 'Failed to permanently delete file.' });
  }
}

export async function emptyTrash(req, res) {
  try {
    const trashedFiles = await FileRecord.find({ owner: req.user._id, isDeleted: true });
    const { uploadsBucket, backupsBucket } = getBuckets();

    for (const file of trashedFiles) {
      await deleteFromBucket(uploadsBucket, file.gridFsFileId);
      const backups = await Backup.find({ owner: req.user._id, fileId: file._id });
      for (const backup of backups) {
        await deleteFromBucket(backupsBucket, backup.gridFsBackupId);
      }
      await Backup.deleteMany({ owner: req.user._id, fileId: file._id });
      await FileRecord.deleteOne({ _id: file._id, owner: req.user._id });
    }

    return res.json({
      message: `Permanently removed ${trashedFiles.length} file${trashedFiles.length === 1 ? '' : 's'} from Recycle Bin.`,
    });
  } catch (err) {
    console.error('[Files] Empty trash error:', err);
    return res.status(500).json({ error: 'Failed to empty Recycle Bin.' });
  }
}
