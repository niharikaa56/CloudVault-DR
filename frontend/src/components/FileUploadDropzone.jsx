import { useRef, useState } from 'react';
import { UploadCloud, FileText, X, ShieldCheck } from 'lucide-react';
import { filesApi, getErrorMessage } from '../services/api';
import { formatBytes } from '../services/formatters';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export default function FileUploadDropzone({ onUploadComplete }) {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const inputRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [autoBackup, setAutoBackup] = useState(user?.autoBackupEnabled ?? true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const unique = incoming.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`)
      );
      return [...prev, ...unique].slice(0, 10);
    });
  }

  function removeFile(index) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || uploading) return;

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('autoBackup', String(autoBackup));

      const data = await filesApi.upload(formData, (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setProgress(pct);
        }
      });

      notify({
        type: 'success',
        title: 'Cloud upload complete',
        message: data.message,
      });

      setSelectedFiles([]);
      setProgress(0);
      if (typeof onUploadComplete === 'function') {
        onUploadComplete(data);
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Upload failed',
        message: getErrorMessage(err, 'Could not upload selected files.'),
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <UploadCloud className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">
          Drag and drop files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Up to 10 files per batch · Max 50 MB each · Stored in MongoDB Atlas GridFS with SHA-256 verification
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="truncate font-medium text-slate-800">{file.name}</span>
                  <span className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => removeFile(idx)}
                  aria-label={`Remove ${file.name}`}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoBackup}
                onChange={(e) => setAutoBackup(e.target.checked)}
                disabled={uploading}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Automatically create independent backup copy in GridFS</span>
            </label>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setSelectedFiles([])}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={handleUpload}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
              >
                {uploading
                  ? `Uploading (${progress}%)…`
                  : `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {uploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-blue-600 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
