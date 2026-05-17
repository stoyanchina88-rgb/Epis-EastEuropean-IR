package com.arm.aichat;
public interface InferenceEngine {
    int DEFAULT_PREDICT_LENGTH = 1024;
    void loadModel(String modelPath);
    void setSystemPrompt(String prompt);
    String sendUserPrompt(String text);
    void cleanUp();
    void destroy();
    String getState();
}