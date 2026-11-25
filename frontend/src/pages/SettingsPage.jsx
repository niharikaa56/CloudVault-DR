import { useState } from 'react';
import { ShieldCheck, Lock, User, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { authApi, getErrorMessage } from '../services/api';
import { formatBytes } from '../services/formatters';

export default function SettingsPage() {
  const { user, updateSettings, dbStatus } = useAuth();
  const { notify } = useNotifications();

  const [name, setName] = useState(user?.name || '');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(user?.autoBackupEnabled ?? true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateSettings({ name, autoBackupEnabled });
      notify({
        type: 'success',
        title: 'Settings saved',
        message: 'Your profile and automatic backup preferences have been updated.',
      });
    } catch (err) {
      notify({
        type: 'error',
        title: 'Update failed',
        message: getErrorMessage(err),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const data = await authApi.changePassword({ currentPassword, newPassword });
      notify({
        type: 'success',
        title: 'Password updated',
        message: data.message,
      });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      notify({
        type: 'error',
        title: 'Password change failed',
        message: getErrorMessage(err),
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5">
          <User className="h-5 w-5 text-blue-600" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Account &amp; Backup Preferences
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-name" className="block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                id="settings-name"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-900">
                Automatic Disaster Recovery Backup on Upload
              </span>
              <p className="mt-0.5 text-xs text-slate-500">
                When enabled, every uploaded file automatically generates an independent backup copy
                in the MongoDB Atlas GridFS <code className="font-mono">backups</code> bucket.
              </p>
            </div>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingProfile ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-blue-600" />
          <h2 className="font-display text-base font-semibold text-slate-900">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="current-pw" className="block text-sm font-medium text-slate-700">
              Current Password
            </label>
            <input
              id="current-pw"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700">
              New Password
            </label>
            <input
              id="new-pw"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5">
          <Database className="h-5 w-5 text-blue-600" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Vault Storage &amp; GridFS Architecture
          </h2>
        </div>

        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Cloud Storage Quota</dt>
            <dd className="font-mono font-medium text-slate-900 tabular-nums">
              {formatBytes(user?.storageQuotaBytes || 0)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">MongoDB Atlas Status</dt>
            <dd className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              <span>{dbStatus.connected ? 'Connected (uploads & backups buckets active)' : 'Disconnected'}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Integrity Verification</dt>
            <dd className="font-mono text-slate-800">SHA-256</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
