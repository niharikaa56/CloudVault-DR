import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { connectDB, getDbStatus } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import recoveryRoutes from './routes/recoveryRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(rootDir, 'frontend');
const frontendDistDir = path.resolve(frontendDir, 'dist');

dotenv.config({ path: path.join(rootDir, '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const allowedOrigins = new Set(
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    process.env.APP_URL,
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith('.run.app') || parsed.hostname === 'localhost') {
          return callback(null, true);
        }
      } catch {
        // Ignore malformed origin header
      }
      return callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: false,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  if (req.query.retry === 'true') {
    await connectDB();
  }
  res.json({
    ok: true,
    service: 'cloud-disaster-recovery-api',
    db: getDbStatus(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/recovery', recoveryRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

async function startServer() {
  await connectDB();

  const isProduction = process.env.NODE_ENV === 'production';
  const apiOnly = process.env.API_ONLY === 'true';

  if (!isProduction && !apiOnly) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        root: frontendDir,
        configFile: path.join(frontendDir, 'vite.config.js'),
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR !== 'true',
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      console.log('[Server] Vite not found in backend scope; running in API-only mode on port', PORT);
    }
  } else if (isProduction && fs.existsSync(frontendDistDir)) {
    app.use(express.static(frontendDistDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDistDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] CloudVault DR running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
