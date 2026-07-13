package com.penpos.app;

import android.content.Context;
import android.content.res.Resources;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PenposRuntime")
public class PenposRuntimePlugin extends Plugin {

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        boolean firebaseConfigured = isFirebaseConfigured(getContext());
        result.put("nativePlatform", true);
        result.put("firebaseConfigured", firebaseConfigured);
        result.put("pushAvailable", firebaseConfigured);
        call.resolve(result);
    }

    static boolean isFirebaseConfigured(Context context) {
        if (!BuildConfig.PENPOS_FIREBASE_CONFIGURED) {
            return false;
        }

        try {
            Resources resources = context.getResources();
            int appIdResId = resources.getIdentifier("google_app_id", "string", context.getPackageName());
            if (appIdResId == 0) {
                return false;
            }
            String appId = resources.getString(appIdResId);
            return appId != null && !appId.trim().isEmpty();
        } catch (Exception ignored) {
            return false;
        }
    }
}
