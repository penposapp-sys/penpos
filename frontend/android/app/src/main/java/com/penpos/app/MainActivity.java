package com.penpos.app;

import android.os.Bundle;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginLoadException;
import com.getcapacitor.PluginManager;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        initialPlugins.add(PenposRuntimePlugin.class);
        super.onCreate(savedInstanceState);
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
