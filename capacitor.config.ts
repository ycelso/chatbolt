import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatbolt.app',
  appName: 'ChatBolt',
  webDir: 'public',
  server: {
    androidScheme: 'https'
  }
};

export default config;
