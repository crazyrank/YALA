# YSIS Mobile — Expo SDK 57 Upgrade Package (Corrected)

This package contains the production-ready source code from the original YALA/YSIS mobile app, updated to work with **Expo SDK 57**.

## What was changed

1. **package.json** — Expo SDK 57, React Native **0.86.3**, React 19.2.3, and official matching Expo module versions. React Navigation upgraded from v6 → v7.
2. **app.json** — Proper iOS camera + Face ID permission strings and expo-camera plugin message. Duplicate Android permission removed.
3. **expo-file-system** — Imports switched to `expo-file-system/legacy` so photo + CSV code continues to work without a full rewrite.
4. **Navigation** — `headerBackTitleVisible` (removed in React Navigation v7) replaced with the supported `headerBackTitle: ''`.
5. **Missing util restored** — `src/utils/classProgression.js` is included (required by StudentDetailScreen).
6. **Backup / temporary files removed** — No `.bak`, `.backup.js`, or git-original files.
7. **.gitignore added** — Protects `node_modules`, `.env*`, local SQLite files, and secrets.
8. **No secrets** — Only the public API base URL is present. No database credentials, JWT secrets, or Cloudinary keys.

## What stayed the same

- Local SQLite schema and file name (`ysis.db`)
- All business logic, sync engine, offline-first behaviour
- Camera already used modern `CameraView` (compatible)
- SQLite already used modern async API (compatible)
- Remote backend + Neon PostgreSQL remain unchanged

## How to use this ZIP

1. Create a fresh Expo 57 project (if you haven’t already):
   ```bash
   npx create-expo-app@latest ysis-mobile --template blank
   cd ysis-mobile
   ```

2. Unzip this package **into** the project root (overwrite the default files):
   ```bash
   unzip -o ysis-sdk57-upgrade-corrected.zip -d .
   ```

3. Install dependencies and let Expo align exact versions:
   ```bash
   npm install
   npx expo install --fix
   ```

4. Start the app:
   ```bash
   npx expo start
   ```

5. (Recommended) Run the doctor:
   ```bash
   npx expo-doctor
   ```

## Important notes after upgrade

- **React Navigation v6 → v7**: Most APIs are compatible. The one breaking option (`headerBackTitleVisible`) has already been fixed in this package. Still test login → unlock → main tabs → student detail → camera flows.
- **Expo Go**: You need Expo Go that supports SDK 57 (or a development build).
- **New Architecture** is the default in SDK 57; the existing code is compatible.
- Local SQLite data on a device that previously ran the SDK 51 app will continue to work (same schema and file name).

## Security notes

- This package contains **no** production secrets.
- The only network endpoint is the already-public backend URL.
- After unzipping, never commit any future `.env` files that contain real credentials.
- `.gitignore` already excludes `.env*`, `node_modules`, and local `*.db` files.

