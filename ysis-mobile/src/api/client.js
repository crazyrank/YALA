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
    response = await fetch(`${API_BASE_URL}${path}`, {
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
  }

  clearTimeout(timeoutId);

  let body = null;
  try {
    body = await response.json();
  } catch {
    // no body / not JSON
  }

  if (response.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(path, options, true);
  }

  if (!response.ok) {
    const technicalMessage = body?.error?.message || REQUEST_FAILED;
    const err = new Error(technicalMessage);
    err.status = response.status;
    err.code = body?.error?.code;
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
    const data = await res.json();
    if (data?.accessToken) {
      await setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const api = {
  get: (path) => apiFetch(path, { method: 'GET' }),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  patch2: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
