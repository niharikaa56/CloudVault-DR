import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Eye,
  Download,
  HardDrive,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { filesApi, backupsApi, getErrorMessage, triggerBrowserDownload } from '../services/api';
import { formatBytes, formatDateTime, shortenHash } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';
import FileUploadDropzone from '../components/FileUploadDropzone';
import FilePreviewModal from '../components/FilePreviewModal';
import ConfirmModal from '../components/ConfirmModal';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'images', label: 'Images' },
  { id: 'archives', label: 'Archives' },
  { id: 'media', label: 'Media' },
];

export default function MyFilesPage() {
  const { notify } = useNotifications();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [previewFile, setPreviewFile] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await filesApi.list({ search, category, sort });
      setFiles(data.files || []);
    } catch (err) {
      notify({
        type: 'error',
        title: 'Could not load files',
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [search, category, sort, notify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadFiles]);

  async function handleDownload(file) {
    setBusyId(file._id);
    try {
      const blob = await filesApi.downloadBlob(file._id);
      triggerBrowserDownload(blob, file.originalName);
      notify({
        type: 'success',
        title: 'File restored to computer',
        message: `"${file.originalName}" downloaded directly from MongoDB Atlas GridFS.`,
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

  async function handleManualBackup(file) {
    setBusyId(file._id);
    try {
      const data = await backupsApi.createManual(file._id);
      notify({
        type: 'success',
        title: 'Backup snapshot saved',
        message: data.message,
      });
      loadFiles();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Backup failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleVerifyIntegrity(file) {
    setBusyId(file._id);
    try {
      const result = await filesApi.verifyIntegrity(file._id);
      notify({
        type: result.verified ? 'success' : 'error',
        title: result.verified ? 'SHA-256 verified' : 'Checksum mismatch',
        message: result.message,
      });
      loadFiles();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Verification failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmSoftDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget._id);
    try {
      const data = await filesApi.softDelete(deleteTarget._id);
      notify({
        type: 'info',
        title: 'Moved to Recycle Bin',
        message: data.message,
      });
      setDeleteTarget(null);
      loadFiles();
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
      <FileUploadDropzone onUploadComplete={loadFiles} />

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  category === cat.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cloud files…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:w-64"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort files"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="largest">Largest First</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 rounded bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-800">No files match your view</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload files above or adjust your search and category filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">File Name</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3">SHA-256 Integrity</th>
                  <th className="px-4 py-3 text-right">Backups</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => {
                  const isBusy = busyId === file._id;
                  return (
                    <tr key={file._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 truncate max-w-[240px]">
                          {file.originalName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {file.mimeType} · v{file.currentVersion}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          {file.integrityStatus === 'verified' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                          )}
                          <span
                            className={
                              file.integrityStatus === 'verified'
                                ? 'font-medium text-emerald-700'
                                : 'font-medium text-red-700'
                            }
                          >
                            {file.integrityStatus === 'verified' ? 'Verified' : 'Mismatch'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-slate-500 tabular-nums">
                            {shortenHash(file.sha256Hash, 6)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {file.backupCount || 0}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(file.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPreviewFile(file)}
                            title="View file & versions"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDownload(file)}
                            title="Download original file"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleManualBackup(file)}
                            title="Create manual backup snapshot"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                          >
                            <HardDrive className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleVerifyIntegrity(file)}
                            title="Verify SHA-256 checksum"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 disabled:opacity-50"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(file)}
                            title="Move to Recycle Bin"
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

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onRefresh={loadFiles}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Move file to Recycle Bin?"
        message={`"${deleteTarget?.originalName}" will be moved to the Recycle Bin. Its MongoDB GridFS backup copies remain intact so you can still restore or recover it anytime.`}
        confirmLabel="Move to Recycle Bin"
        destructive
        loading={busyId === deleteTarget?._id}
        onConfirm={confirmSoftDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
