// Remembers when a student last reached the quiz page.
// No password, registration number or token is stored here.
// The login itself is kept by the WebView's cookies.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'student_session_v1';
// Match the 7-day refresh cookie on YalaPrep
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function saveStudentLogin() {
  await AsyncStorage.setItem(KEY, JSON.stringify({ lastLoginAt: Date.now() }));
}

export async function getStudentSession() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isSessionFresh(session) {
  return !!session && Date.now() - session.lastLoginAt < MAX_AGE_MS;
}

export async function clearStudentSession() {
  await AsyncStorage.removeItem(KEY);
}
