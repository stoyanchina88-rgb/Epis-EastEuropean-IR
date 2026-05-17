package com.epis.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.epis.app.plugins.TranslationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // MUST register before super.onCreate — because super.onCreate calls load()
        // which creates the Bridge with all registered plugins.
        // If we register after, the register after super.onCreate, the plugin is NOT included.
        registerPlugin(TranslationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}