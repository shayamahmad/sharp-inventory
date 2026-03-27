# INVETO

Inventory and order management: **React + Vite** (`frontend/`), **Express + MongoDB** (`backend/`), and optional **Docker MongoDB** (`docker-compose.yml`).

## How the three parts connect

```
┌─────────────────┐     proxy /api      ┌─────────────────┐     MONGODB_URI      ┌──────────────────┐
│  Browser        │  ───────────────►   │  Backend API    │  ───────────────►  │  MongoDB         │
│  localhost:8080 │   (Vite → :3001)    │  localhost:3001 │                    │  database inveto │
└─────────────────┘                     └─────────────────┘                    └────────▲─────────┘
                                                                                           │
┌─────────────────┐                                                                        │
│  MongoDB Compass│  ─────────── same URI as MONGODB_URI ──────────────────────────────────┘
│  (GUI)          │      e.g. mongodb://127.0.0.1:27017  → open database **inveto**
└─────────────────┘
```

- **Frontend** loads at **http://localhost:8080** and calls **`/api/...`** (see `frontend/.env`: `VITE_API_URL=` empty).
- **Vite** forwards **`/api`** to **`http://127.0.0.1:3001`** (`frontend/vite.config.ts`).
- **Backend** reads **`MONGODB_URI`** in **`backend/.env`** (default **`mongodb://127.0.0.1:27017/inveto`**) and stores all app data in the **`inveto`** database.
- **MongoDB Compass** must use the **same host/port** as `MONGODB_URI`, then select database **`inveto`** to see the same collections (`customers`, `products`, `orders`, …).

## One-time setup

1. **MongoDB running**  
   - Local install: start MongoDB (service on port **27017**), **or**  
   - Docker: from repo root run `npm run db:up`.

2. **Install dependencies** (repo root):

   ```bash
   npm run install:all
   ```

3. **Backend env**  
   Copy `backend/.env.example` → `backend/.env` and adjust `MONGODB_URI` if your MongoDB is not on `127.0.0.1:27017`.

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

1. Open **http://localhost:8080**
2. Sign in (e.g. **admin@inveto.com** / **admin123** after seed)
3. In **Compass**, connect with **`mongodb://127.0.0.1:27017`**, open **`inveto`** — edits from the site appear there while the API is running.

If you only run `npm run dev`, the UI starts but **the API is not running**; `/api` calls will fail until you run `npm run api` in another terminal or use `dev:full`.

## MongoDB Compass

| Field | Value |
| ----- | ----- |
| Connection | `mongodb://127.0.0.1:27017` (or `localhost`) |
| Database to open | **`inveto`** (must match the path in `MONGODB_URI`) |

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

You can remove a stale nested `sharp-inventory-main/` folder if it is empty; the active app lives in `frontend/` and `backend/` at the repo root.
