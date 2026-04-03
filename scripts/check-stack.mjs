/**
 * Verifies the backend is up (same one the frontend proxies to in dev).
 *
 * This only succeeds AFTER the API is running. In a first terminal run:
 *   npm run dev:full
 * Then (same machine, second terminal) run:
 *   npm run check:stack
 */
import http from 'http';

const port = Number(process.env.PORT || 3001);
const timeoutMs = 4000;

const bases = [
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
];

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${url}/api/health`, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body || '{}'));
          } catch {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('connection timed out'));
    });
  });
}

async function main() {
  let lastErr = null;
  let workedAt = null;
  let data = null;

  for (const base of bases) {
    try {
      data = await getJson(base);
      workedAt = base;
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!workedAt) {
    const code = lastErr?.code || '';
    const isRefused = code === 'ECONNREFUSED' || String(lastErr?.message || '').includes('fetch failed');
    console.error('FAIL  Backend is not reachable on port', port);
    if (isRefused) {
      console.error('      Nothing is listening yet (ECONNREFUSED).');
    } else {
      console.error('      ', lastErr?.message || lastErr);
    }
    console.error('');
    console.error('  Do this first (leave it running):');
    console.error('    npm run dev:full');
    console.error('  or start only the API:');
    console.error('    npm run api');
    console.error('');
    console.error('  Then run check:stack again in another terminal.');
    process.exit(1);
  }

  console.log('OK   Backend at', workedAt, '→', JSON.stringify(data));
  console.log('');
  if (data && data.mongo !== 'connected') {
    console.warn('WARN MongoDB state is not "connected" — check MONGODB_URI in backend/.env and Atlas IP allowlist.');
    console.log('');
  }
  console.log('MongoDB Compass — paste the SAME string as MONGODB_URI in backend/.env');
  console.log('  Then open database:', data?.dbName || 'inveto');
  console.log('Frontend — open the URL Vite prints (often :8080; if busy, :8081). Keep VITE_API_URL empty for proxy.');
}

main();
