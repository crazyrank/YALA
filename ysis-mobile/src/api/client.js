import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config';
import {
  REQUEST_TIMED_OUT,
  NETWORK_UNAVAILABLE,
  REQUEST_FAILED,
  toFriendlyError,
} from '../utils/errorMessages';

const ACCESS_TOKEN_KEY = 'ysis_access_token';
const DEFAULT_TIMEOUT_MS = API_TIMEOUT_MS || 15000;

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
      networkErr.name === 'AbortError' ? REQUEST_TIMED_OUT : NETWORK_UNAVAILABLE
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
    const technicalMessage = body?.error?.message || REQUEST_FAILED;
    const err = new Error(technicalMessage);
    err.code = body?.error?.code || 'UNKNOWN_ERROR';
    err.status = response.status;
    // Attach a friendly version so screens can use it
    err.friendlyMessage = toFriendlyError(err, REQUEST_FAILED);
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
