import { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert,
  Download,
  RotateCcw,
  CheckCircle2,
  Search,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import {
  recoveryApi,
  filesApi,
  getErrorMessage,
  triggerBrowserDownload,
} from '../services/api';
import { formatBytes, formatDateTime, shortenHash } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';

export default function DisasterRecoveryPage() {
  const { notify } = useNotifications();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVersions, setSelectedVersions] = useState({});
  const [busyKey, setBusyKey] = useState('');

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const data = await recoveryApi.getCatalog();
      const items = data.catalog || [];
      setCatalog(items);
      const defaults = {};
      for (const item of items) {
        if (item.backups?.length > 0) {
          defaults[item._id] = item.backups[0]._id;
        }
      }
      setSelectedVersions((prev) => ({ ...defaults, ...prev }));
    } catch (err) {
      notify({
        type: 'error',
        title: 'Failed to load recovery catalog',
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  async function handleRecoverDownload(file) {
    const backupId = selectedVersions[file._id];
    if (!backupId) return;

    setBusyKey(`dl-${file._id}`);
    try {
      const blob = await recoveryApi.recoverDownloadBlob(backupId);
      triggerBrowserDownload(blob, file.originalName);
      notify({
        type: 'success',
        title: 'File recovered to computer',
        message: `"${file.originalName}" passed SHA-256 verification and was recovered from MongoDB Atlas GridFS.`,
      });
    } catch (err) {
      notify({
        type: 'error',
        title: 'Recovery download failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyKey('');
    }
  }

  async function handleRecoverPrimary(file) {
    setBusyKey(`primary-${file._id}`);
    try {
      const blob = await filesApi.downloadBlob(file._id);
      triggerBrowserDownload(blob, file.originalName);
      notify({
        type: 'success',
        title: 'Primary cloud copy downloaded',
        message: `"${file.originalName}" downloaded directly from the GridFS uploads vault.`,
      });
    } catch (err) {
      notify({
        type: 'error',
        title: 'Download failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyKey('');
    }
  }

  async function handleRestoreToVault(file) {
    const backupId = selectedVersions[file._id];
    if (!backupId) return;

    setBusyKey(`restore-${file._id}`);
    try {
      const data = await recoveryApi.restoreVersion(file._id, backupId);
      notify({
        type: 'success',
        title: 'Restored to active vault',
        message: data.message,
      });
      loadCatalog();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Restore failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyKey('');
    }
  }

  const filtered = catalog.filter((item) =>
    item.originalName.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Disaster Recovery Center
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 max-w-2xl">
                Lost or permanently deleted a file from your computer? Select any cloud-protected
                file below, pick a backup version, and recover it with live SHA-256 integrity
                verification from MongoDB Atlas GridFS.
              </p>
            </div>
          </div>

          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find deleted or lost file…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:w-64"
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-800">No recoverable files found</p>
          <p className="mt-1 text-xs text-slate-500">
            Upload files in My Files to protect them in MongoDB Atlas GridFS.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((file) => {
            const backups = file.backups || [];
            const selectedBackupId = selectedVersions[file._id] || '';
            const activeBackup = backups.find((b) => b._id === selectedBackupId) || backups[0];

            return (
              <div
                key={file._id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                      {file.originalName}
                    </h3>
                    {file.isDeleted && (
                      <span className="text-xs font-medium text-amber-700">
                        · In Recycle Bin (Backup Protected)
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                    <span>{formatBytes(file.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Primary SHA-256: {shortenHash(file.sha256Hash, 8)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-sans font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {backups.length} backup {backups.length === 1 ? 'version' : 'versions'} available
                    </span>
                  </div>

                  {activeBackup && (
                    <p className="text-xs text-slate-500">
                      Selected snapshot: Version {activeBackup.versionNumber} ({activeBackup.backupType}) ·{' '}
                      <span className="font-mono tabular-nums">{formatDateTime(activeBackup.createdAt)}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center shrink-0">
                  {backups.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
                        <select
                          value={selectedBackupId}
                          onChange={(e) =>
                            setSelectedVersions((prev) => ({
                              ...prev,
                              [file._id]: e.target.value,
                            }))
                          }
                          aria-label={`Select backup version for ${file.originalName}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                        >
                          {backups.map((b) => (
                            <option key={b._id} value={b._id}>
                              v{b.versionNumber} ({b.backupType}) · {formatBytes(b.size)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={busyKey !== ''}
                        onClick={() => handleRestoreToVault(file)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                        <span>
                          {busyKey === `restore-${file._id}` ? 'Restoring…' : 'Restore to Vault'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={busyKey !== ''}
                        onClick={() => handleRecoverDownload(file)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>
                          {busyKey === `dl-${file._id}` ? 'Recovering…' : 'Recover & Download'}
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busyKey !== ''}
                      onClick={() => handleRecoverPrimary(file)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>
                        {busyKey === `primary-${file._id}`
                          ? 'Downloading…'
                          : 'Download Primary Copy'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
