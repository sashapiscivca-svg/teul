import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teul.app',
  appName: 'teul',
  webDir: 'dist',
  backgroundColor: '#0f1119',
  android: {
    allowMixedContent: false,
    // no inspecting the app's insides from a computer over USB in the build people install
    webContentsDebuggingEnabled: false,
    // the game draws under the camera cut-out itself and keeps its controls inside env(safe-area-inset-*)
    adjustMarginsForEdgeToEdge: 'disable',
  },
  plugins: {
    SystemBars: { insetsHandling: 'disable' },
  },
};

export default config;
