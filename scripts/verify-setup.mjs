/**
 * Confirms frontend + backend env files line up for: Browser → Vite → API → MongoDB (same URI as Compass).
 * Run from repo root: npm run setup:check
 * Does not start servers. For API+Mongo health: npm run dev:full then npm run check:stack
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readFile(rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
}

function lineValue(text, key) {
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const m = text.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function maskMongoUri(uri) {
  if (!uri) return '(missing)';
  const at = uri.indexOf('@');
  if (at > 0) {
    const schemeEnd = uri.indexOf('://');
    const scheme = schemeEnd > 0 ? uri.slice(0, schemeEnd) : 'mongodb';
    const afterAt = uri.slice(at + 1);
    const slash = afterAt.indexOf('/');
    const host = slash >= 0 ? afterAt.slice(0, slash) : afterAt;
    const path = slash >= 0 ? afterAt.slice(slash) : '';
    const db = path.replace(/^\//, '').split('?')[0] || 'inveto';
    return `${scheme}://***@${host}/${db}`;
  }
  return uri.length > 50 ? uri.slice(0, 47) + '…' : uri;
}

let exit = 0;

console.log('');
console.log('Inveron — stack coordination check (frontend ↔ backend ↔ MongoDB / Compass)');
console.log('─'.repeat(72));

const be = readFile('backend/.env');
const fe = readFile('frontend/.env');

if (!be) {
  console.error('FAIL  Missing backend/.env — copy backend/.env.example → backend/.env');
  exit = 1;
} else {
  const mongo = lineValue(be, 'MONGODB_URI');
  if (!mongo || mongo.startsWith('#')) {
    console.error('FAIL  backend/.env: set MONGODB_URI= (uncomment one line; not commented out)');
    exit = 1;
  } else {
    console.log('OK    backend/.env  MONGODB_URI →', maskMongoUri(mongo));
  }
  const port = lineValue(be, 'PORT') || '3001';
  console.log('OK    backend/.env  PORT →', port, '(Vite proxy must target this — see frontend/vite.config.ts)');
}

if (!fe) {
  console.error('FAIL  Missing frontend/.env — copy frontend/.env.example → frontend/.env');
  exit = 1;
} else {
  const viteApi = lineValue(fe, 'VITE_API_URL');
  if (viteApi === undefined) {
    console.error('FAIL  frontend/.env: add VITE_API_URL= (empty value = use Vite proxy to backend)');
    exit = 1;
  } else if (viteApi === '') {
    console.log('OK    frontend/.env  VITE_API_URL empty → browser /api → Vite → http://127.0.0.1:3001');
  } else {
    console.log('OK    frontend/.env  VITE_API_URL →', viteApi, '(direct API; CORS must allow your Vite origin)');
  }
}

console.log('─'.repeat(72));
console.log('MongoDB Compass');
console.log('  • Use the SAME string as MONGODB_URI in backend/.env (copy the whole line value).');
console.log('  • After connecting, open database: inveto');
console.log('  • Seed once: npm run seed');
console.log('');
console.log('Run everything');
console.log('  npm run dev:full     ← frontend + API together');
console.log('  npm run check:stack  ← after dev:full, confirms API + Mongo (second terminal)');
console.log('');

process.exit(exit);
