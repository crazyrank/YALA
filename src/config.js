// Point this at your deployed backend. During local development with an
// Expo Go device on the same network, use your machine's LAN IP, not
// localhost (the phone can't reach your laptop's localhost).
//
// Example local: 'http://192.168.1.42:4000'
// Example production (Render): 'https://ysis-backend.onrender.com'
export const API_BASE_URL = 'http://10.212.240.32';
export const API_BASE_URL = "http://10.212.240.32:4000";

// Passport photo capture settings (Build Spec Section 7 — locked decision)
export const PHOTO_TARGET_WIDTH = 400;
export const PHOTO_TARGET_HEIGHT = 400;
export const PHOTO_JPEG_QUALITY = 0.6; // targets roughly 30-60KB per photo

// Sync batching
export const SYNC_BATCH_SIZE = 25;
