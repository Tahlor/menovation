# #4 Fire TV Android app (APK) + install on Fire Stick

## Acceptance criteria
- [ ] AC1 `android/` project builds a debug APK (`./gradlew assembleDebug`) targeting Fire OS (minSdk 22).
- [ ] AC2 Manifest declares Leanback launcher + `touchscreen` not required + banner so it appears on the Fire TV home.
- [ ] AC3 WebView loads `https://data.taylorarchibald.com/menovation/` with media autoplay allowed, DOM storage,
      cookies persisted, fullscreen video support, and the TV user agent marker (`MenovationTV`).
- [ ] AC4 BACK is routed to the web app's back handler; exits only when the app says it is at root.
- [ ] AC5 Redirect to `/sso/login` shows the QR pairing page (#3).
- [ ] AC6 `scripts/install_firetv.sh <ip>` connects over adb, installs/replaces the APK and launches it.
- [ ] AC7 Verified installed and launching on the Fire Stick on the LAN.
