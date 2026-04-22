import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jktv.streaming',
  appName: 'JKTV',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true, // Permitir HTTP local para desarrollo
  },
  android: {
    allowMixedContent: true, // Necesario para streaming de videos
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
