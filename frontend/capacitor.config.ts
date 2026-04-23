import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jktv.streaming',
  appName: 'JKTV',
  webDir: 'dist',
  server: {
    androidScheme: 'http', // 👈 CAMBIO CRÍTICO: Se cambió 'https' por 'http'
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a0f',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0f',
      showSpinner: false,
    },
  },
};

export default config;