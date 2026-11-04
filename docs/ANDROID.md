# Android app

The APK is the same React app wrapped with **Capacitor 8**. It adds:

- A real **share-sheet target** ("Save to SaveSutra") for links, text and images (`@capgo/capacitor-share-target`, intent filters in `AndroidManifest.xml`).
- **Native HTTP** for reading public pages' metadata without browser CORS limits.
- Native **share/export** (Filesystem + Share plugins), Android **back button** handling, branded icon and splash.

## Get the APK

Every push to `main` runs [`.github/workflows/android.yml`](../.github/workflows/android.yml), which builds the APK and publishes it to the **latest** release:

<https://github.com/GOD-MANAV/savesutra/releases/latest/download/SaveSutra.apk>

The default build is **debug-signed**, which is fine for sideloading. To publish a release-signed APK, add these repository secrets:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

Create a keystore with: `keytool -genkey -v -keystore release.keystore -alias savesutra -keyalg RSA -keysize 2048 -validity 10000`

## Build locally

Requirements: Node 22, JDK 21, Android SDK (Android Studio).

```bash
npm install
cd apps/web
npx vite build --mode native   # PWA service worker off inside the app
npx cap sync android
cd android && ./gradlew assembleDebug
# → apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

Regenerate icons and splash after changing the logo: `npm run icons -w @savesutra/web`.
