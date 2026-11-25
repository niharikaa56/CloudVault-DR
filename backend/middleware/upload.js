import multer from 'multer';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per file

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10,
  },
});

export function uploadMultipleMiddleware(req, res, next) {
  const handler = upload.array('files', 10);
  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Each file must be 50 MB or smaller.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'You can upload up to 10 files at a time.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }
    next();
  });
}
