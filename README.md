# YSIS Mobile (Expo)

React Native app for Head Teachers and Principals. Offline-first, mirrors
the backend's PostgreSQL schema locally in SQLite. Full architecture
context: `YSIS_BUILD_SPEC.md`.

## Setup

1. **Install dependencies**
   ```
   npm install --legacy-peer-deps
   ```
   (`--legacy-peer-deps` is needed because of a couple of Expo SDK 51
   peer-dependency version overlaps; this is safe here.)

2. **Point the app at your backend**

   Edit `src/config.js`:
   ```js
   export const API_BASE_URL = 'http://YOUR_LAN_IP:4000';
   ```
   If testing with Expo Go on a physical phone, `localhost` will NOT
   work — the phone can't reach your laptop's localhost. Use your
   machine's LAN IP (find it with `ipconfig` on Windows or `ifconfig` /
   `ip addr` on Mac/Linux). Once the backend is deployed to Render, swap
   this for the Render URL.

3. **Run it**
   ```
   npx expo start
   ```
   Scan the QR code with Expo Go (Android) or the Camera app (iOS), or
   press `a` / `i` for an emulator if you have one set up.

## What's implemented

- SQLite mirror schema (exact match to Postgres, enums as TEXT + CHECK)
- Device fingerprint generation, persisted locally
- Login (online, registers device) → biometric unlock on return visits
- API client with automatic silent token refresh on 401
- Sync engine: local-commit-first, FIFO per-device `sequence_no`
  (auto-increment, never timestamp-based), idempotent via
  `operation_id`, auto-triggers on reconnect
- Students list: local-first search against the SQLite mirror (works
  fully offline), background reconcile with the server
- Two-step registration flow, including the offline admission-number
  fallback path when a Head Teacher can't yet see a Principal's
  pre-registration
- **Live camera capture** (`CameraCaptureScreen`, `expo-camera`'s
  `CameraView`), wired end to end: capture → compress to 400x400 JPEG →
  save locally → queue for sync → uploads to Cloudinary via the
  backend's `photoService` the moment the device reconnects
- Passport photo rule enforced on both ends: exactly one photo per
  student, permanent. A Head Teacher hitting an existing photo is
  blocked client-side AND server-side. A Principal replacing one goes
  through a mandatory reason prompt before the camera opens
- Passive offline marquee: generic message, no live pending count, never
  blocks the UI
- Conflict blocker: wraps the Principal/Director dashboard only, blocks
  other actions until open conflicts AND open merge-queue items are both
  resolved
- Conflicts screen and admission-merge-queue screen, both
  Principal/Director-only, calling the corresponding backend endpoints

## What's NOT implemented yet (be aware before demoing)

- **Push notifications** — deliberately deferred per the locked
  decision; in-app `notifications` table only for now.
- **Promotion UI** — the backend endpoint (`POST
  /students/:id/promote`) exists and is fully implemented, but there's
  no screen calling it yet.
- **Permission delegation UI** — same situation: backend ready, no
  screen yet for a Principal to grant/revoke a Head Teacher's temporary
  permission.
- **Cloudinary must be configured on the backend** for photo uploads to
  actually complete — see `ysis-backend/.env.example`. Without it, a
  captured photo saves locally fine but the sync operation will show as
  `failed` with code `PHOTO_STORAGE_NOT_CONFIGURED` until you add
  credentials.

## Testing without a real Neon database yet

You can run the app and exercise all the OFFLINE-only behavior (local
search, local registration, the SQLite mirror, the offline marquee)
without any backend running at all — everything writes locally first.
Anything requiring the server (login, sync, conflict resolution) will
fail gracefully with a network-error message until the backend from
`ysis-backend` is running and reachable at the URL in `src/config.js`.
