import mongoose from 'mongoose';
import FileRecord from '../models/File.js';
import Backup from '../models/Backup.js';
import RecoveryHistory from '../models/RecoveryHistory.js';
import { getBuckets } from '../config/db.js';
import {
  deleteFromBucket,
  fileExistsInBucket,
  openBucketDownloadStream,
  sanitizeFilename,
} from '../utils/gridfs.js';
import { createBackupFromPrimaryFile } from '../services/backupService.js';

export async function createManualBackup(req, res) {
  try {
    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOne({ _id: fileId, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 240) : '';

    const backup = await createBackupFromPrimaryFile({
      userId: req.user._id,
      fileRecord: file,
      backupType: 'manual',
      notes,
    });

    return res.status(201).json({
      message: `Manual backup v${backup.versionNumber} created in MongoDB Atlas GridFS.`,
      backup,
      file,
    });
  } catch (err) {
    console.error('[Backups] Create manual backup error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create manual backup.' });
  }
}

export async function listBackups(req, res) {
  try {
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const query = { owner: req.user._id };
    if (typeFilter === 'auto' || typeFilter === 'manual' || typeFilter === 'pre-restore') {
      query.backupType = typeFilter;
    }
    if (search) {
      query.fileName = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const backups = await Backup.find(query)
      .populate('fileId', 'originalName isDeleted currentVersion integrityStatus')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ backups });
  } catch (err) {
    console.error('[Backups] List error:', err);
    return res.status(500).json({ error: 'Failed to load backups.' });
  }
}

export async function listFileBackups(req, res) {
  try {
    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await FileRecord.findOne({ _id: fileId, owner: req.user._id }).lean();
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const backups = await Backup.find({ owner: req.user._id, fileId: file._id })
      .sort({ versionNumber: -1 })
      .lean();

    return res.json({ file, backups });
  } catch (err) {
    console.error('[Backups] File backups error:', err);
    return res.status(500).json({ error: 'Failed to load file backup versions.' });
  }
}

export async function downloadBackup(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid backup ID.' });
    }

    const backup = await Backup.findOne({ _id: id, owner: req.user._id });
    if (!backup) {
      return res.status(404).json({ error: 'Backup snapshot not found or access denied.' });
    }

    const { backupsBucket } = getBuckets();
    const exists = await fileExistsInBucket(backupsBucket, backup.gridFsBackupId);
    if (!exists) {
      return res.status(404).json({ error: 'Backup data missing from GridFS.' });
    }

    const safeName = sanitizeFilename(backup.fileName);
    res.setHeader('Content-Type', backup.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Backup-SHA256', backup.sha256Hash);

    await RecoveryHistory.create({
      owner: req.user._id,
      fileId: backup.fileId,
      backupId: backup._id,
      fileName: backup.fileName,
      actionType: 'download_backup',
      versionRestored: backup.versionNumber,
      sha256Verified: true,
      sha256Hash: backup.sha256Hash,
      status: 'success',
      details: `Downloaded Backup v${backup.versionNumber} directly from GridFS backup bucket.`,
    });

    const stream = openBucketDownloadStream(backupsBucket, backup.gridFsBackupId);
    stream.on('error', (streamErr) => {
      console.error('[Backups] Download stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming backup from GridFS.' });
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('[Backups] Download error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to download backup snapshot.' });
    }
  }
}

export async function deleteBackup(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid backup ID.' });
    }

    const backup = await Backup.findOne({ _id: id, owner: req.user._id });
    if (!backup) {
      return res.status(404).json({ error: 'Backup snapshot not found.' });
    }

    const { backupsBucket } = getBuckets();
    await deleteFromBucket(backupsBucket, backup.gridFsBackupId);
    await Backup.deleteOne({ _id: backup._id, owner: req.user._id });

    await FileRecord.updateOne(
      { _id: backup.fileId, owner: req.user._id, backupCount: { $gt: 0 } },
      { $inc: { backupCount: -1 } }
    );

    return res.json({ message: `Backup v${backup.versionNumber} deleted.` });
  } catch (err) {
    console.error('[Backups] Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete backup snapshot.' });
  }
}
