import mongoose from 'mongoose';
import FileRecord from '../models/File.js';
import Backup from '../models/Backup.js';
import RecoveryHistory from '../models/RecoveryHistory.js';
import { getBuckets } from '../config/db.js';
import { openBucketDownloadStream, sanitizeFilename } from '../utils/gridfs.js';
import { restoreFileFromBackup, verifyBackupIntegrity } from '../services/recoveryService.js';

export async function getDashboardStats(req, res) {
  try {
    const ownerId = req.user._id;

    const [
      activeFilesCount,
      trashedFilesCount,
      totalBackupsCount,
      protectedFilesCount,
      activeSizeAgg,
      backupSizeAgg,
      recentFiles,
      recentRecoveries,
    ] = await Promise.all([
      FileRecord.countDocuments({ owner: ownerId, isDeleted: false }),
      FileRecord.countDocuments({ owner: ownerId, isDeleted: true }),
      Backup.countDocuments({ owner: ownerId, status: 'completed' }),
      FileRecord.countDocuments({ owner: ownerId, isDeleted: false, backupCount: { $gt: 0 } }),
      FileRecord.aggregate([
        { $match: { owner: ownerId } },
        { $group: { _id: null, total: { $sum: '$size' } } },
      ]),
      Backup.aggregate([
        { $match: { owner: ownerId } },
        { $group: { _id: null, total: { $sum: '$size' } } },
      ]),
      FileRecord.find({ owner: ownerId, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      RecoveryHistory.find({ owner: ownerId })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const primaryBytes = activeSizeAgg[0]?.total || 0;
    const backupBytes = backupSizeAgg[0]?.total || 0;
    const totalStorageBytes = primaryBytes + backupBytes;

    return res.json({
      stats: {
        totalFiles: activeFilesCount,
        trashedFiles: trashedFilesCount,
        totalBackups: totalBackupsCount,
        protectedFiles: protectedFilesCount,
        protectionRate:
          activeFilesCount > 0 ? Math.round((protectedFilesCount / activeFilesCount) * 100) : 100,
        primaryBytes,
        backupBytes,
        totalStorageBytes,
        storageQuotaBytes: req.user.storageQuotaBytes,
        autoBackupEnabled: req.user.autoBackupEnabled,
      },
      recentFiles,
      recentRecoveries,
    });
  } catch (err) {
    console.error('[Recovery] Dashboard stats error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
}

export async function getRecoverableCatalog(req, res) {
  try {
    const files = await FileRecord.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const backups = await Backup.find({ owner: req.user._id })
      .sort({ versionNumber: -1 })
      .lean();

    const backupsByFile = new Map();
    for (const backup of backups) {
      const key = String(backup.fileId);
      if (!backupsByFile.has(key)) backupsByFile.set(key, []);
      backupsByFile.get(key).push(backup);
    }

    const catalog = files.map((file) => ({
      ...file,
      backups: backupsByFile.get(String(file._id)) || [],
    }));

    return res.json({ catalog });
  } catch (err) {
    console.error('[Recovery] Catalog error:', err);
    return res.status(500).json({ error: 'Failed to load disaster recovery catalog.' });
  }
}

export async function recoverAndDownloadFromBackup(req, res) {
  try {
    const { backupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(backupId)) {
      return res.status(400).json({ error: 'Invalid backup ID.' });
    }

    const backup = await Backup.findOne({ _id: backupId, owner: req.user._id });
    if (!backup) {
      return res.status(404).json({ error: 'Backup snapshot not found or access denied.' });
    }

    const integrity = await verifyBackupIntegrity(backup);
    if (!integrity.verified) {
      await RecoveryHistory.create({
        owner: req.user._id,
        fileId: backup.fileId,
        backupId: backup._id,
        fileName: backup.fileName,
        actionType: 'recover_from_backup',
        versionRestored: backup.versionNumber,
        sha256Verified: false,
        sha256Hash: integrity.actualHash || '',
        status: 'failed',
        details: 'Backup SHA-256 verification failed before recovery download.',
      });
      return res.status(409).json({ error: 'Backup integrity check failed. Try another snapshot version.' });
    }

    const { backupsBucket } = getBuckets();
    const safeName = sanitizeFilename(backup.fileName);

    res.setHeader('Content-Type', backup.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Recovered-Version', String(backup.versionNumber));
    res.setHeader('X-File-SHA256', backup.sha256Hash);

    await RecoveryHistory.create({
      owner: req.user._id,
      fileId: backup.fileId,
      backupId: backup._id,
      fileName: backup.fileName,
      actionType: 'recover_from_backup',
      versionRestored: backup.versionNumber,
      sha256Verified: true,
      sha256Hash: backup.sha256Hash,
      status: 'success',
      details: `Recovered & downloaded Backup v${backup.versionNumber} with verified SHA-256 checksum.`,
    });

    const stream = openBucketDownloadStream(backupsBucket, backup.gridFsBackupId);
    stream.on('error', (streamErr) => {
      console.error('[Recovery] Stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming recovered file.' });
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('[Recovery] Recover download error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to recover file from backup.' });
    }
  }
}

export async function restoreVersionToVault(req, res) {
  try {
    const { fileId, backupId } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(fileId) || !mongoose.Types.ObjectId.isValid(backupId)) {
      return res.status(400).json({ error: 'Valid fileId and backupId are required.' });
    }

    const [fileRecord, backupRecord] = await Promise.all([
      FileRecord.findOne({ _id: fileId, owner: req.user._id }),
      Backup.findOne({ _id: backupId, fileId, owner: req.user._id }),
    ]);

    if (!fileRecord || !backupRecord) {
      return res.status(404).json({ error: 'File or backup version not found.' });
    }

    const updatedFile = await restoreFileFromBackup({
      userId: req.user._id,
      fileRecord,
      backupRecord,
    });

    return res.json({
      message: `Restored "${updatedFile.originalName}" to active cloud vault using Backup v${backupRecord.versionNumber}.`,
      file: updatedFile,
    });
  } catch (err) {
    console.error('[Recovery] Restore version error:', err);
    return res.status(500).json({ error: err.message || 'Failed to restore backup version.' });
  }
}

export async function getRecoveryHistory(req, res) {
  try {
    const actionType = typeof req.query.actionType === 'string' ? req.query.actionType : 'all';
    const query = { owner: req.user._id };

    const validActions = [
      'auto_backup',
      'manual_backup',
      'download_original',
      'download_backup',
      'recover_from_backup',
      'restore_version',
      'restore_from_bin',
      'integrity_check',
    ];

    if (validActions.includes(actionType)) {
      query.actionType = actionType;
    }

    const history = await RecoveryHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ history });
  } catch (err) {
    console.error('[Recovery] History error:', err);
    return res.status(500).json({ error: 'Failed to load recovery history.' });
  }
}
