import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let uploadsBucket = null;
let backupsBucket = null;
let lastConnectionError = null;
let listenersAttached = false;
let activeConnectPromise = null;

function sanitizeMongoUri(rawUri) {
  if (!rawUri) return '';
  let cleaned = rawUri.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function normalizeMongoCredentials(uri) {
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.+)$/i);
  if (!match) return { uri, placeholderDetected: false };

  const [, scheme, rest] = match;
  const slashIdx = rest.indexOf('/');
  const authorityPart = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  const pathPart = slashIdx === -1 ? '' : rest.slice(slashIdx);

  const atIdx = authorityPart.lastIndexOf('@');
  if (atIdx === -1) return { uri, placeholderDetected: false };

  const userInfo = authorityPart.slice(0, atIdx);
  const hostPart = authorityPart.slice(atIdx + 1);
  const colonIdx = userInfo.indexOf(':');
  if (colonIdx === -1) return { uri, placeholderDetected: false };

  const rawUser = userInfo.slice(0, colonIdx);
  const rawPass = userInfo.slice(colonIdx + 1);

  if (/^<.*>$/.test(rawPass) || /^<.*>$/.test(rawUser) || rawPass === 'MY_MONGODB_URI') {
    return { uri, placeholderDetected: true };
  }

  const safeEncode = (val) => {
    try {
      const decoded = decodeURIComponent(val);
      if (encodeURIComponent(decoded) === val) {
        return val;
      }
      return encodeURIComponent(decoded);
    } catch {
      return encodeURIComponent(val);
    }
  };

  const normalizedUri = `${scheme}${safeEncode(rawUser)}:${safeEncode(rawPass)}@${hostPart}${pathPart}`;
  return { uri: normalizedUri, placeholderDetected: false };
}

function formatAtlasError(err) {
  const msg = String(err?.message || 'Unknown MongoDB connection error.');
  if (msg.includes('SSL alert number 80') || msg.toLowerCase().includes('whitelist')) {
    return (
      'MongoDB Atlas blocked the connection (TLS alert 80 / IP not whitelisted). ' +
      'In MongoDB Atlas, go to Network Access -> Add IP Address -> Allow Access from Anywhere (0.0.0.0/0), ' +
      'then click Retry Atlas Connection.'
    );
  }
  if (msg.toLowerCase().includes('authentication failed') || msg.includes('bad auth')) {
    return (
      'MongoDB Atlas authentication failed (bad auth). Verify your Database Access username and password ' +
      'in MONGODB_URI (remove any < > brackets around the password and ensure the user has readWrite access).'
    );
  }
  return msg;
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1 && uploadsBucket !== null && backupsBucket !== null;
}

export function getDbStatus() {
  const uri = sanitizeMongoUri(process.env.MONGODB_URI);
  const configured = uri.length > 0;
  return {
    configured,
    connected: isDbConnected(),
    readyState: mongoose.connection.readyState,
    error: isDbConnected() ? null : lastConnectionError,
  };
}

export function getBuckets() {
  if (!uploadsBucket || !backupsBucket) {
    throw new Error('GridFS buckets are not initialized. Verify MongoDB Atlas connection.');
  }
  return { uploadsBucket, backupsBucket };
}

function initBuckets() {
  const db = mongoose.connection.db;
  if (!db) return;
  uploadsBucket = new GridFSBucket(db, { bucketName: 'uploads' });
  backupsBucket = new GridFSBucket(db, { bucketName: 'backups' });
}

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    initBuckets();
    lastConnectionError = null;
    console.log('[DB] Connected to MongoDB Atlas and initialized GridFS buckets (uploads, backups).');
  });

  mongoose.connection.on('disconnected', () => {
    uploadsBucket = null;
    backupsBucket = null;
    console.warn('[DB] Disconnected from MongoDB Atlas.');
  });

  mongoose.connection.on('error', (err) => {
    lastConnectionError = formatAtlasError(err);
  });
}

export async function connectDB() {
  if (isDbConnected()) {
    return true;
  }

  if (activeConnectPromise) {
    return activeConnectPromise;
  }

  const rawUri = sanitizeMongoUri(process.env.MONGODB_URI);

  if (!rawUri) {
    lastConnectionError = 'MONGODB_URI environment variable is not set.';
    console.warn('[DB] MONGODB_URI is not configured. Running in setup-pending mode until MongoDB Atlas URI is provided.');
    return false;
  }

  const { uri, placeholderDetected } = normalizeMongoCredentials(rawUri);
  if (placeholderDetected) {
    lastConnectionError =
      'MONGODB_URI still contains a <password> or <username> placeholder. Replace it with your MongoDB Atlas Database Access credentials in Settings -> Secrets.';
    console.warn('[DB]', lastConnectionError);
    return false;
  }

  attachConnectionListeners();

  activeConnectPromise = (async () => {
    try {
      if (mongoose.connection.readyState === 2) {
        return isDbConnected();
      }

      await mongoose.connect(uri, {
        family: 4,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: true,
      });

      initBuckets();
      lastConnectionError = null;
      return true;
    } catch (err) {
      lastConnectionError = formatAtlasError(err);
      console.warn('[DB] Connection failed:', lastConnectionError);
      return false;
    } finally {
      activeConnectPromise = null;
    }
  })();

  return activeConnectPromise;
}
