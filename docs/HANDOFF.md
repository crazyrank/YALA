# YSIS handoff

Read this first when continuing. It records decisions, file locations, and how work is delivered.

## Project
- Yalamatrix Student Information System (YSIS).
- Backend: `ysis-backend` (Node, Express, PostgreSQL, deployed on Render as `ysis-backend`).
- Mobile: `ysis-mobile` (Expo, Dev client, offline-first with local SQLite and a sync queue).
- Repo: github.com/crazyrank/YALA. Branch `main`.
- The phone app talks to `https://ysis-backend.onrender.com` (set in `ysis-mobile/src/config.js`).

## Roles
- Director: owner of the system. Has every Principal privilege.
- Principal: gets only the permissions the Director grants, except the Director alone controls the Principal's own permissions.
- Head Teacher: division scope, can reassign class teachers, can register students.
- Class Teacher: one class only. Writes biodata and the log book for that class.
- Guest: read-only, assigned students only. Created by Director or Principal.

## Access rules decided
- Director approves and revokes a Principal's device. Principal cannot approve or revoke a Principal device.
- Black Book: Principal and Director.
- Permissions: Director manages all. Principal manages Head Teacher and Class Teacher permissions only.
- Head Teachers cannot promote students. Only Director and Principal can.
- Exited students are visible to admins only.

## Quick actions (dashboard, `ysis-mobile/src/screens/StudentsListScreen.js`)
- Director and Principal: Register Student, Export, Check Results, School Website, Import, Promote Class, Approve Devices, Black Book, Staff Reports, Alumni, Permissions, Manage Staff, Guest Accounts, Class Teachers, Audit Log.
- Head Teacher: Register Student, Export, Check Results, School Website, Import, Log Book.
- Class Teacher: Register Student (own class), School Website, Biodata (own class).
- Guest: Student List (assigned students), School Website.

## Known gaps
- Guest Accounts and Class Teachers need internet. Your spec says they must work offline. Not built yet.
- Stat cards: "Students" and "Records" show the same number. Redesign pending.
- Guest search: the server returns "Something went wrong" for `/students?search=`. Cause not yet confirmed (needs the Render log line).
- Guest expiry: the date is now DD/MM/YYYY on the phone. The server still expects the ISO date it receives after conversion.

## Files to ignore or remove
- Any `*.bak` files, for example `sync.routes.js.bak` and `devices.routes.js.bak`. Delete once the current version is confirmed working.
- `ysis-backend/CATEOF` is a stray file from a bad paste. Delete it.
- `confirm-ghosts.js`, `diagnose-sync2.js`, `staffcheck.js` in the backend root. One-off scripts, not part of the app.

## How work is delivered
- Complete files only, written with a Termux heredoc (`cat > path << 'EOF'`), backing up the old file first to `<name>.bak`.
- Before writing a file, the current version is read from the source zip so nothing is guessed.
- Each change says what was checked, and the user runs and confirms it before the next one.
- No em dashes or spaced dashes in written text.

## Open questions
- None right now. Record new decisions here.
