import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

const ACCESS_TOKEN_KEY = 'ysis_access_token';
const REFRESH_TOKEN_KEY = 'ysis_refresh_token';
const DEFAULT_TIMEOUT_MS = 25000;

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token) {
  if (token) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token) {
  if (token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

/**
 * Fetch wrapper:
 *  - attaches access token
 *  - on 401, tries ONE silent refresh (body-based for RN reliability)
 *  - on 423, surfaces DEVICE_NOT_TRUSTED / ACCOUNT_LOCKED distinctly
 *  - never throws raw network errors without { code, message }
 */
async function apiFetch(path, options = {}, isRetry = false) {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`\( {API_BASE_URL} \){path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    const err = new Error(
      networkErr.name === 'AbortError' ? 'Request timed out' : 'Network unavailable'
    );
    err.isNetworkError = true;
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 && !isRetry && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(body?.error?.message || 'Request failed');
    err.code = body?.error?.code || 'UNKNOWN_ERROR';
    err.status = response.status;
    throw err;
  }

  return body;
}

async function tryRefresh() {
  try {
    const storedRefresh = await getRefreshToken();
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(storedRefresh ? { refreshToken: storedRefresh } : {}),
    });
    if (!res.ok) {
      await setAccessToken(null);
      await setRefreshToken(null);
      return false;
    }
    const body = await res.json();
    await setAccessToken(body.accessToken);
    if (body.refreshToken) await setRefreshToken(body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: (path) => apiFetch(path, { method: 'GET' }),
  post: (path, data) =>
    apiFetch(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: (path, data) =>
    apiFetch(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};
