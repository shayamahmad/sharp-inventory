import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { authenticate } from './middleware/auth.js';
import {
  registerPublicRoutes,
  registerAuthRoutes,
  registerProtectedRoutes,
} from './routes/registerRoutes.js';

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-insecure-jwt-secret-change-in-production';
  console.warn('JWT_SECRET not set; using a development default.');
}

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

/** Extra origins from FRONTEND_URL (comma-separated). Adds localhost ↔ 127.0.0.1 variants. */
function explicitCorsOrigins() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return [];
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const out = new Set(parts);
  for (const p of parts) {
    try {
      const u = new URL(p);
      if (u.hostname === 'localhost') {
        out.add(p.replace('://localhost', '://127.0.0.1'));
      }
      if (u.hostname === '127.0.0.1') {
        out.add(p.replace('://127.0.0.1', '://localhost'));
      }
    } catch {
      /* ignore invalid URL */
    }
  }
  return [...out];
}

/**
 * Dev: any http(s)://localhost:* or 127.0.0.1:* (so Vite can use 8081 if 8080 is busy).
 * Prod: only FRONTEND_URL list; if empty, allow all (same as before — set FRONTEND_URL in prod).
 */
function corsOriginHandler() {
  return (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (!isProduction) {
      try {
        const u = new URL(origin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch {
        /* fall through */
      }
    }
    const list = explicitCorsOrigins();
    if (list.length === 0) {
      return callback(null, true);
    }
    if (list.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  };
}

app.use(
  cors({
    origin: corsOriginHandler(),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

registerPublicRoutes(app);
registerAuthRoutes(app);

const protectedRouter = express.Router();
protectedRouter.use(authenticate);
registerProtectedRoutes(protectedRouter);
app.use('/api', protectedRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3001);
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/inveto';

try {
  await connectDb(uri);
  const dbName = mongoose.connection?.name || '(unknown)';
  app.listen(port, '0.0.0.0', () => {
    console.log('');
    console.log('INVERON API  →  http://127.0.0.1:' + port + '  (Vite proxies /api here when VITE_API_URL is empty)');
    console.log('MongoDB     →  database "' + dbName + '"');
    console.log('Compass     →  paste MONGODB_URI from backend/.env (same string as this API uses)');
    console.log('');
  });
} catch (err) {
  console.error('');
  console.error('Failed to connect to MongoDB:', err.message);
  console.error('');
  if (String(uri).includes('mongodb+srv://')) {
    console.error('Atlas checklist:');
    console.error('  • Network Access → allow your IP or 0.0.0.0/0 (dev only)');
    console.error('  • Database Access → user/password correct; URL-encode password (@ → %40, # → %23, etc.)');
    console.error('  • URI must include database name, e.g. ...mongodb.net/inveto?retryWrites=true&w=majority');
    console.error('  • Compass: paste the SAME MONGODB_URI as backend/.env');
  } else {
    console.error('Local MongoDB checklist:');
    console.error('  • Start mongod on port 27017, or from repo root: npm run db:up (Docker)');
    console.error('  • URI example: mongodb://127.0.0.1:27017/inveto');
  }
  console.error('');
  process.exit(1);
}
