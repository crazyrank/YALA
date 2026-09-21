#!/data/data/com.termux/files/usr/bin/bash
echo "Removing .bak / .backup / .git-original files..."
find . -type f \( -name "*.bak" -o -name "*.backup" -o -name "*git-original*" \) -print -delete
echo "Done."
