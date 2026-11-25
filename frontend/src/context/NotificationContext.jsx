import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    ({ type = 'info', title, message, duration = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setNotifications((prev) => [...prev.slice(-3), { id, type, title, message }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 pointer-events-none"
      >
        {notifications.map((item) => {
          const isSuccess = item.type === 'success';
          const isError = item.type === 'error';
          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-lg transition-all duration-150"
            >
              {isSuccess ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : isError ? (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              ) : (
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              )}
              <div className="min-w-0 flex-1">
                {item.title && (
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                )}
                {item.message && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
