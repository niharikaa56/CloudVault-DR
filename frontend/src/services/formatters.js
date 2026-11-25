export function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortenHash(hash = '', visible = 10) {
  if (!hash) return '—';
  if (hash.length <= visible * 2) return hash;
  return `${hash.slice(0, visible)}…${hash.slice(-6)}`;
}

export function formatActionLabel(actionType) {
  const labels = {
    auto_backup: 'Automatic Backup',
    manual_backup: 'Manual Backup',
    download_original: 'File Download',
    download_backup: 'Backup Download',
    recover_from_backup: 'Disaster Recovery Download',
    restore_version: 'Version Restored to Vault',
    restore_from_bin: 'Restored from Recycle Bin',
    integrity_check: 'SHA-256 Integrity Check',
  };
  return labels[actionType] || actionType;
}
