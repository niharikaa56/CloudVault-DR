import mongoose from 'mongoose';

const recoveryHistorySchema = new mongoose.Schema(
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
      default: null,
    },
    backupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Backup',
      default: null,
    },
    fileName: {
      type: String,
      required: true,
    },
    actionType: {
      type: String,
      enum: [
        'auto_backup',
        'manual_backup',
        'download_original',
        'download_backup',
        'recover_from_backup',
        'restore_version',
        'restore_from_bin',
        'integrity_check',
      ],
      required: true,
    },
    versionRestored: {
      type: Number,
      default: 1,
    },
    sha256Verified: {
      type: Boolean,
      default: true,
    },
    sha256Hash: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    details: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

recoveryHistorySchema.index({ owner: 1, createdAt: -1 });

const RecoveryHistory = mongoose.model('RecoveryHistory', recoveryHistorySchema);
export default RecoveryHistory;
