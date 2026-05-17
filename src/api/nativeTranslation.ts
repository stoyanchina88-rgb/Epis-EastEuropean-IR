/**
 * Native translation bridge for Capacitor.
 * Uses TranslationPlugin to access the Hy-MT GGUF model.
 */

import { registerPlugin } from '@capacitor/core';

interface TranslationPluginInterface {
  initialize(): Promise<void>;
  isModelReady(): Promise<{ ready: boolean }>;
  downloadModel(): Promise<{ status: string; path?: string; size?: number }>;
  checkModelExists(): Promise<{ exists: boolean; path?: string; size?: number }>;
  loadModel(options: { path?: string }): Promise<void>;
  translate(options: { text: string; targetLang?: string }): Promise<{ result: string }>;
  unloadModel(): Promise<void>;
  getStatus(): Promise<{ state: string; modelReady: boolean }>;
}

interface TranslationResult {
  success: boolean;
  result?: string;
  error?: string;
  source: 'native' | 'api';
}

// Register the native plugin with Capacitor's plugin system
const Translation = registerPlugin<TranslationPluginInterface>('Translation');

// Check if we're in a Capacitor native environment
const isNative = (): boolean => {
  try {
    return !!(window as any).Capacitor?.isNativePlatform();
  } catch {
    return false;
  }
};

export const nativeTranslation = {
  /** Initialize the native engine (loads libai-chat.so) */
  async initialize(): Promise<boolean> {
    try {
      await Translation.initialize();
      return true;
    } catch (e) {
      console.warn('Native translation init failed:', e);
      return false;
    }
  },

  /** Check if model is ready */
  async isReady(): Promise<boolean> {
    try {
      const ret = await Translation.isModelReady();
      return ret.ready;
    } catch {
      return false;
    }
  },

  /** Check if model file already exists on disk */
  async checkModelExists(): Promise<{ exists: boolean; path?: string; size?: number }> {
    try {
      return await Translation.checkModelExists();
    } catch {
      return { exists: false };
    }
  },

  /** Download the GGUF model (~461MB) */
  async downloadModel(): Promise<{ status: string; path?: string }> {
    if (!isNative()) throw new Error('Not running on native device');

    // Check if already downloaded first
    const existing = await this.checkModelExists();
    if (existing.exists) {
      return { status: 'exists', path: existing.path };
    }

    // The native download method returns a Promise that resolves on completion.
    // Progress events are sent via notifyListeners on the native side,
    // but we skip addListener here since it requires the event method
    // to be declared in the native PluginHeader.
    // The caller gets notified when download finishes or fails.
    const result = await Translation.downloadModel();
    return { status: 'downloaded', path: result.path };
  },

  /** Load model into memory */
  async loadModel(path?: string): Promise<void> {
    await Translation.loadModel({ path });
  },

  /** Translate text using the native GGUF model */
  async translate(text: string, targetLang: string = 'Chinese'): Promise<TranslationResult> {
    try {
      const ret = await Translation.translate({ text, targetLang });
      return { success: true, result: ret.result, source: 'native' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Translation failed', source: 'native' };
    }
  },

  /** Unload model to free memory */
  async unload(): Promise<void> {
    await Translation.unloadModel();
  },

  /** Get engine status */
  async getStatus(): Promise<{ state: string; modelReady: boolean }> {
    try {
      return await Translation.getStatus();
    } catch {
      return { state: 'NoPlugin', modelReady: false };
    }
  },

  /** Check if native environment is available */
  isNativeAvailable(): boolean {
    return isNative();
  },
};

export default nativeTranslation;