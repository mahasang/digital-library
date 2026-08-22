import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'la.org.digitallibrary',
  appName: 'ຫ້ອງສະໝຸດດິຈິຕອນ',
  // ชี้ไปที่ production URL แทนการ bundle web assets
  // เพราะ Next.js App Router ไม่รองรับ static export เต็มรูปแบบ
  server: {
    url: 'https://digital-library-sls.vercel.app',
    cleartext: false, // HTTPS only
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true เฉพาะตอน debug
  },
  plugins: {
    // ตั้งค่า SplashScreen
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#185ff2',
      showSpinner: false,
    },
  },
};

export default config;
