import crypto from 'crypto';

export function computeBufferSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function computeStreamSha256(readableStream) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    readableStream.on('data', (chunk) => hash.update(chunk));
    readableStream.on('end', () => resolve(hash.digest('hex')));
    readableStream.on('error', reject);
  });
}
