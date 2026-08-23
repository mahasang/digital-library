# Digital Library Mobile — Expo Phase 1: Setup + Auth + Navigation

## Context

- แอปใหม่แยกจาก Next.js project — **สร้าง repo ใหม่** ชื่อ `digital-library-mobile`
- Supabase project เดิม: `wpiaynjqnmqimcuhexaq` (Singapore)
- Production web: `https://digital-library-sls.vercel.app`
- ชื่อแอป: `ຫ້ອງສະໝຸດດິຈິຕອນ` (ลาว) / `Digital Library Plus` (อังกฤษ)
- App ID: `la.org.digitallibrary.mobile`
- Theme: ขาวครีม (`#FAFAF7`) + accent `#185ff2`
- Platform เป้าหมาย: Android (iOS ในอนาคต)
- OS: Windows, shell: Git Bash

## Design Direction

**โทนสี:**
- Background: `#FAFAF7` (ขาวครีมอบอุ่น)
- Surface/Card: `#FFFFFF`
- Primary accent: `#185ff2`
- Text primary: `#1a1a2e`
- Text secondary: `#64748b`
- Border: `#e2e8f0`

**สไตล์:**
- Clean และ minimal — ไม่ cluttered
- Card-based layout
- Bottom tab navigation (Home, Research, Account)
- ไม่มี hamburger menu — ใช้ bottom tabs แทน
- Font: System font (San Francisco / Roboto)

## Scope Phase 1

1. สร้าง Expo project ใหม่
2. ติดตั้ง dependencies ทั้งหมด
3. ตั้งค่า Supabase client
4. สร้าง Auth flow (Login, Register)
5. สร้าง Bottom Tab Navigation
6. สร้าง Home screen placeholder
7. ทดสอบด้วย Expo Go

## ห้ามทำ

- ห้ามแตะ Next.js project เดิม (`digital-library`)
- ห้ามแตะ Supabase production settings
- ห้ามทำ Play Store ใน Phase นี้

---

## Step 1 — สร้าง Expo Project

```bash
# สร้างใน folder ข้างๆ Next.js project
cd /c/Project
npx create-expo-app digital-library-mobile --template blank-typescript
cd digital-library-mobile
```

---

## Step 2 — ติดตั้ง Dependencies

```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

# Supabase
npx expo install @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-url-polyfill

# UI
npx expo install expo-linear-gradient
npx expo install expo-image
npx expo install @expo/vector-icons

# Secure Storage (token)
npx expo install expo-secure-store

# Status bar
npx expo install expo-status-bar
```

---

## Step 3 — โครงสร้าง Folder

สร้างโครงสร้างนี้:

```
digital-library-mobile/
├── app/                    ← screens
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx     ← Bottom Tab Navigator
│   │   ├── index.tsx       ← Home
│   │   ├── research.tsx    ← Research list
│   │   └── account.tsx     ← Profile
│   └── _layout.tsx         ← Root layout (auth check)
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── LoadingSpinner.tsx
│   └── auth/
│       └── AuthGuard.tsx
├── lib/
│   ├── supabase.ts         ← Supabase client
│   └── auth.ts             ← Auth helpers
├── constants/
│   └── theme.ts            ← Colors, spacing, typography
└── app.json
```

---

## Step 4 — Theme Constants

สร้าง `constants/theme.ts`:

```typescript
export const colors = {
  background: '#FAFAF7',
  surface: '#FFFFFF',
  primary: '#185ff2',
  primaryLight: '#EEF3FF',
  primaryDark: '#1248c4',
  text: {
    primary: '#1a1a2e',
    secondary: '#64748b',
    muted: '#94a3b8',
    inverse: '#FFFFFF',
  },
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
};
```

---

## Step 5 — Supabase Client

สร้าง `lib/supabase.ts`:

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

สร้าง `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://wpiaynjqnmqimcuhexaq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**สำคัญ:** ใช้ `EXPO_PUBLIC_` prefix — Expo expose ตัวแปรนี้ให้ client ได้
ห้ามใส่ service_role key ในแอป mobile เด็ดขาด

---

## Step 6 — UI Components

### `components/ui/Button.tsx`

```typescript
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, typography, spacing } from '@/constants/theme';

