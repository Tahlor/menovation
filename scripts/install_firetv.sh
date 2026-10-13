#!/usr/bin/env bash
# Install the Menovation TV APK on a Fire TV over the network.
# Usage: scripts/install_firetv.sh <fire-tv-ip>[:5555] [path/to.apk]
# Prereq on the Fire TV: Settings > My Fire TV > Developer Options > ADB debugging ON.
set -euo pipefail
IP="${1:?usage: $0 <fire-tv-ip> [apk]}"
APK="${2:-$(dirname "$0")/../android/app/build/outputs/apk/debug/app-debug.apk}"
ADB="${ADB:-adb}"
command -v "$ADB" >/dev/null || ADB="/mnt/c/Users/taylor/AppData/Local/Android/Sdk/platform-tools/adb.exe"
[[ "$IP" == *:* ]] || IP="$IP:5555"
[[ -f "$APK" ]] || { echo "APK not found: $APK (run: cd android && ./gradlew assembleDebug)"; exit 1; }
# adb.exe on WSL needs a Windows path
if [[ "$ADB" == *.exe ]]; then APK="$(wslpath -w "$APK")"; fi
"$ADB" connect "$IP"
echo "If the Fire TV shows 'Allow USB debugging?', choose Always allow."
"$ADB" -s "$IP" install -r "$APK"
"$ADB" -s "$IP" shell am start -n com.taylorarchibald.menovation/.MainActivity
echo "Installed and launched on $IP"
