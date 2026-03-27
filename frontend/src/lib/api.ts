const TOKEN_KEY = 'inveto_token';
export const USER_STORAGE_KEY = 'inveto_user';

/** True when `.env` defines `VITE_API_URL` (even empty = same-origin + Vite proxy). */
export function isApiConfigured(): boolean {
  return typeof import.meta.env.VITE_API_URL === 'string';
}

/** Base URL without trailing slash, or `''` for relative `/api/*` (use with Vite proxy). */
export function getApiBase(): string | undefined {
  const v = import.meta.env.VITE_API_URL;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (s === '' || s === '/') return '';
  return s.replace(/\/$/, '');
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!isApiConfigured()) throw new ApiError('VITE_API_URL is not set in .env', 0);
  const base = getApiBase() ?? '';

  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('inveto:session-expired'));
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok) {
        throw new ApiError(
          'Server returned non-JSON (check VITE_API_URL points to the API, e.g. http://localhost:3001, not the Vite port)',
          res.status
        );
      }
      data = null;
    }
  }

  if (!res.ok) {
    const errBody = data && typeof data === 'object' && data !== null && 'error' in data;
    const msg = errBody && typeof (data as { error?: string }).error === 'string'
      ? (data as { error: string }).error
      : res.statusText;
    throw new ApiError(msg, res.status);
  }

  return data as T;
}

/** Strip Mongo / API metadata before compare or PATCH body */
export function stripEntityMeta<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const { createdAt, updatedAt, _id, __v, ...rest } = row;
  return rest;
}

export async function syncIdList<T extends { id: string }>(
  apiPath: string,
  prev: T[],
  next: T[],
  sanitize: (x: T) => Record<string, unknown>
): Promise<void> {
  const prevM = new Map(prev.map((x) => [x.id, x]));
  const nextM = new Map(next.map((x) => [x.id, x]));

  for (const [id, item] of nextM) {
    if (!prevM.has(id)) {
      await apiJson('POST', apiPath, sanitize(item));
    } else {
      const a = JSON.stringify(sanitize(prevM.get(id)!));
      const b = JSON.stringify(sanitize(item));
      if (a !== b) {
        await apiJson('PATCH', `${apiPath}/${encodeURIComponent(id)}`, sanitize(item));
      }
    }
  }

  for (const id of prevM.keys()) {
    if (!nextM.has(id)) {
      await apiJson('DELETE', `${apiPath}/${encodeURIComponent(id)}`);
    }
  }
}
