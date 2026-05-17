package com.arm.aichat.internal;

import android.content.Context;
import android.util.Log;
import com.arm.aichat.InferenceEngine;
import java.io.File;

public final class InferenceEngineImpl implements InferenceEngine {
    private static final String TAG = "InferenceEngineImpl";
    private static final String NATIVE_LIB_NAME = "ai-chat";
    private boolean modelLoaded = false;
    private boolean initialized = false;
    private static volatile InferenceEngineImpl instance;

    public static InferenceEngineImpl getInstance(Context context) {
        if (instance == null) {
            synchronized (InferenceEngineImpl.class) {
                if (instance == null) {
                    instance = new InferenceEngineImpl(context.getApplicationInfo().nativeLibraryDir);
                }
            }
        }
        return instance;
    }

    private InferenceEngineImpl(String libDir) {
        Log.i(TAG, "Instantiating");
        try { System.loadLibrary(NATIVE_LIB_NAME); Log.i(TAG, "Loaded: " + systemInfo()); }
        catch (UnsatisfiedLinkError e) { throw new RuntimeException(e.getMessage()); }
    }

    public void loadModel(String path) {
        if (!new File(path).exists()) throw new IllegalArgumentException("Not found: " + path);
        if (!initialized) { init(); initialized = true; }
        int r = load(path); if (r != 0) throw new RuntimeException("Load failed: " + r);
        prepare(); modelLoaded = true;
    }

    public void setSystemPrompt(String p) { if (!modelLoaded) throw new IllegalStateException(); processSystemPrompt(p); }
    public String sendUserPrompt(String text) {
        if (!modelLoaded) throw new IllegalStateException();
        processUserPrompt(text); StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 512; i++) { String t = generateNextToken(); if (t == null || t.isEmpty()) break; sb.append(t); }
        return sb.toString().trim();
    }
    public void cleanUp() { if (modelLoaded) { unload(); modelLoaded = false; } }
    public void destroy() { cleanUp(); shutdown(); initialized = false; }
    public String getState() {
        if (!initialized) return "Uninitialized";
        if (!modelLoaded) return "Initialized";
        return "ModelReady";
    }
    private static native int init();
    private native int load(String p);
    private native int prepare();
    private static native String systemInfo();
    private static native int benchModel(int n);
    private native int processSystemPrompt(String p);
    private native int processUserPrompt(String p);
    private native String generateNextToken();
    private native int unload();
    private static native int shutdown();
}