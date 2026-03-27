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

/** Allow browser to call API from Vite dev server (localhost and 127.0.0.1 are both common). */
function devCorsOrigins() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return true;
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

app.use(
  cors({
    origin: devCorsOrigins(),
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
  app.listen(port, () => {
    console.log(`INVETO API listening on http://localhost:${port}`);
    console.log(`MongoDB database: "${dbName}" (open this DB in Compass to match the app)`);
  });
} catch (err) {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
}
