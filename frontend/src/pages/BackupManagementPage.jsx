import { useCallback, useEffect, useState } from 'react';
import { HardDrive, Download, RotateCcw, Trash2, Search, Plus } from 'lucide-react';
import {
  backupsApi,
  filesApi,
  recoveryApi,
  getErrorMessage,
  triggerBrowserDownload,
} from '../services/api';
import { formatBytes, formatDateTime, shortenHash } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';
import ConfirmModal from '../components/ConfirmModal';

export default function BackupManagementPage() {
  const { notify } = useNotifications();
  const [backups, setBackups] = useState([]);
  const [activeFiles, setActiveFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [notes, setNotes] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [backupsRes, filesRes] = await Promise.all([
        backupsApi.list({ type: typeFilter, search }),
        filesApi.list({}),
      ]);
      setBackups(backupsRes.backups || []);
      const filesList = filesRes.files || [];
      setActiveFiles(filesList);
      setSelectedFileId((prev) => prev || filesList[0]?._id || '');
    } catch (err) {
      notify({
        type: 'error',
        title: 'Failed to load backups',
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search, notify]);

  useEffect(() => {
    const timer = setTimeout(loadData, 150);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function handleCreateManualBackup(e) {
    e.preventDefault();
    if (!selectedFileId || creating) return;
    setCreating(true);
    try {
      const data = await backupsApi.createManual(selectedFileId, notes);
      notify({
        type: 'success',
        title: 'Manual backup created',
        message: data.message,
      });
      setNotes('');
      loadData();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Backup failed',
        message: getErrorMessage(err),
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDownloadBackup(backup) {
    setBusyId(backup._id);
    try {
      const blob = await backupsApi.downloadBlob(backup._id);
      triggerBrowserDownload(blob, backup.fileName);
      notify({
        type: 'success',
        title: 'Backup snapshot downloaded',
        message: `Downloaded v${backup.versionNumber} of "${backup.fileName}".`,
      });
    } catch (err) {
      notify({
        type: 'error',
        title: 'Download failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestoreVersion(backup) {
    if (!backup.fileId?._id && !backup.fileId) return;
    const fileId = backup.fileId._id || backup.fileId;
    setBusyId(backup._id);
    try {
      const data = await recoveryApi.restoreVersion(fileId, backup._id);
      notify({
        type: 'success',
        title: 'Version restored',
        message: data.message,
      });
      loadData();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Restore failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeleteBackup() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget._id);
    try {
      const data = await backupsApi.deleteBackup(deleteTarget._id);
      notify({
        type: 'info',
        title: 'Snapshot removed',
        message: data.message,
      });
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Delete failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Create Manual Backup Snapshot
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Duplicate any file from your active vault into an independent versioned copy inside the
              MongoDB Atlas GridFS <code className="font-mono">backups</code> bucket.
            </p>
          </div>
          <HardDrive className="h-5 w-5 shrink-0 text-blue-600" />
        </div>

        <form onSubmit={handleCreateManualBackup} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              disabled={activeFiles.length === 0 || creating}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              {activeFiles.length === 0 ? (
                <option value="">No active files available</option>
              ) : (
                activeFiles.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.originalName} ({formatBytes(f.size)})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="md:col-span-4">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional snapshot note (e.g. Before Q4 edit)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={!selectedFileId || creating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>{creating ? 'Creating…' : 'Create Backup'}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { id: 'all', label: 'All Backups' },
              { id: 'auto', label: 'Automatic' },
              { id: 'manual', label: 'Manual' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by file name…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 rounded bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-800">No backup snapshots found</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload files or create a manual backup snapshot above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">File &amp; Version</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3">SHA-256</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => {
                  const isBusy = busyId === b._id;
                  return (
                    <tr key={b._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 truncate max-w-[230px]">
                          {b.fileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Version {b.versionNumber}
                          {b.notes ? ` · ${b.notes}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 capitalize whitespace-nowrap">
                        {b.backupType}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {formatBytes(b.size)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {shortenHash(b.sha256Hash, 8)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(b.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDownloadBackup(b)}
                            title="Download backup copy"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRestoreVersion(b)}
                            title="Restore this version to active vault"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 disabled:opacity-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(b)}
                            title="Delete snapshot"
                            className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete backup snapshot?"
        message={`Delete Backup v${deleteTarget?.versionNumber} of "${deleteTarget?.fileName}" from GridFS? Your primary file copy will not be affected.`}
        confirmLabel="Delete Snapshot"
        destructive
        loading={busyId === deleteTarget?._id}
        onConfirm={confirmDeleteBackup}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