type Variant = 'primary' | 'outline' | 'ghost';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  onPress, title, variant = 'primary',
  loading = false, disabled = false, style
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} size="small" />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.primary },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  text: { ...typography.label },
  primaryText: { color: colors.text.inverse },
  outlineText: { color: colors.primary },
  ghostText: { color: colors.primary },
});
```

### `components/ui/Input.tsx`

```typescript
import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  secureToggle?: boolean;
}

export function Input({ label, error, secureToggle, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.inputError : styles.inputNormal]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={secureToggle && !showPassword}
          {...props}
        />
        {secureToggle && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.text.primary, marginBottom: spacing.xs },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  inputNormal: { borderColor: colors.border },
  inputError: { borderColor: colors.error },
  input: { flex: 1, ...typography.body, color: colors.text.primary },
  eyeIcon: { padding: spacing.xs },
  errorText: { ...typography.caption, color: colors.error, marginTop: 4 },
});
```

### `components/ui/Card.tsx`

```typescript
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadows } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: boolean;
}

export function Card({ children, style, shadow = true }: CardProps) {
  return (
    <View style={[styles.card, shadow && shadows.sm, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
```

---

## Step 7 — Auth Screens

### `app/(auth)/login.tsx`

```typescript
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, spacing, typography, radius } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  async function handleLogin() {
    // Validate
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = 'กรุณากรอกอีเมล';
    if (!password) newErrors.password = 'กรุณากรอกรหัสผ่าน';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', error.message);
      return;
    }

    router.replace('/(tabs)/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Ionicons name="library" size={36} color={colors.primary} />
          </View>
          <Text style={styles.appName}>Digital Library Plus</Text>
          <Text style={styles.appNameLao}>ຫ້ອງສະໝຸດດິຈິຕອນ</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>ເຂົ້າສູ່ລະບົບ</Text>
          <Text style={styles.subtitle}>ເຂົ້າສູ່ລະບົບເພື່ອເຂົ້າເຖິງງານວິໄຈ</Text>

          <Input
            label="ອີເມວ"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />

          <Input
            label="ລະຫັດຜ່ານ"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureToggle
            error={errors.password}
          />

          <Button
            title="ເຂົ້າສູ່ລະບົບ"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          <Button
            title="ຍັງບໍ່ມີບັນຊີ? ສະໝັກສະມາຊິກ"
            onPress={() => router.push('/(auth)/register')}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xl,
  },
  logoArea: { alignItems: 'center', marginBottom: spacing.xxl },
  logoIcon: {
    width: 80, height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appName: { ...typography.h3, color: colors.primary },
  appNameLao: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 2 },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
  loginButton: { marginTop: spacing.sm, marginBottom: spacing.sm },
});
```

---

## Step 8 — Root Layout (Auth Check)

สร้าง `app/_layout.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {session ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}
```

---

## Step 9 — Bottom Tab Navigator

สร้าง `app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ຫນ້າທຳອິດ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="research"
        options={{
          title: 'ງານວິໄຈ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'ບັນຊີ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## Step 10 — Home Screen Placeholder

สร้าง `app/(tabs)/index.tsx`:

```typescript
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { Card } from '@/components/ui/Card';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>ສະບາຍດີ 👋</Text>
          <Text style={styles.headerTitle}>ຫ້ອງສະໝຸດດິຈິຕອນ</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="library" size={24} color={colors.primary} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'ງານວິໄຈ', value: '—', icon: 'document-text-outline' },
            { label: 'ຫມວດຫມູ່', value: '—', icon: 'folder-outline' },
            { label: 'ຫນ່ວຍງານ', value: '—', icon: 'business-outline' },
          ].map((stat) => (
            <Card key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon as any} size={20} color={colors.primary} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card>
          ))}
        </View>

        {/* Coming soon */}
        <Card style={styles.comingSoon}>
          <Ionicons name="construct-outline" size={32} color={colors.primary} />
          <Text style={styles.comingSoonText}>ກຳລັງພັດທະນາ...</Text>
          <Text style={styles.comingSoonSub}>Phase 2 ຈະມີລາຍຊື່ງານວິໄຈ</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  greeting: { ...typography.caption, color: colors.text.secondary },
  headerTitle: { ...typography.h3, color: colors.text.primary },
  headerIcon: {
    width: 44, height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: spacing.lg, gap: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', gap: 4, padding: spacing.md },
  statValue: { ...typography.h2, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.text.secondary },
  comingSoon: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  comingSoonText: { ...typography.h3, color: colors.text.primary },
  comingSoonSub: { ...typography.bodySmall, color: colors.text.secondary },
});
```

---

## Step 11 — ตั้งค่า app.json

แก้ `app.json`:

```json
{
  "expo": {
    "name": "ຫ້ອງສະໝຸດດິຈິຕອນ",
    "slug": "digital-library-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#FAFAF7"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#185ff2"
      },
      "package": "la.org.digitallibrary.mobile"
    },
    "plugins": ["expo-router"],
    "scheme": "digitallibrary"
  }
}
```

---

## Step 12 — ทดสอบด้วย Expo Go

```bash
# ติดตั้ง Expo Go บน Android จาก Play Store ก่อน
# แล้วรัน:
npx expo start

# สแกน QR code จาก terminal ด้วย Expo Go app
```

### สิ่งที่ต้องทดสอบ
- [ ] หน้า Login แสดงผลถูกต้อง
- [ ] กรอก email/password แล้ว login ได้
- [ ] หลัง login เข้า Home screen
- [ ] Bottom tabs ทำงาน (Home, Research, Account)
- [ ] Logout แล้วกลับมาหน้า Login

---

## รายงานผลที่ต้องการ

1. ผล `npx expo start` — error ไหมหรือเปิดได้เลย
2. Screenshot จาก Expo Go บน Android
3. ปัญหาที่พบ + วิธีแก้

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| `EXPO_PUBLIC_` prefix ขาด | ตรวจ `.env` ก่อน start |
| AsyncStorage session หาย | `persistSession: true` ใน Supabase config |
| Expo Router ไม่ recognize screens | ตรวจ folder structure ให้ตรง |
| `@/` path alias ไม่ทำงาน | เพิ่มใน `tsconfig.json` paths |

---

## Step 0 — สร้าง GitHub Repo ก่อน (ทำก่อน Step 1)

**1. ไปที่ GitHub.com → New repository**
- Repository name: `digital-library-mobile`
- Description: `Digital Library Plus — React Native Expo mobile app`
- Public หรือ Private ตามต้องการ
- **ไม่ต้อง** tick "Add README" (จะ init เองใน terminal)
- กด **Create repository**

**2. สร้าง Expo project แล้ว push ขึ้น GitHub:**

```bash
# สร้างใน folder ข้างๆ Next.js project
cd /c/Project
npx create-expo-app digital-library-mobile --template blank-typescript
cd digital-library-mobile

# Init git และ push ขึ้น GitHub
git init
git remote add origin https://github.com/mahasang/digital-library-mobile.git
git add -A
git commit -m "feat: initial Expo project setup"
git push -u origin main
```

จากนั้นค่อยทำ Step 2-12 ตามลำดับ และ commit หลังแต่ละ step ครับ

**Commit message แนะนำ:**
```bash
# หลัง Step 2-3 (dependencies + structure)
git add -A && git commit -m "feat: install dependencies and setup folder structure"

# หลัง Step 4-5 (theme + supabase)
git add -A && git commit -m "feat: add theme constants and Supabase client"

# หลัง Step 6 (UI components)
git add -A && git commit -m "feat: add Button, Input, Card UI components"

# หลัง Step 7-10 (screens + navigation)
git add -A && git commit -m "feat: add auth screens, tabs navigation, home screen"

# Push ทั้งหมด
git push origin main
```
