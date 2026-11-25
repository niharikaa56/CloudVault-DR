import { useEffect, useState } from 'react';
import { X, Download, ShieldCheck, HardDrive, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { filesApi, backupsApi, getErrorMessage, triggerBrowserDownload } from '../services/api';
import { formatBytes, formatDateTime, shortenHash } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';

export default function FilePreviewModal({ file, onClose, onRefresh }) {
  const { notify } = useNotifications();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [backups, setBackups] = useState([]);
  const [busyAction, setBusyAction] = useState('');

  useEffect(() => {
    if (!file) return undefined;

    let active = true;
    let createdObjectUrl = null;

    async function loadDetailsAndPreview() {
      setLoadingPreview(true);
      setPreviewUrl(null);
      setTextContent(null);

      try {
        const details = await filesApi.getById(file._id);
        if (active) {
          setBackups(details.backups || []);
        }

        const mime = file.mimeType || '';
        const isImage = mime.startsWith('image/');
        const isPdf = mime === 'application/pdf';
        const isText =
          mime.startsWith('text/') ||
          mime === 'application/json' ||
          mime === 'application/xml' ||
          mime === 'application/javascript';

        if (isImage || isPdf || isText) {
          const blob = await filesApi.downloadBlob(file._id, true);
          if (!active) return;

          if (isText) {
            const text = await blob.text();
            if (active) setTextContent(text.slice(0, 12000));
          } else {
            createdObjectUrl = URL.createObjectURL(blob);
            setPreviewUrl(createdObjectUrl);
          }
        }
      } catch (err) {
        if (active) {
          notify({
            type: 'error',
            title: 'Preview unavailable',
            message: getErrorMessage(err, 'Could not stream file from GridFS.'),
          });
        }
      } finally {
        if (active) setLoadingPreview(false);
      }
    }

    loadDetailsAndPreview();

    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [file, notify]);

  if (!file) return null;

  async function handleDownloadOriginal() {
    setBusyAction('download');
    try {
      const blob = await filesApi.downloadBlob(file._id);
      triggerBrowserDownload(blob, file.originalName);
      notify({
        type: 'success',
        title: 'File downloaded',
        message: `"${file.originalName}" restored from MongoDB Atlas GridFS.`,
      });
    } catch (err) {
      notify({
        type: 'error',
        title: 'Download failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyAction('');
    }
  }

  async function handleManualBackup() {
    setBusyAction('backup');
    try {
      const data = await backupsApi.createManual(file._id);
      notify({
        type: 'success',
        title: 'Manual backup created',
        message: data.message,
      });
      const refreshed = await filesApi.getById(file._id);
      setBackups(refreshed.backups || []);
      if (onRefresh) onRefresh();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Backup failed',
        message: getErrorMessage(err),
      });
    } finally {
      setBusyAction('');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h3 id="file-preview-title" className="truncate font-display text-base font-semibold text-slate-900">
              {file.originalName}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              {formatBytes(file.size)} · {file.mimeType} · v{file.currentVersion}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close file viewer"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 text-xs">
            <div>
              <span className="text-slate-500">SHA-256 Signature</span>
              <p className="mt-1 font-mono text-slate-900 break-all">{file.sha256Hash}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Integrity Status</span>
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    file.integrityStatus === 'verified' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {file.integrityStatus === 'verified' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  {file.integrityStatus === 'verified' ? 'Verified' : 'Mismatch'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Uploaded</span>
                <span className="font-mono text-slate-800 tabular-nums">{formatDateTime(file.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Backup Snapshots</span>
                <span className="font-mono text-slate-800 tabular-nums">{backups.length}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            {loadingPreview ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                Streaming cloud preview from MongoDB Atlas GridFS…
              </div>
            ) : previewUrl && file.mimeType?.startsWith('image/') ? (
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt={file.originalName}
                  className="max-h-80 rounded object-contain"
                />
              </div>
            ) : previewUrl && file.mimeType === 'application/pdf' ? (
              <iframe
                src={previewUrl}
                title={file.originalName}
                className="h-80 w-full rounded border border-slate-200 bg-white"
              />
            ) : textContent !== null ? (
              <pre className="max-h-72 overflow-auto rounded bg-white p-3.5 font-mono text-xs leading-relaxed text-slate-800 border border-slate-200 whitespace-pre-wrap">
                {textContent}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileText className="h-9 w-9 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700">
                  Cloud binary stored safely in GridFS
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Inline preview is shown for images, PDFs, and text files. Download to open locally.
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cloud Backup Versions ({backups.length})
            </h4>
            {backups.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No backup versions yet. Click Create Backup Snapshot below to protect this file.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {backups.map((b) => (
                  <div key={b._id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <HardDrive className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="font-semibold text-slate-800">v{b.versionNumber}</span>
                      <span className="text-slate-500 capitalize">{b.backupType}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-mono text-slate-600 tabular-nums">{shortenHash(b.sha256Hash, 8)}</span>
                    </div>
                    <span className="font-mono text-slate-500 tabular-nums shrink-0">
                      {formatDateTime(b.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={handleManualBackup}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>{busyAction === 'backup' ? 'Backing up…' : 'Create Backup Snapshot'}</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={handleDownloadOriginal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{busyAction === 'download' ? 'Downloading…' : 'Download Original'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
