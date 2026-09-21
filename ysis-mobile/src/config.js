/**
 * App configuration
 *
 * IMPORTANT:
 * - Never hardcode secrets or production-only URLs in a way that is hard to change.
 * - For real production builds, prefer using app.config.js + Constants.expoConfig.extra
 *   so you can switch environments (dev / staging / production) easily.
 */

// Change this to your production backend URL
export const API_BASE_URL = "https://ysis-backend.onrender.com";

// Photo compression settings (locked decision from Build Spec)
export const PHOTO_TARGET_WIDTH = 400;
export const PHOTO_TARGET_HEIGHT = 400;
export const PHOTO_JPEG_QUALITY = 0.6;

// How many pending operations to send in one sync batch
export const SYNC_BATCH_SIZE = 25;

// Request timeout (ms)
export const API_TIMEOUT_MS = 15000;
