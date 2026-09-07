package com.penpos.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PenposUpdateManager {

    private static final String UPDATE_URL =
            "https://penpos.cloud/updates/android/update.json";

    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private JSONObject pendingUpdate;
    private File pendingApk;

    public PenposUpdateManager(Activity activity) {
        this.activity = activity;
    }

    public void checkForUpdate() {
        executor.execute(() -> {
            try {
                HttpURLConnection connection =
                        (HttpURLConnection) new URL(UPDATE_URL).openConnection();

                connection.setRequestMethod("GET");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setUseCaches(false);

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    connection.disconnect();
                    return;
                }

                InputStream input = connection.getInputStream();
                StringBuilder builder = new StringBuilder();
                byte[] buffer = new byte[4096];
                int count;

                while ((count = input.read(buffer)) != -1) {
                    builder.append(new String(buffer, 0, count));
                }

                input.close();
                connection.disconnect();

                JSONObject update = new JSONObject(builder.toString());

                int remoteVersionCode = update.getInt("versionCode");
                int currentVersionCode = BuildConfig.VERSION_CODE;

                if (remoteVersionCode <= currentVersionCode) {
                    return;
                }

                activity.runOnUiThread(() -> showUpdateDialog(update));

            } catch (Exception ignored) {
                // Güncelleme kontrolü başarısızsa uygulamanın normal çalışması devam eder.
            }
        });
    }

    private void showUpdateDialog(JSONObject update) {
        try {
            pendingUpdate = update;

            String versionName = update.optString("versionName", "");
            String title = update.optString(
                    "title",
                    "Yeni güncelleme hazır"
            );
            String message = update.optString(
                    "message",
                    "PenPOS için yeni bir sürüm mevcut."
            );
            boolean required = update.optBoolean("required", false);

            String fullMessage = message;

            if (!versionName.isEmpty()) {
                fullMessage += "\n\nYeni sürüm: " + versionName;
            }

            AlertDialog.Builder builder = new AlertDialog.Builder(activity)
                    .setTitle(title)
                    .setMessage(fullMessage)
                    .setPositiveButton("Güncelle", (dialog, which) -> {
                        downloadUpdate();
                    });

            if (!required) {
                builder.setNegativeButton("Daha sonra", null);
            }

            AlertDialog dialog = builder.create();

            if (required) {
                dialog.setCanceledOnTouchOutside(false);
                dialog.setOnCancelListener(d -> showUpdateDialog(update));
            }

            dialog.show();

        } catch (Exception ignored) {
        }
    }

    private void downloadUpdate() {
        if (pendingUpdate == null) {
            return;
        }

        Toast.makeText(
                activity,
                "Güncelleme indiriliyor...",
                Toast.LENGTH_SHORT
        ).show();

        executor.execute(() -> {
            try {
                String apkUrl = pendingUpdate.getString("apkUrl");

                URL url = new URL(apkUrl);
                HttpURLConnection connection =
                        (HttpURLConnection) url.openConnection();

                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new Exception("APK indirme başarısız.");
                }

                File apkFile = new File(
                        activity.getFilesDir(),
                        "penpos-update.apk"
                );

                if (apkFile.exists() && !apkFile.delete()) {
                    throw new Exception("Eski APK silinemedi.");
                }

                MessageDigest digest = MessageDigest.getInstance("SHA-256");

                int totalBytes = connection.getContentLength();
                int downloadedBytes = 0;

                try (
                        InputStream input =
                                new BufferedInputStream(connection.getInputStream());
                        FileOutputStream output =
                                new FileOutputStream(apkFile)
                ) {
                    byte[] buffer = new byte[8192];
                    int count;

                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        digest.update(buffer, 0, count);
                        downloadedBytes += count;

                        if (totalBytes > 0) {
                            int progress =
                                    (int) (((long) downloadedBytes * 100) / totalBytes);

                            final int finalProgress = progress;

                            activity.runOnUiThread(() ->
                                    Toast.makeText(
                                            activity,
                                            "Güncelleme: %" + finalProgress,
                                            Toast.LENGTH_SHORT
                                    ).show()
                            );
                        }
                    }
                }

                connection.disconnect();

                String expectedSha256 =
                        pendingUpdate.optString("sha256", "");

                if (!expectedSha256.isEmpty()) {
                    String actualSha256 = bytesToHex(digest.digest());

                    if (!actualSha256.equalsIgnoreCase(expectedSha256)) {
                        if (!apkFile.delete()) {
                            // Do nothing; invalid APK will not be installed.
                        }

                        throw new Exception(
                                "APK SHA-256 doğrulaması başarısız."
                        );
                    }
                }

                pendingApk = apkFile;

                activity.runOnUiThread(this::installUpdate);

            } catch (Exception ex) {
                activity.runOnUiThread(() ->
                        Toast.makeText(
                                activity,
                                "Güncelleme indirilemedi.",
                                Toast.LENGTH_LONG
                        ).show()
                );
            }
        });
    }

    private void installUpdate() {
        if (pendingApk == null || !pendingApk.exists()) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PackageManager packageManager = activity.getPackageManager();

            if (!packageManager.canRequestPackageInstalls()) {
                new AlertDialog.Builder(activity)
                        .setTitle("Kurulum izni gerekli")
                        .setMessage(
                                "PenPOS güncellemesini kurabilmek için " +
                                "bu uygulamaya bilinmeyen kaynaklardan APK " +
                                "yükleme izni vermelisiniz."
                        )
                        .setPositiveButton("Ayarları aç", (dialog, which) -> {
                            Intent intent = new Intent(
                                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + activity.getPackageName())
                            );
                            activity.startActivity(intent);
                        })
                        .setNegativeButton("İptal", null)
                        .show();

                return;
            }
        }

        try {
            Uri apkUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    pendingApk
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(
                    apkUri,
                    "application/vnd.android.package-archive"
            );
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            activity.startActivity(intent);

        } catch (Exception ex) {
            Toast.makeText(
                    activity,
                    "APK kurulum ekranı açılamadı.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder();

        for (byte value : bytes) {
            builder.append(
                    String.format(
                            Locale.US,
                            "%02x",
                            value & 0xff
                    )
            );
        }

        return builder.toString();
    }

    public void onResume() {
        if (pendingApk != null && pendingApk.exists()) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                    activity.getPackageManager().canRequestPackageInstalls()) {
                installUpdate();
            }
        }
    }

    public void destroy() {
        executor.shutdownNow();
    }
}
