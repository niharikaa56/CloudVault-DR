import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, History } from 'lucide-react';
import { recoveryApi, getErrorMessage } from '../services/api';
import { formatActionLabel, formatDateTime, shortenHash } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';

const ACTION_FILTERS = [
  { id: 'all', label: 'All Events' },
  { id: 'auto_backup', label: 'Auto Backups' },
  { id: 'manual_backup', label: 'Manual Backups' },
  { id: 'recover_from_backup', label: 'Disaster Recoveries' },
  { id: 'restore_version', label: 'Version Restores' },
  { id: 'download_original', label: 'Downloads' },
  { id: 'integrity_check', label: 'Integrity Checks' },
];

export default function RecoveryHistoryPage() {
  const { notify } = useNotifications();
  const [history, setHistory] = useState([]);
  const [actionFilter, setActionFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await recoveryApi.getHistory({ actionType: actionFilter });
      setHistory(data.history || []);
    } catch (err) {
      notify({
        type: 'error',
        title: 'Failed to load recovery history',
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [actionFilter, notify]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-blue-600" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Backup &amp; Recovery Audit Trail
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {history.length} events
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActionFilter(f.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  actionFilter === f.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 rounded bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-800">No events recorded for this filter</p>
            <p className="mt-1 text-xs text-slate-500">
              Every upload, backup, download, restore, and integrity check is logged automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">SHA-256 Status</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-5 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      {formatActionLabel(item.actionType)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-800 truncate max-w-[200px]">
                      {item.fileName}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      v{item.versionRestored || 1}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 text-xs">
                        {item.sha256Verified ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span
                          className={
                            item.sha256Verified
                              ? 'font-medium text-emerald-700'
                              : 'font-medium text-red-700'
                          }
                        >
                          {item.sha256Verified ? 'Verified' : 'Failed'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {shortenHash(item.sha256Hash, 6)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                      {item.details}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTime(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
