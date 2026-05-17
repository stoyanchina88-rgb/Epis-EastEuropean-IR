import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.epis.app',
  appName: 'Epis',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  // For live reload debugging on the same WiFi:
  // Uncomment and update the URL below with your computer's local IP
  // server: {
  //   url: 'http://192.168.x.x:5173',
  //   cleartext: true,
  // },
};

export default config;