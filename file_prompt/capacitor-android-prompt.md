# Android App — Capacitor Phase 1: Setup + Build

## Context

โปรเจกต์นี้คือ Next.js 15 App Router + TypeScript + Supabase digital research library
- Production URL: `https://digital-library-sls.vercel.app`
- PWA มีอยู่แล้ว: `public/manifest.webmanifest`, `public/sw.js`, icons PNG ครบ
- Auth: Supabase cookie-based session, MFA (aal2) สำหรับ super_admin
- PDF: Signed URL อายุสั้น — ห้าม cache เด็ดขาด
- OS: Windows, shell: Git Bash

## เป้าหมาย Phase 1

1. ติดตั้ง Capacitor และ config ให้ชี้ไปที่ production URL
2. สร้าง Android project
3. Build APK ทดสอบได้บน Android emulator หรือมือถือจริง
4. ตรวจสอบ auth, navigation, และ signed URL ทำงานถูกต้อง

## ห้ามทำ

- ห้ามแตะ RLS, middleware, signed URL logic, MFA flow
- ห้ามแตะ `app/api/`, Supabase client, database schema
- ห้ามแตะ `public/sw.js`, `public/offline.html`
- ห้าม deploy หรือเปลี่ยน production config ของ Next.js
- ห้าม commit `android/` folder ทั้งหมดเข้า git (เพิ่มใน .gitignore)

---

## Step 1 — ตรวจสอบ environment

```bash
# ตรวจ Node.js version (ต้องการ >= 18)
node --version

# ตรวจ Java (ต้องการ JDK 17+)
java -version

# ตรวจ Android Studio / SDK
echo $ANDROID_HOME
ls "$ANDROID_HOME/platform-tools/adb" 2>/dev/null && echo "ADB OK" || echo "ADB not found"

# ตรวจ Gradle
gradle --version 2>/dev/null || echo "Gradle: will use wrapper"
```

รายงานสิ่งที่พบก่อนดำเนินการต่อ

---

## Step 2 — ติดตั้ง Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

---

## Step 3 — Init Capacitor

```bash
npx cap init "ຫ້ອງສະໝຸດດິຈິຕອນ" "la.org.digitallibrary" --web-dir=out
```

**หมายเหตุ:**
- App name: `ຫ້ອງສະໝຸດດິຈິຕອນ` (ปรับได้ตามต้องการ)
- App ID: `la.org.digitallibrary` (ปรับให้ตรงกับ domain จริงขององค์กร)
- `--web-dir=out` เพราะ Next.js static export จะ output ไปที่ `out/`

---

## Step 4 — แก้ capacitor.config.ts

สร้างหรือแก้ `capacitor.config.ts`:

```typescript
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
```

**สำคัญ:** ใช้ `server.url` ชี้ไป production แทนการ bundle เพราะ:
- Next.js App Router + i18n ต้องการ server-side rendering
- Auth cookie ทำงานได้บน production domain เท่านั้น
- Signed URL validation เชื่อมกับ Supabase project

---

## Step 5 — เพิ่ม Android platform

```bash
npx cap add android
```

---

## Step 6 — แก้ AndroidManifest.xml

เปิด `android/app/src/main/AndroidManifest.xml` แล้วตรวจว่ามี permissions ครบ:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

และตรวจ `<application>` tag มี:
```xml
android:usesCleartextTraffic="false"
```

---

## Step 7 — แก้ network_security_config.xml

สร้าง `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">digital-library-sls.vercel.app</domain>
        <domain includeSubdomains="true">wpiaynjqnmqimcuhexaq.supabase.co</domain>
    </domain-config>
</network-security-config>
```

อ้างอิงใน AndroidManifest.xml:
```xml
android:networkSecurityConfig="@xml/network_security_config"
```

---

## Step 8 — เพิ่ม android/ เข้า .gitignore

```bash
cat >> .gitignore << 'EOF'

# Capacitor Android (generated — do not commit)
/android/
EOF
```

---

## Step 9 — Sync และ Build

```bash
# Sync config
npx cap sync android

# เปิด Android Studio (ถ้ามี)
npx cap open android
```

ถ้าต้องการ build APK โดยตรงโดยไม่เปิด Android Studio:

```bash
cd android
./gradlew assembleDebug
```

APK จะอยู่ที่:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Step 10 — ทดสอบบน emulator หรือมือถือจริง

```bash
# ตรวจ devices ที่เชื่อมต่อ
npx cap run android --list

# รันบน device/emulator
npx cap run android
```

### สิ่งที่ต้องทดสอบ

- [ ] แอปเปิดได้และโหลด production URL
- [ ] Language switcher ทำงาน (เปลี่ยน lo/th/en/vi)
- [ ] Login ด้วย email/password ได้
- [ ] MFA challenge ทำงานถูกต้อง
- [ ] ดูรายการงานวิจัยได้
- [ ] กด PDF ดูออนไลน์ได้ (Signed URL)
- [ ] ออกจากระบบได้

---

## Step 11 — แก้ปัญหา Cookie / Auth (ถ้าพบ)

Capacitor WebView อาจมีปัญหา cookie ข้าม origin ให้เพิ่มใน `capacitor.config.ts`:

```typescript
server: {
  url: 'https://digital-library-sls.vercel.app',
  androidScheme: 'https',
  // เพิ่มถ้ามีปัญหา cookie
  hostname: 'digital-library-sls.vercel.app',
},
```

---

## รายงานผลที่ต้องการ

1. ผล environment check จาก Step 1
2. ไฟล์ที่สร้างและแก้ไข
3. ผล `npx cap sync android` และ `./gradlew assembleDebug`
4. Path ของ APK ที่ได้
5. ผลการทดสอบบน device (ถ้าทำได้)
6. ปัญหาที่พบ + วิธีแก้

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| Cookie auth ไม่ทำงานใน WebView | ใช้ `server.url` ชี้ production + `androidScheme: 'https'` |
| Signed URL PDF ไม่เปิด | ตรวจ network_security_config ให้ครอบ Supabase domain |
| MFA TOTP ใช้งานไม่ได้ | ทดสอบบน real device ไม่ใช่แค่ emulator |
| Mixed content HTTPS/HTTP | `allowMixedContent: false` + `usesCleartextTraffic="false"` |
| Android keystore สำหรับ Play Store | Phase 2 — ไม่ทำใน Phase 1 นี้ |
| `android/` folder ถูก commit เข้า git | เพิ่มใน .gitignore ก่อน Step 5 เสมอ |

---

## Phase ถัดไป (หลัง Phase 1 ผ่าน)

- **Phase 2**: App icon, Splash screen, Push notifications
- **Phase 3**: Keystore signing, Play Store listing, AAB build
- **Phase 4**: Deep links, Biometric login (fingerprint)
