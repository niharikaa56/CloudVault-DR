import mongoose from 'mongoose';

const backupSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
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
    versionNumber: {
      type: Number,
      required: true,
    },
    backupType: {
      type: String,
      enum: ['auto', 'manual', 'pre-restore'],
      default: 'auto',
    },
    gridFsBackupId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

backupSchema.index({ owner: 1, fileId: 1, versionNumber: -1 });

const Backup = mongoose.model('Backup', backupSchema);
export default Backup;
