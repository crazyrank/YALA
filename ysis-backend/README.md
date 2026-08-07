# YSIS Backend

Express + PostgreSQL backend for the YALAMATRIX Student Information System.
Full architecture context: see `YSIS_BUILD_SPEC.md` (paste that into this
project's root, or keep it alongside for reference).

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a Neon database**
   - Sign up at https://neon.tech (free, no card required)
   - Create a project, copy the pooled connection string

3. **Environment file**
   ```
   cp .env.example .env.development
   ```
   Fill in:
   - `DATABASE_URL` — your Neon connection string
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate two different values:
     ```
     openssl rand -hex 32
     ```

4. **Run migrations**
   ```
   npm run migrate:up
   ```
   This creates all 13 tables in dependency order across 4 migration files.

5. **Seed the Director account** (only way to create the first account — no public registration)
   ```
   node scripts/seed-director.js
   ```

6. **Start the server**
   ```
   npm run dev
   ```
   Visit `http://localhost:4000/health` to confirm it's running.

## Project layout

```
migrations/              4 migration files, run in order via node-pg-migrate
src/
  config.js               env loading + validation
  db.js                    Postgres pool (Neon, SSL)
  app.js                   Express app assembly
  server.js                entry point
  middleware/
    auth.js                JWT + device-trust check on every request
    audit.js                append-only audit log writer
  routes/
    auth.routes.js          login, refresh, logout, password reset
    students.routes.js      CRUD, class-scoped search, promotion
    sync.routes.js           offline operation queue processor
    conflicts.routes.js      conflict + admission-merge-queue resolution
    permissions.routes.js    temporary permission delegation
    notifications.routes.js  in-app notifications
    devices.routes.js        device list + remote revocation
  services/
    studentService.js       the conditional-update conflict-detection logic
    permissionService.js    role + delegated permission checks
    syncService.js           FIFO, idempotent operation processing
  utils/
    errors.js                AppError + error response shape
    hash.js                  bcrypt (12 rounds) + temp credential generation
    jwt.js                    access/refresh token signing (separate secrets)
scripts/
  seed-director.js          one-time Director account creation
```

## What's implemented vs. what's next

**Implemented (server-side, Steps 1-9 of the build order):**
Migrations, auth + device trust, audit logging, students CRUD with class
scoping, sync endpoint with FIFO + idempotent + conflict detection,
conflicts + admission merge queue resolution, permission delegation,
notifications, password reset, **passport photo upload** (both the
direct `POST /students/:id/photo` route and the queued `upload_photo`
sync operation), enforcing exactly one current photo per student with a
mandatory-reason Principal-only correction path, uploaded to Cloudinary.

**Not yet implemented:**
- Expo mobile app's UI for promotion and permission delegation — the
  backend endpoints exist and work, no screens call them yet.
- `sync_operations_archive` strategy and the retention job (flagged as
  open items in the build spec).
- Rate limiting on `/auth/login` (5 attempts/IP/15min per the original
  architecture doc — not yet wired in, recommend `express-rate-limit`).

## Security notes

- Never commit `.env.development` or `.env.production`. Only `.env.example` is tracked.
- Production secrets live on Render's dashboard only, never on a local machine.
- `audit_logs` has `UPDATE`/`DELETE` revoked from the app's DB role via migration 004 — verify this actually took effect on your specific Neon role (some managed providers restrict self-revocation; check via Neon's SQL console if the migration's DO block logged a NOTICE instead of applying it).
