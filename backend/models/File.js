import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    size: {
      type: Number,
      required: true,
    },
    sha256Hash: {
      type: String,
      required: true,
    },
    gridFsFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    backupCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    lastBackupAt: {
      type: Date,
      default: null,
    },
    lastVerifiedAt: {
      type: Date,
      default: Date.now,
    },
    integrityStatus: {
      type: String,
      enum: ['verified', 'mismatch', 'pending'],
      default: 'verified',
    },
  },
  {
    timestamps: true,
  }
);

fileSchema.index({ owner: 1, isDeleted: 1, createdAt: -1 });

const FileRecord = mongoose.model('File', fileSchema);
export default FileRecord;
