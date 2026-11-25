import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Database, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getErrorMessage } from '../services/api';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retryingDb, setRetryingDb] = useState(false);

  const { login, register, dbStatus, checkHealth } = useAuth();
  const { notify } = useNotifications();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        notify({
          type: 'success',
          title: 'Signed in',
          message: 'Welcome back to your CloudVault DR workspace.',
        });
      } else {
        await register(name, email, password);
        notify({
          type: 'success',
          title: 'Account created',
          message: 'Your private GridFS vault and backup bucket are ready.',
        });
      }
      navigate('/', { replace: true });
    } catch (err) {
      notify({
        type: 'error',
        title: mode === 'login' ? 'Sign in failed' : 'Registration failed',
        message: getErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetryDb() {
    setRetryingDb(true);
    const status = await checkHealth(true);
    setRetryingDb(false);
    if (status?.connected) {
      notify({
        type: 'success',
        title: 'MongoDB Atlas connected',
        message: 'GridFS storage buckets (uploads & backups) are active.',
      });
    } else if (status?.error) {
      notify({
        type: 'error',
        title: 'Still unable to reach Atlas',
        message: status.error,
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <div className="flex flex-1 flex-col justify-between bg-slate-900 px-8 py-10 text-white lg:max-w-lg lg:px-12 lg:py-14">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">CloudVault DR</span>
        </div>

        <div className="my-12 space-y-6">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
            Cloud-Based Disaster Recovery for Critical Files
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Upload files directly into MongoDB Atlas GridFS with automatic, independent backup
            copies and SHA-256 integrity signatures. Even if your local computer fails or files are
            permanently deleted, your cloud copies remain safe and recoverable.
          </p>

          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4.5 w-4.5 shrink-0 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-white">Dual-Bucket GridFS Storage</p>
                <p className="text-xs text-slate-400">
                  Primary files and versioned backup snapshots are stored separately in MongoDB Atlas.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-white">SHA-256 Checksum Verification</p>
                <p className="text-xs text-slate-400">
                  Every upload, backup, and recovery stream is cryptographically verified.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          MERN Stack · MongoDB Atlas GridFS · JWT &amp; bcrypt
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          {dbStatus.checked && !dbStatus.connected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1 space-y-1.5">
                  <p className="font-semibold">
                    {dbStatus.configured
                      ? 'MongoDB Atlas connection blocked or unreachable'
                      : 'MongoDB Atlas connection required'}
                  </p>
                  <p className="leading-relaxed text-amber-800">
                    {dbStatus.configured ? (
                      <>
                        Check your MongoDB Atlas <strong>Database Access</strong> username/password
                        in <code className="font-mono font-semibold">MONGODB_URI</code> (without{' '}
                        <code className="font-mono">&lt; &gt;</code> brackets) and confirm{' '}
                        <code className="font-mono font-semibold">0.0.0.0/0</code> is enabled under{' '}
                        <strong>Network Access</strong>, then retry below.
                      </>
                    ) : (
                      <>
                        Set <code className="font-mono font-semibold">MONGODB_URI</code> in your
                        environment variables (Secrets panel or{' '}
                        <code className="font-mono">.env</code>) and allow{' '}
                        <code className="font-mono font-semibold">0.0.0.0/0</code> in Atlas Network
                        Access.
                      </>
                    )}
                  </p>
                  {dbStatus.error && (
                    <p className="font-mono text-[11px] text-amber-800 break-words">{dbStatus.error}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleRetryDb}
                    disabled={retryingDb}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${retryingDb ? 'animate-spin' : ''}`} />
                    <span>{retryingDb ? 'Reconnecting…' : 'Retry Atlas Connection'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-7 sm:p-8">
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="mt-6">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {mode === 'login' ? 'Sign in to your vault' : 'Create your recovery vault'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {mode === 'login'
                  ? 'Access your encrypted cloud files and backup snapshots.'
                  : 'Register to back up and recover files from MongoDB Atlas.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting
                  ? mode === 'login'
                    ? 'Signing in…'
                    : 'Creating account…'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
