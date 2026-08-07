import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

const ACCESS_TOKEN_KEY = 'ysis_access_token';

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

/**
 * Fetch wrapper that:
 *  - attaches the access token
 *  - on a 401, tries ONE silent refresh via the httpOnly cookie, then retries once
 *  - on a 423 (device not trusted), surfaces that distinctly so the UI can
 *    prompt "this device needs to be re-verified" rather than "sign in again"
 *  - never throws raw network errors up to the UI without an { code, message } shape
 */
async function apiFetch(path, options = {}, isRetry = false) {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include', // sends the httpOnly refresh cookie
    });
  } catch (networkErr) {
    // Genuine offline/network failure — the caller (usually the sync
    // engine or a screen with local-first data) should treat this as
    // "queue it, try again later", not a hard error to show the user.
    const err = new Error('Network unavailable');
    err.isNetworkError = true;
    throw err;
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
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const body = await res.json();
    await setAccessToken(body.accessToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: (path) => apiFetch(path, { method: 'GET' }),
  post: (path, data) => apiFetch(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};
