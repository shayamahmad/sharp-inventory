# INVETO

Inventory and order management: **React + Vite** (`frontend/`), **Express + MongoDB** (`backend/`), and optional **Docker MongoDB** (`docker-compose.yml`).

## How the three parts connect

```
┌─────────────────┐     proxy /api      ┌─────────────────┐     MONGODB_URI      ┌──────────────────┐
│  Browser        │  ───────────────►   │  Backend API    │  ───────────────►  │  MongoDB         │
│  localhost:8080 │   (Vite → :3001)    │  localhost:3001 │                    │  database inveto │
│  (or :8081…)    │                     │                 │                    │                  │
└─────────────────┘                     └─────────────────┘                    └────────▲─────────┘
                                                                                           │
┌─────────────────┐                                                                        │
│  MongoDB Compass│  ─────────── same URI as MONGODB_URI (Atlas **mongodb+srv://** or local) ─┘
│  (GUI)          │      open database **inveto**
└─────────────────┘
```

- **Frontend** loads at the URL Vite prints (**http://localhost:8080** by default; **8081** if 8080 is in use) and calls **`/api/...`** (see `frontend/.env`: **`VITE_API_URL=`** empty = use proxy).
- **Vite** forwards **`/api`** to **`http://127.0.0.1:3001`** (`frontend/vite.config.ts`).
- **Backend** reads **`MONGODB_URI`** in **`backend/.env`**. Use **[MongoDB Atlas](https://www.mongodb.com/atlas)** (`mongodb+srv://...`) or local **`mongodb://127.0.0.1:27017/inveto`**. Data lives in the database name in that URI (e.g. **`inveto`**).
- **MongoDB Compass** can connect with the **same** `MONGODB_URI` string (Atlas or local) and open **`inveto`**.

## One-time setup

1. **MongoDB** (pick one)  
   - **Atlas (cloud):** Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com), add a database user, **Network Access** → allow your IP (or `0.0.0.0/0` for dev), then **Connect** → copy the SRV string. Put it in **`backend/.env`** as **`MONGODB_URI=...`** (path should end with `/inveto?...`).  
   - **Local:** Start MongoDB (service on **27017**) or `npm run db:up` (Docker). Use **`MONGODB_URI=mongodb://127.0.0.1:27017/inveto`**.

2. **Install dependencies** (repo root):

   ```bash
   npm run install:all
   ```

3. **Backend env**  
   Copy `backend/.env.example` → `backend/.env`. Set **`MONGODB_URI`** to your **Atlas** or **local** URI.

4. **Frontend env**  
   Copy `frontend/.env.example` → `frontend/.env` (keep `VITE_API_URL=` empty for the proxy).

5. **Seed the database** (creates users + sample data in **`inveto`**):

   ```bash
   npm run seed
   ```

## Run everything together (recommended)

From the **repository root**:

```bash
npm run dev:full
```

Same as `npm run stack`. This starts **Vite (8080)** and the **API (3001)** at the same time. Then:

1. Open the **Local** URL from the terminal (e.g. **http://localhost:8080** or **:8081**)
2. Sign in (e.g. **admin@inveto.com** / **admin123** after seed)
3. In **Compass**, use the **same `MONGODB_URI`** as in `backend/.env` (Atlas **`mongodb+srv://...`** or local **`mongodb://127.0.0.1:27017`**) and open database **`inveto`**.

If you only run `npm run dev`, the UI starts but **the API is not running**; `/api` calls will fail until you run `npm run api` in another terminal or use `dev:full`.

### Verify the stack

**Before starting servers** — env files aligned (no secrets printed; Mongo URI is masked):

```bash
npm run setup:check
```

With **`npm run dev:full`** still running, in a **second** terminal:

```bash
npm run check:stack
```

You should see **`"mongo":"connected"`** and **`"dbName":"inveto"`**. If the API is down, start `dev:full` first.

## Troubleshooting

| Symptom | What to check |
| ------- | ------------- |
| Blank / white screen after login | API running? Run **`npm run dev:full`**. Run **`npm run check:stack`**. |
| Network error on login | **`VITE_API_URL=`** empty in `frontend/.env`, and backend on **3001** (see terminal when API starts). |
| API exits: “Failed to connect to MongoDB” | **`MONGODB_URI`** in `backend/.env`, Atlas **Network Access** IP, password URL-encoded in SRV string. |
| Compass empty / no `inveto` | Compass URI must match **`MONGODB_URI`** exactly; run **`npm run seed`**. |
| CORS errors (direct `VITE_API_URL=http://localhost:3001`) | In **development**, localhost on any port is allowed; in production set **`FRONTEND_URL`** to your real site URL. |

## MongoDB Compass

| Field | Value |
| ----- | ----- |
| Connection | Paste **`MONGODB_URI`** from `backend/.env` — **Atlas:** full `mongodb+srv://...` string; **local:** `mongodb://127.0.0.1:27017` |
| Database to open | **`inveto`** (must match the database name in `MONGODB_URI`) |

After `npm run seed`, collections such as `users`, `customers`, `products`, `orders` appear under **`inveto`**.

## Layout

| Folder       | Contents                          |
| ------------ | --------------------------------- |
| `frontend/`  | Vite UI, `src/`, `public/`        |
| `backend/`   | REST API, seed scripts            |

## Scripts (repo root)

| Command               | Action                                      |
| --------------------- | ------------------------------------------- |
| `npm run install:all` | Install frontend + backend dependencies     |
| `npm run dev:full`    | **Frontend + backend** (use for full stack) |
| `npm run stack`       | Same as `dev:full`                          |
| `npm run setup:check` | **Before** dev: confirm `backend/.env` + `frontend/.env` coordinate (proxy + `MONGODB_URI`) |
| `npm run check:stack` | Ping API + Mongo (**run `npm run dev:full` first**, then this in another terminal) |
| `npm run dev`         | Frontend only (port 8080)                   |
| `npm run api`         | Backend only (port 3001)                    |
| `npm run build`       | Production build (frontend)                 |
| `npm run lint`        | ESLint (frontend)                           |
| `npm run seed`        | Seed MongoDB (`inveto`)                     |
| `npm run db:up`       | Start MongoDB via Docker Compose            |
| `npm run db:down`     | Stop Docker MongoDB                         |

## Frontend API URL (optional)

- **Default (recommended):** `VITE_API_URL=` in `frontend/.env` → browser uses **same origin** + Vite **proxy** to port 3001.
- **Direct API:** `VITE_API_URL=http://localhost:3001` → browser calls the API directly; `FRONTEND_URL` in `backend/.env` must match how you open the app (e.g. `http://localhost:8080`).

## Deploying on Vercel

**Short answer:** the **Vite/React frontend** fits Vercel well. The **Express API** does not run as a normal always-on server on Vercel the same way it does on your PC; host the API separately (or refactor to serverless—heavy lift).

### Recommended: frontend on Vercel, API + DB elsewhere

1. **MongoDB:** Use [MongoDB Atlas](https://www.mongodb.com/atlas) (cloud). Set `MONGODB_URI` on your API host to the Atlas connection string (database name e.g. `inveto`).
2. **Backend:** Deploy `backend/` to a Node host such as [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io), or similar. Set `PORT` (often provided by the platform), `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_URL` to your **Vercel site URL** (e.g. `https://your-app.vercel.app`).
3. **Vercel (frontend):** In the project settings, set **Root Directory** to `frontend`, **Framework Preset** to Vite, or use **Build Command** `npm run build` and **Output Directory** `dist`. Add an environment variable **`VITE_API_URL`** = your public API base URL **without** a trailing slash, e.g. `https://your-api.onrender.com` (the app calls paths like `/api/auth/login`).
4. **Seed:** Run `npm run seed` once against Atlas from your machine (with `MONGODB_URI` pointing to Atlas) or from a one-off job on the API host.

Vercel’s dev proxy does **not** apply in production; production **must** use `VITE_API_URL` pointing at the real API.

### “All on Vercel”

Mounting the whole Express app as a single [Vercel serverless function](https://vercel.com/docs/functions) is possible in theory but hits **cold starts**, **execution time limits**, and **wiring effort**. Most teams keep the API on a small Node service and only put the static SPA on Vercel.

You can remove a stale nested `sharp-inventory-main/` folder if it is empty; the active app lives in `frontend/` and `backend/` at the repo root.
