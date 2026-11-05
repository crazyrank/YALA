#!/data/data/com.termux/files/usr/bin/bash
# Applies the head teacher permissions and scoped import fix to a YSIS project.
# Run from the folder that contains ysis-backend and ysis-mobile.
# Usage: bash apply-head-teacher-fix.sh [path/to/head-teacher-fix.patch]

set -e

PATCH="${1:-head-teacher-fix.patch}"

if [ ! -d ysis-backend ] || [ ! -d ysis-mobile ]; then
  echo "ERROR: Run this script from the YALA-handover folder (the one that contains ysis-backend and ysis-mobile)."
  exit 1
fi

if [ ! -f "$PATCH" ]; then
  echo "ERROR: Patch file not found: $PATCH"
  echo "Copy head-teacher-fix.patch into this folder, or pass its full path."
  exit 1
fi

if ! command -v patch >/dev/null 2>&1; then
  echo "Installing patch..."
  pkg install -y patch
fi

echo "Step 1/4: Checking the patch (no files changed yet)..."
if ! patch -p1 --dry-run -s < "$PATCH"; then
  echo "ERROR: The patch does not apply cleanly. Nothing was changed."
  echo "Your files may already differ from the handover. Send this message to the developer."
  exit 1
fi
echo "  Patch checks out."

BACKUP="backup-before-head-teacher-fix-$(date +%Y%m%d-%H%M%S).tar.gz"
echo "Step 2/4: Saving a backup to $BACKUP ..."
tar -czf "$BACKUP" --exclude=node_modules ysis-backend ysis-mobile README.md
echo "  Backup saved."

echo "Step 3/4: Applying the patch..."
patch -p1 -s < "$PATCH"
echo "  Patch applied."

echo "Step 4/4: Checking syntax of changed backend files..."
if command -v node >/dev/null 2>&1; then
  for f in \
    ysis-backend/src/routes/studentImport.routes.js \
    ysis-backend/src/routes/students.routes.js \
    ysis-backend/src/services/studentService.js \
    ysis-backend/src/services/syncService.js \
    ysis-backend/src/utils/studentChangeRules.js; do
    node --check "$f" && echo "  ok  $f"
  done
else
  echo "  Node is not installed here, so the syntax check was skipped."
fi

echo ""
echo "Done. The fix is applied."
echo "To undo it, run: tar -xzf $BACKUP"
echo "Next: run the tests in the README handover notes before going live."
