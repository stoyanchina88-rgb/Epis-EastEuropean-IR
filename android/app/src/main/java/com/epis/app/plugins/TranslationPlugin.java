package com.epis.app.plugins;

import android.content.Context;
import android.util.Log;

import com.arm.aichat.internal.InferenceEngineImpl;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "Translation")
public class TranslationPlugin extends Plugin {
    private static final String TAG = "TranslationPlugin";
    private static final String MODEL_URL = "https://hf-mirror.com/AngelSlim/Hy-MT1.5-1.8B-1.25bit-GGUF/resolve/main/Hy-MT1.5-1.8B-1.25bit.gguf";
    private static final String MODEL_FILENAME = "hy-mt.gguf";
    private static final long PROGRESS_INTERVAL_MS = 500;

    private InferenceEngineImpl engine;
    private boolean modelReady = false;

    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            engine = InferenceEngineImpl.getInstance(getContext());
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Init failed", e);
            call.reject("Init failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isModelReady(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ready", modelReady);
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        new Thread(() -> {
            try {
                File modelDir = new File(getContext().getFilesDir(), "models");
                modelDir.mkdirs();
                File modelFile = new File(modelDir, MODEL_FILENAME);

                if (modelFile.exists() && modelFile.length() > 1000000) {
                    JSObject ret = new JSObject();
                    ret.put("status", "exists");
                    ret.put("path", modelFile.getAbsolutePath());
                    ret.put("size", modelFile.length());
                    call.resolve(ret);
                    return;
                }

                HttpURLConnection conn = (HttpURLConnection) new URL(MODEL_URL).openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(60000);
                conn.setRequestProperty("User-Agent", "EpisApp/1.0");
                conn.connect();

                int totalSize = conn.getContentLength();
                if (totalSize <= 0) {
                    totalSize = 461 * 1024 * 1024; // 461MB fallback
                }

                InputStream is = conn.getInputStream();
                FileOutputStream fos = new FileOutputStream(modelFile);
                byte[] buf = new byte[32768];
                int len;
                long downloaded = 0;
                long lastNotify = 0;

                while ((len = is.read(buf)) != -1) {
                    fos.write(buf, 0, len);
                    downloaded += len;

                    long now = System.currentTimeMillis();
                    if (now - lastNotify > PROGRESS_INTERVAL_MS) {
                        lastNotify = now;
                        int percent = (int) (downloaded * 100 / totalSize);
                        JSObject progress = new JSObject();
                        progress.put("percent", Math.min(percent, 99));
                        progress.put("downloaded", downloaded);
                        progress.put("total", (long) totalSize);
                        notifyListeners("downloadProgress", progress);
                    }
                }

                fos.flush();
                fos.close();
                is.close();

                JSObject done = new JSObject();
                done.put("percent", 100);
                done.put("downloaded", downloaded);
                done.put("total", downloaded);
                notifyListeners("downloadProgress", done);

                JSObject ret = new JSObject();
                ret.put("status", "downloaded");
                ret.put("path", modelFile.getAbsolutePath());
                ret.put("size", downloaded);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Download failed", e);
                JSObject err = new JSObject();
                err.put("error", e.getMessage());
                notifyListeners("downloadError", err);
                call.reject("Download failed: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void checkModelExists(PluginCall call) {
        try {
            File modelFile = new File(getContext().getFilesDir(), "models/" + MODEL_FILENAME);
            JSObject ret = new JSObject();
            ret.put("exists", modelFile.exists() && modelFile.length() > 1000000);
            ret.put("path", modelFile.getAbsolutePath());
            ret.put("size", modelFile.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void loadModel(PluginCall call) {
        try {
            String path = call.getString("path");
            if (path == null) {
                path = new File(getContext().getFilesDir(), "models/" + MODEL_FILENAME).getAbsolutePath();
            }
            if (engine == null) {
                engine = InferenceEngineImpl.getInstance(getContext());
            }
            engine.loadModel(path);
            // Hy-MT auto-detects source language — no need to specify it
            modelReady = true;
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Load model failed", e);
            call.reject("Load model failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void translate(PluginCall call) {
        try {
            String text = call.getString("text");
            if (text == null) { call.reject("text is required"); return; }
            String targetLang = call.getString("targetLang", "Chinese");
            // Hy-MT auto-detects source language — just tell it the target
            engine.setSystemPrompt("Translate to " + targetLang + ". Output only the translation.");
            String result = engine.sendUserPrompt(text);
            JSObject ret = new JSObject();
            ret.put("result", result);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Translate failed", e);
            call.reject("Translate failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void unloadModel(PluginCall call) {
        try { engine.cleanUp(); modelReady = false; call.resolve(); }
        catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("state", engine != null ? engine.getState() : "NoEngine");
        ret.put("modelReady", modelReady);
        call.resolve(ret);
    }
}