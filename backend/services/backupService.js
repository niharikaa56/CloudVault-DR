import Backup from '../models/Backup.js';
import RecoveryHistory from '../models/RecoveryHistory.js';
import { getBuckets } from '../config/db.js';
import { computeBufferSha256 } from '../utils/hash.js';
import { readBufferFromBucket, uploadBufferToBucket } from '../utils/gridfs.js';

export async function createBackupFromBuffer({
  userId,
  fileRecord,
  buffer,
  backupType = 'auto',
  notes = '',
}) {
  const { backupsBucket } = getBuckets();
  const sha256Hash = computeBufferSha256(buffer);

  const latestBackup = await Backup.findOne({
    owner: userId,
    fileId: fileRecord._id,
  })
    .sort({ versionNumber: -1 })
    .select('versionNumber')
    .lean();

  const nextVersion = (latestBackup?.versionNumber || 0) + 1;

  const gridFsBackupId = await uploadBufferToBucket(
    backupsBucket,
    buffer,
    `v${nextVersion}_${fileRecord.originalName}`,
    {
      owner: String(userId),
      fileId: String(fileRecord._id),
      versionNumber: nextVersion,
      backupType,
      sha256Hash,
    },
    fileRecord.mimeType
  );

  const backupDoc = await Backup.create({
    owner: userId,
    fileId: fileRecord._id,
    fileName: fileRecord.originalName,
    mimeType: fileRecord.mimeType,
    size: buffer.length,
    sha256Hash,
    versionNumber: nextVersion,
    backupType,
    gridFsBackupId,
    status: 'completed',
    notes:
      notes ||
      (backupType === 'auto'
        ? 'Automatic cloud backup created immediately after upload'
        : 'Manual disaster recovery snapshot created by user'),
  });

  fileRecord.backupCount = (fileRecord.backupCount || 0) + 1;
  fileRecord.lastBackupAt = backupDoc.createdAt;
  await fileRecord.save();

  await RecoveryHistory.create({
    owner: userId,
    fileId: fileRecord._id,
    backupId: backupDoc._id,
    fileName: fileRecord.originalName,
    actionType: backupType === 'auto' ? 'auto_backup' : 'manual_backup',
    versionRestored: nextVersion,
    sha256Verified: true,
    sha256Hash,
    status: 'success',
    details: `Backup v${nextVersion} stored in MongoDB Atlas GridFS (${backupType}).`,
  });

  return backupDoc;
}

export async function createBackupFromPrimaryFile({
  userId,
  fileRecord,
  backupType = 'manual',
  notes = '',
}) {
  const { uploadsBucket } = getBuckets();
  const buffer = await readBufferFromBucket(uploadsBucket, fileRecord.gridFsFileId);
  const actualHash = computeBufferSha256(buffer);

  if (actualHash !== fileRecord.sha256Hash) {
    fileRecord.integrityStatus = 'mismatch';
    await fileRecord.save();
    throw new Error('Primary file checksum mismatch detected. Recover from an earlier verified backup instead.');
  }

  return createBackupFromBuffer({
    userId,
    fileRecord,
    buffer,
    backupType,
    notes,
  });
}
