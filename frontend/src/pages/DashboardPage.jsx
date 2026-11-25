import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Files,
  HardDrive,
  Database,
  ShieldCheck,
  Download,
  Eye,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { recoveryApi, filesApi, getErrorMessage, triggerBrowserDownload } from '../services/api';
import { formatActionLabel, formatBytes, formatDateTime, shortenHash } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';
import FileUploadDropzone from '../components/FileUploadDropzone';
import FilePreviewModal from '../components/FilePreviewModal';

export default function DashboardPage() {
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [recentRecoveries, setRecentRecoveries] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await recoveryApi.getDashboard();
      setStats(data.stats);
      setRecentFiles(data.recentFiles || []);
      setRecentRecoveries(data.recentRecoveries || []);
    } catch (err) {
      notify({
        type: 'error',
        title: 'Failed to load dashboard',
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleDownload(file) {
    try {
      const blob = await filesApi.downloadBlob(file._id);
      triggerBrowserDownload(blob, file.originalName);
      notify({
        type: 'success',
        title: 'Download complete',
        message: `"${file.originalName}" downloaded from MongoDB Atlas GridFS.`,
      });
      loadDashboard();
    } catch (err) {
      notify({
        type: 'error',
        title: 'Download failed',
        message: getErrorMessage(err),
      });
    }
  }

  const usedPct =
    stats && stats.storageQuotaBytes > 0
      ? Math.min(100, Math.round((stats.totalStorageBytes / stats.storageQuotaBytes) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Cloud Files</span>
            <Files className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : stats?.totalFiles ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {stats?.trashedFiles || 0} in Recycle Bin
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Backup Copies</span>
            <HardDrive className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : stats?.totalBackups ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Stored in GridFS backup bucket</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Cloud Storage Usage</span>
            <Database className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : formatBytes(stats?.totalStorageBytes || 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {usedPct}% of {formatBytes(stats?.storageQuotaBytes || 0)} quota
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Backup Protection</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '—' : `${stats?.protectionRate ?? 100}%`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Auto-backup {stats?.autoBackupEnabled ? 'enabled' : 'disabled'}
          </p>
        </div>
      </div>

      {/* Storage Usage Breakdown */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              MongoDB Atlas GridFS Storage Allocation
            </h2>
            <p className="text-xs text-slate-500">
              Primary files and independent backup copies are isolated in separate GridFS buckets.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-700 tabular-nums">
            {formatBytes(stats?.totalStorageBytes || 0)} / {formatBytes(stats?.storageQuotaBytes || 0)}
          </div>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 flex">
          <div
            className="bg-blue-600 transition-all duration-200"
            style={{
              width: `${
                stats && stats.storageQuotaBytes > 0
                  ? Math.min(100, (stats.primaryBytes / stats.storageQuotaBytes) * 100)
                  : 0
              }%`,
            }}
            title="Primary Files"
          />
          <div
            className="bg-sky-400 transition-all duration-200"
            style={{
              width: `${
                stats && stats.storageQuotaBytes > 0
                  ? Math.min(100, (stats.backupBytes / stats.storageQuotaBytes) * 100)
                  : 0
              }%`,
            }}
            title="Backup Snapshots"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-6 text-xs text-slate-600 tabular-nums">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" aria-hidden="true" />
            Primary Vault: <strong className="font-mono text-slate-900">{formatBytes(stats?.primaryBytes || 0)}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" aria-hidden="true" />
            Backup Copies: <strong className="font-mono text-slate-900">{formatBytes(stats?.backupBytes || 0)}</strong>
          </span>
        </div>
      </section>

      {/* Quick Upload */}
      <FileUploadDropzone onUploadComplete={loadDashboard} />

      {/* Recent Uploads & Recent Recovery Activities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">Recent Uploads</h2>
            <Link
              to="/files"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : recentFiles.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No files uploaded yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Drop a file above to store it in MongoDB Atlas GridFS with an automatic backup.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">File Name</th>
                    <th className="px-4 py-3 text-right">Size</th>
                    <th className="px-4 py-3 text-right">Backups</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentFiles.map((file) => (
                    <tr key={file._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[220px]">
                          {file.originalName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono tabular-nums">
                          {shortenHash(file.sha256Hash, 6)} · {formatDateTime(file.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {file.backupCount || 0}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            title="View file"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            title="Download from cloud"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Backup &amp; Recovery Activity
            </h2>
            <Link
              to="/history"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              <span>Full log</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : recentRecoveries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No recovery events yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Uploads, automatic backups, downloads, and restores appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentRecoveries.map((event) => (
                <div key={event._id} className="flex items-start gap-3 px-5 py-3.5 text-xs">
                  {event.status === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">
                      {formatActionLabel(event.actionType)} · {event.fileName}
                    </p>
                    <p className="mt-0.5 text-slate-500 line-clamp-1">{event.details}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400 tabular-nums">
                      v{event.versionRestored} · {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onRefresh={loadDashboard}
      />
    </div>
  );
}
