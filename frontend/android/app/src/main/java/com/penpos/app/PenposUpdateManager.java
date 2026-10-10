package com.penpos.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PenposUpdateManager {

    private static final String TAG = "PenposUpdateManager";

    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private JSONObject pendingUpdate;
    private File pendingApk;
    private boolean awaitingInstallPermission;

    public PenposUpdateManager(Activity activity) {
        this.activity = activity;
    }

    public void checkForUpdate() {
        executor.execute(() -> {
            try {
                HttpURLConnection connection =
                        (HttpURLConnection) new URL(BuildConfig.PENPOS_ANDROID_UPDATE_MANIFEST_URL).openConnection();

                connection.setRequestMethod("GET");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setUseCaches(false);

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    Log.w(TAG, "Update manifest request returned HTTP " + responseCode);
                    connection.disconnect();
                    return;
                }

                ByteArrayOutputStream output = new ByteArrayOutputStream();
                try (InputStream input = connection.getInputStream()) {
                    byte[] buffer = new byte[4096];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                    }
                }

                connection.disconnect();

                JSONObject update = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));

                int remoteVersionCode = update.getInt("versionCode");
                int currentVersionCode = BuildConfig.VERSION_CODE;

                if (remoteVersionCode <= currentVersionCode) {
                    return;
                }

                activity.runOnUiThread(() -> {
                    if (!activity.isFinishing() && !activity.isDestroyed()) {
                        showUpdateDialog(update);
                    }
                });

            } catch (Exception ex) {
                Log.e(TAG, "Android update check failed", ex);
            }
        });
    }

    private void showUpdateDialog(JSONObject update) {
        try {
            pendingUpdate = update;

            String versionName = update.optString("versionName", "").trim();
            if (versionName.isEmpty()) {
                versionName = String.valueOf(update.getInt("versionCode"));
            }
            boolean required = update.optBoolean("required", false);
            showPenposDialog(
                    "Yeni güncelleme mevcut",
                    "PenPOS için yeni bir sürüm mevcut.\n\nYeni sürüm: " + versionName,
                    "Güncelle",
                    this::downloadUpdate,
                    required ? null : "Daha sonra",
                    null,
                    required
            );

        } catch (Exception ex) {
            Log.e(TAG, "Could not show Android update dialog", ex);
        }
    }

    private void showPenposDialog(
            String title,
            String message,
            String positiveText,
            Runnable positiveAction,
            String negativeText,
            Runnable negativeAction,
            boolean required
    ) {
        int padding = dp(24);
        LinearLayout card = new LinearLayout(activity);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(padding, padding, padding, dp(20));
        GradientDrawable cardBackground = new GradientDrawable();
        cardBackground.setColor(Color.rgb(17, 24, 39));
        cardBackground.setCornerRadius(dp(24));
        cardBackground.setStroke(dp(1), Color.rgb(48, 62, 87));
        card.setBackground(cardBackground);

        TextView titleView = new TextView(activity);
        titleView.setText(title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(20);
        titleView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        card.addView(titleView);

        TextView messageView = new TextView(activity);
        messageView.setText(message);
        messageView.setTextColor(Color.rgb(214, 222, 235));
        messageView.setTextSize(16);
        messageView.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        messageParams.topMargin = dp(12);
        card.addView(messageView, messageParams);

        LinearLayout actions = new LinearLayout(activity);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams actionsParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        actionsParams.topMargin = dp(24);
        card.addView(actions, actionsParams);

        TextView negativeButton = null;
        if (negativeText != null) {
            negativeButton = createDialogButton(negativeText, false);
            actions.addView(negativeButton);
        }

        View spacer = new View(activity);
        actions.addView(spacer, new LinearLayout.LayoutParams(dp(10), 1));
        TextView positiveButton = createDialogButton(positiveText, true);
        actions.addView(positiveButton);

        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setView(card)
                .create();
        dialog.setCancelable(!required);
        dialog.setCanceledOnTouchOutside(!required);
        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawableResource(android.R.color.transparent);
        }
        positiveButton.setOnClickListener(view -> {
            dialog.dismiss();
            if (positiveAction != null) positiveAction.run();
        });
        if (negativeButton != null) {
            negativeButton.setOnClickListener(view -> {
                dialog.dismiss();
                if (negativeAction != null) negativeAction.run();
            });
        }
        dialog.setOnShowListener(ignored -> {
            Window shownWindow = dialog.getWindow();
            if (shownWindow != null) {
                shownWindow.setLayout(
                    activity.getResources().getDisplayMetrics().widthPixels - dp(40),
                    WindowManager.LayoutParams.WRAP_CONTENT
                );
            }
        });
        dialog.show();
    }

    private TextView createDialogButton(String label, boolean primary) {
        TextView button = new TextView(activity);
        button.setText(label);
        button.setTextColor(primary ? Color.WHITE : Color.rgb(214, 222, 235));
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(18), dp(12), dp(18), dp(12));

        GradientDrawable background = new GradientDrawable();
        background.setCornerRadius(dp(14));
        if (primary) {
            background.setColor(Color.rgb(49, 86, 211));
        } else {
            background.setColor(Color.rgb(35, 45, 63));
            background.setStroke(dp(1), Color.rgb(66, 79, 101));
        }
        button.setBackground(background);
        return button;
    }

    private int dp(int value) {
        return (int) (value * activity.getResources().getDisplayMetrics().density + 0.5f);
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

                URL url = new URL(new URL(BuildConfig.PENPOS_ANDROID_UPDATE_MANIFEST_URL), apkUrl);
                if (!"https".equalsIgnoreCase(url.getProtocol())) {
                    throw new Exception("APK adresi HTTPS olmalıdır.");
                }
                HttpURLConnection connection =
                        (HttpURLConnection) url.openConnection();

                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("APK sunucusu HTTP " + responseCode + " yanıtı verdi.");
                }
                if (!"https".equalsIgnoreCase(connection.getURL().getProtocol())) {
                    throw new Exception("APK indirme HTTPS dışı bir adrese yönlendirildi.");
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
                Log.e(TAG, "Android APK download failed", ex);
                String detail = ex.getLocalizedMessage();
                String message = "Güncelleme indirilemedi." +
                        (detail == null || detail.trim().isEmpty() ? "" : "\n" + detail);
                activity.runOnUiThread(() -> showUpdateError(message));
            }
        });
    }

    private void showUpdateError(String message) {
        if (!activity.isFinishing() && !activity.isDestroyed()) {
            Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
        }
    }

    private void installUpdate() {
        if (pendingApk == null || !pendingApk.exists()) {
            showUpdateError("Kurulacak güncelleme APK'sı bulunamadı.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PackageManager packageManager = activity.getPackageManager();

            if (!packageManager.canRequestPackageInstalls()) {
                awaitingInstallPermission = true;
                showPenposDialog(
                        "Kurulum izni gerekli",
                        "PenPOS güncellemesini kurabilmek için bu uygulamaya bilinmeyen kaynaklardan APK yükleme izni vermelisiniz.",
                        "Ayarları aç",
                        () -> {
                            try {
                                Intent intent = new Intent(
                                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                        Uri.parse("package:" + activity.getPackageName())
                                );
                                activity.startActivity(intent);
                            } catch (Exception ex) {
                                awaitingInstallPermission = false;
                                Log.e(TAG, "Could not open unknown-app install settings", ex);
                                String detail = ex.getLocalizedMessage();
                                showUpdateError("Kurulum izni ayarları açılamadı." +
                                        (detail == null || detail.trim().isEmpty() ? "" : "\n" + detail));
                            }
                        },
                        "İptal",
                        null,
                        false
                );

                return;
            }
        }

        awaitingInstallPermission = false;

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
            Log.e(TAG, "Could not launch Android APK installer", ex);
            String detail = ex.getLocalizedMessage();
            showUpdateError("APK kurulum ekranı açılamadı." +
                    (detail == null || detail.trim().isEmpty() ? "" : "\n" + detail));
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
        if (awaitingInstallPermission &&
                pendingApk != null &&
                pendingApk.exists() &&
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                activity.getPackageManager().canRequestPackageInstalls()) {
            awaitingInstallPermission = false;
            installUpdate();
        }
    }

    public void destroy() {
        executor.shutdownNow();
    }
}
