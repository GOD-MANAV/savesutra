import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.savesutra.app',
  appName: 'SaveSutra',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    // Native HTTP lets the app read public pages' metadata without CORS limits.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
