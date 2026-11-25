import { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { filesApi, getErrorMessage } from '../services/api';
import { formatBytes, formatDateTime } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';
import ConfirmModal from '../components/ConfirmModal';

export default function RecycleBinPage() {
  const { notify } = useNotifications();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);

  const loadTrash = useCallback(async () => {
    try {
      setLoading(true);
      const data = await filesApi.listTrash();
      setFiles(data.files || []);
    } catch (err) {
      notify({
        type: 'error',
        title: 'Failed to load Recycle Bin',
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  async function handleRestore(file) {
    setBusyId(file._id);
    try {
      const data = await filesApi.restoreFromTrash(file._id);
      notify({
        type: 'success',
        title: 'File restored',
        message: data.message,
      });
      loadTrash();
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

  async function confirmPermanentDelete() {
    if (!purgeTarget) return;
    setBusyId(purgeTarget._id);
    try {
      const data = await filesApi.permanentDelete(purgeTarget._id);
      notify({
        type: 'info',
        title: 'Permanently purged',
        message: data.message,
      });
      setPurgeTarget(null);
      loadTrash();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Purge failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmEmptyTrash() {
    setBusyId('empty-all');
    try {
      const data = await filesApi.emptyTrash();
      notify({
        type: 'info',
        title: 'Recycle Bin emptied',
        message: data.message,
      });
      setConfirmEmptyAll(false);
      loadTrash();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Empty Recycle Bin failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">Recycle Bin</h2>
            <p className="mt-1 text-xs text-slate-500">
              Soft-deleted files remain safely stored in MongoDB Atlas GridFS along with their
              backup snapshots until you permanently purge them.
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmEmptyAll(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Empty Recycle Bin</span>
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 rounded bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-800">Recycle Bin is empty</p>
            <p className="mt-1 text-xs text-slate-500">
              Files moved to the Recycle Bin from My Files will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">File Name</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3 text-right">Protected Backups</th>
                  <th className="px-4 py-3">Deleted At</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => {
                  const isBusy = busyId === file._id;
                  return (
                    <tr key={file._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-medium text-slate-900 truncate max-w-[240px]">
                        {file.originalName}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {file.backupCount || 0}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(file.deletedAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRestore(file)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPurgeTarget(file)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Purge</span>
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
        open={Boolean(purgeTarget)}
        title="Permanently delete file and all backups?"
        message={`This will permanently remove "${purgeTarget?.originalName}" and all of its backup copies from MongoDB Atlas GridFS. This cannot be undone.`}
        confirmLabel="Permanently Purge"
        destructive
        loading={busyId === purgeTarget?._id}
        onConfirm={confirmPermanentDelete}
        onCancel={() => setPurgeTarget(null)}
      />

      <ConfirmModal
        open={confirmEmptyAll}
        title="Empty Recycle Bin?"
        message={`Permanently purge all ${files.length} files and their GridFS backup copies from MongoDB Atlas? This cannot be undone.`}
        confirmLabel="Empty Recycle Bin"
        destructive
        loading={busyId === 'empty-all'}
        onConfirm={confirmEmptyTrash}
        onCancel={() => setConfirmEmptyAll(false)}
      />
    </div>
  );
}
