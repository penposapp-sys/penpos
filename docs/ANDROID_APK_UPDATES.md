# Android APK updates

The Android app checks a JSON manifest at startup. Its default URL is
`https://penpos.cloud/public/updates/android/update.json`; override it for a
build with the Gradle property `penposAndroidUpdateManifestUrl`.

The backend serves `backend/public` under `/public`. Deploy both the manifest
and the signed APK in `backend/public/updates/android/`, for example:

```json
{
  "versionCode": 6,
  "versionName": "1.5",
  "apkUrl": "PenPOS-1.5.apk",
  "sha256": "7a09d122f6d657ba82fccc1cc21b1c17185cb54deabe5d38599c07b74e4fb580",
  "message": "PenPOS için yeni bir sürüm mevcut."
}
```

The release BAT keeps publishing the versioned APK named by `apkUrl` for the
Android updater and atomically updates `latest.apk` to the same verified file.
The website download button uses the stable URL
`https://penpos.cloud/public/updates/android/latest.apk`.

`apkUrl` may be an absolute HTTPS URL or a path relative to the manifest.
`versionCode` is compared with the installed Android package version. Increment
it for every release, and sign each APK with the same signing key and
application ID (`com.penpos.app`) as the installed app. Android displays its
own install confirmation; on Android 8 and newer, users must also grant this
app permission to install unknown apps.

Increment `versionCode` and update the manifest and versioned APK together for
each release. The publisher verifies the public manifest, versioned APK URL,
stable website URL, and both APK SHA-256 values before reporting success.
