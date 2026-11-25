import RecoveryHistory from '../models/RecoveryHistory.js';
import { getBuckets } from '../config/db.js';
import { computeBufferSha256, computeStreamSha256 } from '../utils/hash.js';
import {
  deleteFromBucket,
  fileExistsInBucket,
  openBucketDownloadStream,
  readBufferFromBucket,
  uploadBufferToBucket,
} from '../utils/gridfs.js';

export async function verifyPrimaryFileIntegrity(userId, fileRecord) {
  const { uploadsBucket } = getBuckets();
  const exists = await fileExistsInBucket(uploadsBucket, fileRecord.gridFsFileId);

  if (!exists) {
    fileRecord.integrityStatus = 'mismatch';
    fileRecord.lastVerifiedAt = new Date();
    await fileRecord.save();

    await RecoveryHistory.create({
      owner: userId,
      fileId: fileRecord._id,
      fileName: fileRecord.originalName,
      actionType: 'integrity_check',
      versionRestored: fileRecord.currentVersion,
      sha256Verified: false,
      sha256Hash: fileRecord.sha256Hash,
      status: 'failed',
      details: 'Primary GridFS object missing. File can still be recovered from cloud backup copies.',
    });

    return {
      verified: false,
      expectedHash: fileRecord.sha256Hash,
      actualHash: null,
      message: 'Primary GridFS object missing. Use Disaster Recovery to restore from backup.',
    };
  }

  const stream = openBucketDownloadStream(uploadsBucket, fileRecord.gridFsFileId);
  const actualHash = await computeStreamSha256(stream);
  const verified = actualHash === fileRecord.sha256Hash;

  fileRecord.integrityStatus = verified ? 'verified' : 'mismatch';
  fileRecord.lastVerifiedAt = new Date();
  await fileRecord.save();

  await RecoveryHistory.create({
    owner: userId,
    fileId: fileRecord._id,
    fileName: fileRecord.originalName,
    actionType: 'integrity_check',
    versionRestored: fileRecord.currentVersion,
    sha256Verified: verified,
    sha256Hash: actualHash,
    status: verified ? 'success' : 'failed',
    details: verified
      ? 'SHA-256 integrity verified against MongoDB Atlas GridFS stream.'
      : `SHA-256 mismatch detected (expected ${fileRecord.sha256Hash.slice(0, 12)}..., got ${actualHash.slice(0, 12)}...).`,
  });

  return {
    verified,
    expectedHash: fileRecord.sha256Hash,
    actualHash,
    message: verified
      ? 'SHA-256 checksum matches stored cloud signature.'
      : 'Integrity mismatch detected. Restore from a verified backup copy.',
  };
}

export async function verifyBackupIntegrity(backupRecord) {
  const { backupsBucket } = getBuckets();
  const exists = await fileExistsInBucket(backupsBucket, backupRecord.gridFsBackupId);
  if (!exists) {
    return { verified: false, actualHash: null };
  }
  const stream = openBucketDownloadStream(backupsBucket, backupRecord.gridFsBackupId);
  const actualHash = await computeStreamSha256(stream);
  return {
    verified: actualHash === backupRecord.sha256Hash,
    actualHash,
  };
}

export async function restoreFileFromBackup({ userId, fileRecord, backupRecord }) {
  const { uploadsBucket, backupsBucket } = getBuckets();

  const backupBuffer = await readBufferFromBucket(backupsBucket, backupRecord.gridFsBackupId);
  const actualHash = computeBufferSha256(backupBuffer);

  if (actualHash !== backupRecord.sha256Hash) {
    await RecoveryHistory.create({
      owner: userId,
      fileId: fileRecord._id,
      backupId: backupRecord._id,
      fileName: fileRecord.originalName,
      actionType: 'restore_version',
      versionRestored: backupRecord.versionNumber,
      sha256Verified: false,
      sha256Hash: actualHash,
      status: 'failed',
      details: 'Backup SHA-256 verification failed during restore.',
    });
    throw new Error('Backup integrity verification failed. Restore aborted.');
  }

  const newPrimaryGridFsId = await uploadBufferToBucket(
    uploadsBucket,
    backupBuffer,
    fileRecord.originalName,
    {
      owner: String(userId),
      restoredFromBackupId: String(backupRecord._id),
      versionNumber: backupRecord.versionNumber,
      sha256Hash: actualHash,
    },
    backupRecord.mimeType || fileRecord.mimeType
  );

  const oldPrimaryGridFsId = fileRecord.gridFsFileId;

  fileRecord.gridFsFileId = newPrimaryGridFsId;
  fileRecord.size = backupBuffer.length;
  fileRecord.sha256Hash = actualHash;
  fileRecord.currentVersion = backupRecord.versionNumber;
  fileRecord.isDeleted = false;
  fileRecord.deletedAt = null;
  fileRecord.integrityStatus = 'verified';
  fileRecord.lastVerifiedAt = new Date();
  await fileRecord.save();

  if (oldPrimaryGridFsId && String(oldPrimaryGridFsId) !== String(newPrimaryGridFsId)) {
    await deleteFromBucket(uploadsBucket, oldPrimaryGridFsId);
  }

  await RecoveryHistory.create({
    owner: userId,
    fileId: fileRecord._id,
    backupId: backupRecord._id,
    fileName: fileRecord.originalName,
    actionType: 'restore_version',
    versionRestored: backupRecord.versionNumber,
    sha256Verified: true,
    sha256Hash: actualHash,
    status: 'success',
    details: `Restored active cloud copy from Backup v${backupRecord.versionNumber} with verified SHA-256.`,
  });

  return fileRecord;
}
