# YSIS: Yalamatrix Student Information System

YSIS is the record-keeping app for Yalamatrix Schools. It keeps student registration, classes, photos, and staff accounts in one place, and it keeps working when the internet is down. Changes made offline are saved on the phone and sent to the server when the connection returns.

The project has two parts:

- ysis-mobile: the Android app, built with Expo and React Native.
- ysis-backend: the API server, built with Node.js and Express, storing data in PostgreSQL.

## What the app does

- Register students, with a photo and a class assignment
- Import students from a CSV file
- Manage classes, promotions, and sessions
- Review conflicts when two devices change the same record
- Manage staff accounts and trusted devices
- Show the Board of Directors and management team in the Staff Directory
- Keep the school website and the results portal available inside the app
- Sign in with a password, then unlock with fingerprint or PIN

## Requirements

- Node.js 20 or newer
- A PostgreSQL database (Neon)
- A Cloudinary account for student and staff photos
- Expo CLI and an EAS account for building the Android app
- A phone with Expo Go for development, or the built APK

## Setting up the backend

1. Install packages:

   cd ysis-backend
   npm install

2. Copy the example environment file and fill in your values:

   cp .env.example .env

   Required variables: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, NODE_ENV. Never commit the .env file.

3. Run the database migrations on an empty database:

   npm run migrate:up

4. Start the server:

   npm start

   For development with automatic restart, use npm run dev.

## Setting up the mobile app

1. Install packages:

   cd ysis-mobile
   npm install

2. Point the app at the backend. The server address is set in src/config.js as API_BASE_URL. Change it to the address of the school's backend before building.

3. Start the development server:

   npx expo start -c

   Scan the QR code with Expo Go, or open the app on an emulator.

## Building the Android app

   cd ysis-mobile
   eas build --profile production --platform android

Keep the Android signing keystore somewhere safe. Without it, the app cannot be updated on phones that already have it installed.

## First use

1. Start the backend with an empty database.
2. Create the first Director account:

   cd ysis-backend
   node scripts/seed-director.js

   The script asks for the full name, email, and a temporary password. The Director must change the password at first sign in.

3. Sign in, change the password when prompted, and add staff accounts from the Manage Staff screen.
4. Approve each phone as a trusted device before it can sync.

## Deployment notes

- Backend: Render. Set the environment variables in the service's Environment tab.
- Database: Neon. Use a connection string with SSL enabled (sslmode=verify-full).
- Photos: stored on Cloudinary as private, authenticated images.

## Security notes

- Passwords are hashed on the server.
- Login is protected against repeated failed attempts.
- Access tokens expire after one hour.
- Each device must be approved as trusted before it can sync.
- Role permissions are described in ROLE-MATRIX.md.

## Known limitations

- The Android build is the only supported platform.
- Some sub-screen headers are still being refined.
- Failed photo uploads are retried from the "Changes not saved" screen.

## Owner

YSIS is owned by Yalamatrix Schools.

---

## Handover notes (working branch)

This branch is the clean working copy of the project as handed over.

**Roles**
- Director: creates principal accounts, manages devices and the directory.
- Principal: creates head teacher accounts and chooses each head teacher's division (Primary or Secondary). Registers, promotes, and edits students.
- Head teacher: sees only their assigned division or classes. Can register students, import students into their own division or classes only, and edit all profile fields (registration number, name, date of birth, gender, arm, guardian details) within that scope. Can view results and the school website. Cannot promote, archive, restore, or replace photos.

**Setup**
1. Run database migrations: `cd ysis-backend && npm run migrate:up` (check package.json for the exact command).
2. Create the first director account with `node scripts/seed-director.js`. Enter the password at the prompt. Never store it in a file.
3. Restart the backend.

**Mobile**
- Development build: `npx eas build --profile development --platform android`
- Run with `npx expo start --dev-client -c`

**Before go-live**
- Change the director password.
- Test one principal, one primary head teacher, and one secondary head teacher.
- Confirm head teachers can register, edit, and import students in their own division, and cannot see Conflicts, Merge Queue, Trusted Devices, or Manage Staff.
