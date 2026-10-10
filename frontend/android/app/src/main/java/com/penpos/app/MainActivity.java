package com.penpos.app;

import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeWebViewClient;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginLoadException;
import com.getcapacitor.PluginManager;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private PenposUpdateManager updateManager;
    private final BackPressTracker backPressTracker = new BackPressTracker();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        initialPlugins.add(PenposRuntimePlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                boolean showExitConfirmation =
                        backPressTracker.shouldShowExitConfirmation(SystemClock.elapsedRealtime());
                dispatchBackEvent(showExitConfirmation ? "confirmExit" : "navigate");
            }
        });

        restrictWebViewNavigation();
        updateManager = new PenposUpdateManager(this);
        updateManager.checkForUpdate();
    }

    private void dispatchBackEvent(String action) {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        bridge.getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('penposAndroidBack', { detail: { action: '" +
                        action + "' } }));",
                null
        );
    }

    private void restrictWebViewNavigation() {
        if (bridge == null) {
            return;
        }

        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return shouldBlockExternalUrl(request.getUrl()) ||
                        super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return shouldBlockExternalUrl(Uri.parse(url)) ||
                        super.shouldOverrideUrlLoading(view, url);
            }

            private boolean shouldBlockExternalUrl(Uri uri) {
                return !bridge.getHost().equalsIgnoreCase(uri.getHost()) ||
                        !bridge.getScheme().equalsIgnoreCase(uri.getScheme());
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();

        if (updateManager != null) {
            updateManager.onResume();
        }
    }

    @Override
    public void onDestroy() {
        if (updateManager != null) {
            updateManager.destroy();
        }

        super.onDestroy();
    }

    @Override
    protected void load() {
        try {
            PluginManager loader = new PluginManager(getAssets());
            bridgeBuilder.setPlugins(filterOptionalPlugins(loader.loadPluginClasses()));
        } catch (PluginLoadException ex) {
            Logger.error("Error loading plugins.", ex);
        } catch (Exception ex) {
            Logger.error("Unexpected error while preparing plugins.", ex);
        }

        super.load();
    }

    private List<Class<? extends Plugin>> filterOptionalPlugins(List<Class<? extends Plugin>> plugins) {
        List<Class<? extends Plugin>> filtered = new ArrayList<>();
        boolean firebaseConfigured = PenposRuntimePlugin.isFirebaseConfigured(this);

        for (Class<? extends Plugin> pluginClass : plugins) {
            if (!firebaseConfigured && PushNotificationsPlugin.class.getName().equals(pluginClass.getName())) {
                Logger.info("Firebase config missing. PushNotifications plugin skipped.");
                continue;
            }

            filtered.add(pluginClass);
        }

        return filtered;
    }
}
