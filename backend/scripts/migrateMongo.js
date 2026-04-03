/**
 * One-time copy: local (or any source) MongoDB → target (Atlas).
 *
 * Usage:
 *   1) Put your Atlas URI in backend/.env as MONGODB_URI (database name must be /inveto).
 *   2) From backend folder:
 *        npm run migrate:mongo
 *
 *   Source defaults to local inveto. Override:
 *        MONGODB_URI_SOURCE=mongodb://127.0.0.1:27017/inveto npm run migrate:mongo
 *
 *   If your data is only on another host, set both:
 *        MONGODB_URI_SOURCE=... MONGODB_URI=... npm run migrate:mongo
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const DEFAULT_SOURCE = 'mongodb://127.0.0.1:27017/inveto';

const sourceUri = (process.env.MONGODB_URI_SOURCE || DEFAULT_SOURCE).trim();
const destUri = (process.env.MONGODB_URI || '').trim();

if (!destUri) {
  console.error('Set MONGODB_URI in backend/.env to your Atlas URI (with /inveto in the path).');
  process.exit(1);
}

if (sourceUri === destUri) {
  console.error('Source and destination URIs are the same. Set MONGODB_URI_SOURCE for the old database.');
  process.exit(1);
}

const base = { serverSelectionTimeoutMS: 30_000, maxPoolSize: 5 };
const sourceOpts = { ...base };
if (sourceUri.startsWith('mongodb+srv://')) sourceOpts.family = 4;
const destOpts = { ...base };
if (destUri.startsWith('mongodb+srv://')) destOpts.family = 4;

async function main() {
  console.log('Source:', sourceUri.replace(/:[^:@]+@/, ':****@'));
  console.log('Target:', destUri.replace(/:[^:@]+@/, ':****@'));

  const sourceConn = mongoose.createConnection(sourceUri, sourceOpts);
  const destConn = mongoose.createConnection(destUri, destOpts);

  await sourceConn.asPromise();
  await destConn.asPromise();

  const srcDb = sourceConn.db;
  const dstDb = destConn.db;

  const all = await srcDb.listCollections().toArray();
  const names = all.map((c) => c.name).filter((n) => !n.startsWith('system.'));

  if (names.length === 0) {
    console.log('No collections on source. Nothing to copy.');
    await sourceConn.close();
    await destConn.close();
    return;
  }

  for (const name of names.sort()) {
    const col = srcDb.collection(name);
    const docs = await col.find({}).toArray();
    await dstDb.collection(name).deleteMany({});
    if (docs.length > 0) {
      await dstDb.collection(name).insertMany(docs, { ordered: false });
    }
    console.log(`  ${name}: ${docs.length} document(s)`);
  }

  await sourceConn.close();
  await destConn.close();
  console.log('Done. Restart the API and use Compass with the same MONGODB_URI.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
