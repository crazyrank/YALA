#!/data/data/com.termux/files/usr/bin/bash
# YALAMATRIX SIS: Android development client for testing on your phone.
#
#   bash dev-android.sh build   builds the dev client APK on EAS (cloud build)
#   bash dev-android.sh start   starts Metro so the installed dev client can load the app
#
# The fingerprint skip is EAS_SKIP_AUTO_FINGERPRINT=1 (the name eas-cli reads).
# It is also set in eas.json under the "development" profile.

set -e

APP_DIR="$HOME/YALA_SIS/ysis-mobile"
export EAS_SKIP_AUTO_FINGERPRINT=1

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "Could not find $APP_DIR. Run this from anywhere, with the repo at ~/YALA_SIS."
  exit 1
fi

cd "$APP_DIR"

case "${1:-}" in
  build)
    if ! command -v node >/dev/null 2>&1; then
      echo "Installing Node.js..."
      pkg install -y nodejs
    fi
    if ! command -v eas >/dev/null 2>&1; then
      echo "Installing eas-cli..."
      npm install -g eas-cli
    fi
    if ! eas whoami >/dev/null 2>&1; then
      echo "Log in to your Expo account:"
      eas login
    fi
    echo "Building the development client for Android (this runs on EAS, it takes a while)..."
    eas build --profile development --platform android
    echo
    echo "When it finishes, open the link EAS prints on your phone and install the APK."
    echo "Then run: bash dev-android.sh start"
    ;;
  start)
    if [ ! -d node_modules ]; then
      echo "Installing packages (first run only)..."
      npm install
    fi
    echo "Starting Metro for the development client."
    echo "On the phone, open the installed YALAMATRIX dev client and scan or pick this server."
    npx expo start --dev-client
    ;;
  *)
    echo "Usage: bash dev-android.sh build | start"
    exit 1
    ;;
esac
