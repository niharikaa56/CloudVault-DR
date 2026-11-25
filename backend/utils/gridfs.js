import { Readable } from 'stream';
import mongoose from 'mongoose';

export function uploadBufferToBucket(bucket, buffer, filename, metadata = {}, contentType = 'application/octet-stream') {
  return new Promise((resolve, reject) => {
    const readable = Readable.from(buffer);
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata,
    });

    readable
      .pipe(uploadStream)
      .on('error', (err) => reject(err))
      .on('finish', () => resolve(uploadStream.id));
  });
}

export function readBufferFromBucket(bucket, fileId) {
  return new Promise((resolve, reject) => {
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    const chunks = [];
    const downloadStream = bucket.openDownloadStream(objectId);

    downloadStream.on('data', (chunk) => chunks.push(chunk));
    downloadStream.on('error', (err) => reject(err));
    downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export function openBucketDownloadStream(bucket, fileId) {
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(objectId);
}

export async function fileExistsInBucket(bucket, fileId) {
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  const files = await bucket.find({ _id: objectId }).limit(1).toArray();
  return files.length > 0 ? files[0] : null;
}

export async function deleteFromBucket(bucket, fileId) {
  if (!fileId) return;
  try {
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    await bucket.delete(objectId);
  } catch (err) {
    // Ignore if already deleted from GridFS
    if (!String(err.message).includes('File not found')) {
      throw err;
    }
  }
}

export function sanitizeFilename(filename) {
  const base = String(filename || 'recovered-file')
    .replace(/[\r\n"]/g, '')
    .replace(/[/\\]/g, '_');
  return base || 'recovered-file';
}
