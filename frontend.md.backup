# SafeHer — Frontend React Native Task Guide

Dokumen ini adalah panduan eksekusi step-by-step untuk frontend developer React Native/Expo dalam membangun aplikasi mobile **SafeHer** berdasarkan:

- [`implementation.md`](./implementation.md)
- [`flowchart.md`](./flowchart.md)

Fokus dokumen ini adalah scope **`apps/mobile`**: UI, navigation, state management, integrasi API, Guardian Mode, SOS flow, audio recording, live tracking, offline handling, dan validasi end-to-end di device Android.

---

## 1. Tujuan Frontend

Frontend harus menyediakan aplikasi mobile yang memungkinkan user:

1. Register, login, logout, dan mengelola profil.
2. Menambahkan emergency contacts.
3. Mengaktifkan **Guardian Mode** sebagai safety session.
4. Mendeteksi risiko dari accelerometer, phone drop, dan distress keywords; GPS dipakai untuk tracking/lokasi incident.
5. Menjalankan safety check-in/no-response escalation untuk kondisi freeze/tonic immobility.
6. Menampilkan countdown 5 detik sebelum auto-SOS.
7. Memicu SOS secara manual atau otomatis.
8. Mengirim lokasi terakhir ke backend.
9. Merekam audio lingkungan selama 15 detik setelah SOS.
10. Mengunggah audio untuk dianalisis AI.
11. Mengirim live location via Supabase Realtime.
12. Menampilkan live tracking untuk keluarga/kontak darurat.
13. Menampilkan riwayat dan detail insiden.
14. Menangani offline mode secara aman.

---

## 2. Scope MVP Frontend

### Wajib untuk MVP

- Expo React Native app dengan Expo Router.
- Supabase Auth integration.
- API client ke backend Hono.
- TanStack Query untuk data fetching.
- Zustand untuk app state realtime/local.
- Guardian Mode:
  - background location tracking,
  - persistent notification,
  - accelerometer monitoring,
  - keyword detection fallback atau Picovoice jika key tersedia,
  - risk scoring berbasis keyword/accelerometer/phone drop,
  - safety check-in/no-response escalation,
  - countdown modal.
- SOS flow:
  - `POST /api/sos/trigger`,
  - audio recording 15 detik,
  - `POST /api/sos/:id/audio`,
  - active SOS screen,
  - resolve/false alarm.
- Emergency contacts CRUD.
- Incident history + detail.
- Live tracking sender dan receiver.
- Error handling untuk permission denied, no internet, GPS unavailable.

### Boleh ditunda setelah MVP

- Android Quick Settings Tile.
- Custom native foreground service selain `expo-location` foreground service.
- Full family role/account separation jika backend belum siap.
- Advanced route anomaly detection.
- Production-grade background restart setelah device reboot.
- Full EAS release automation.

---

## 3. Tech Stack Frontend

Gunakan stack berikut sesuai `implementation.md`:

| Area | Library |
| --- | --- |
| App runtime | `expo ~52.0.0` |
| Navigation | `expo-router ~4.0.0` |
| UI | React Native, NativeWind, Tailwind CSS |
| Server state | `@tanstack/react-query` |
| Local/realtime state | `zustand` |
| Auth/database/realtime | `@supabase/supabase-js` |
| Location/background task | `expo-location`, `expo-task-manager` |
| Audio | `expo-audio` |
| Notifications | `expo-notifications` |
| Sensors | `expo-sensors` |
| Secure token storage | `expo-secure-store` |
| Map | `react-native-maps` |
| Haptics | `expo-haptics` |
| Shared types/constants | `@safeher/shared` |

> Catatan: Picovoice (`@picovoice/porcupine-react-native` dan `@picovoice/react-native-voice-processor`) ditambahkan setelah `EXPO_PUBLIC_PICOVOICE_ACCESS_KEY` dan `.ppn` keyword files tersedia. Untuk MVP awal, siapkan fallback strategy.

---

## 4. Environment Variables

Buat file `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://backend.safeher.biz.id
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PICOVOICE_ACCESS_KEY=your-picovoice-key
```

Frontend tidak boleh menyimpan secret server-side seperti Supabase service role key, Firebase admin key, atau Gemini API key.

---

## 5. Kontrak API yang Dipakai Frontend

### Auth

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login user |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Ambil profile user aktif |
| `PUT` | `/api/auth/profile` | Update profile |
| `POST` | `/api/auth/refresh` | Refresh access token |

### Contacts

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `GET` | `/api/contacts` | List emergency contacts |
| `POST` | `/api/contacts` | Tambah contact |
| `PUT` | `/api/contacts/:id` | Update contact |
| `DELETE` | `/api/contacts/:id` | Hapus contact |
| `PUT` | `/api/contacts/:id/primary` | Jadikan primary contact |

### SOS

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `POST` | `/api/sos/trigger` | Trigger SOS |
| `POST` | `/api/sos/:id/audio` | Upload audio SOS |
| `PUT` | `/api/sos/:id/resolve` | Resolve atau false alarm |
| `GET` | `/api/sos/:id/status` | Cek status incident |

Request `POST /api/sos/trigger`:

```ts
{
  triggerType: 'manual' | 'keyword' | 'risk_engine' | 'notification_button' | 'no_response'
  location: {
    latitude: number
    longitude: number
    accuracy?: number
    speed?: number | null
    heading?: number | null
  }
  riskScore?: number
  keywordsDetected?: string[]
  triggerContext?: {
    guardianStartedAt?: string
    lastCheckInAt?: string | null
    missedCheckInAt?: string
    escalationReason?: 'missed_checkin' | 'countdown_timeout'
  }
}
```

### Incidents

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `GET` | `/api/incidents?status=active&limit=20&offset=0` | List incident user |
| `GET` | `/api/incidents/:id` | Detail incident |
| `GET` | `/api/incidents/:id/locations` | Location history |

### Tracking

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `POST` | `/api/tracking/location` | Simpan satu lokasi incident |
| `POST` | `/api/tracking/batch` | Simpan batch lokasi buffered |

> Live tracking realtime utama memakai Supabase Realtime Broadcast channel `tracking:{incidentId}`. Endpoint REST tracking hanya untuk persist history.

---

## 6. Struktur File Frontend yang Disarankan

Buat struktur berikut di `apps/mobile`:

```txt
apps/mobile/
  app/
    _layout.tsx
    +not-found.tsx
    (auth)/
      _layout.tsx
      login.tsx
      register.tsx
    (tabs)/
      _layout.tsx
      index.tsx
      guardian.tsx
      settings.tsx
    countdown.tsx
    sos.tsx
    settings/
      profile.tsx
      contacts.tsx
    incidents/
      index.tsx
      [id].tsx
    tracking/
      [incidentId].tsx

  src/
    components/
      ui/
        Button.tsx
        Card.tsx
        TextField.tsx
        Badge.tsx
        LoadingState.tsx
        ErrorState.tsx
      guardian/
        GuardianStatusCard.tsx
        RiskLevelIndicator.tsx
        SensorStatusList.tsx
        SafetyCheckInCard.tsx
        CountdownOverlay.tsx
      sos/
        SOSButton.tsx
        SOSStatusTimeline.tsx
        AudioRecordingStatus.tsx
      contacts/
        ContactForm.tsx
        ContactListItem.tsx
      incidents/
        IncidentCard.tsx
        IncidentTimeline.tsx
        AISummaryCard.tsx
      maps/
        LiveMap.tsx
        RouteMap.tsx

    hooks/
      useAuth.ts
      useContacts.ts
      useIncidents.ts
      useSOS.ts
      useLiveTracking.ts
      usePermissions.ts
      useNetworkStatus.ts

    lib/
      api.ts
      env.ts
      query-client.ts
      supabase.ts
      errors.ts

    services/
      guardian.ts
      location.ts
      accelerometer.ts
      keyword.ts
      keyword-fallback.ts
      risk-engine.ts
      safety-checkin.ts
      sos.ts
      audio.ts
      live-tracking.ts
      notifications.ts
      offline-queue.ts
      permissions.ts

    stores/
      auth-store.ts
      guardian-store.ts
      sos-store.ts
      network-store.ts

    styles/
      theme.ts

  assets/
    notification-icon.png
    adaptive-icon.png
    keywords/
      tolong_android.ppn
      ampun_android.ppn
      help_android.ppn
```

---

## 7. Prinsip Implementasi

1. **Safety first**: jika satu sensor gagal, Guardian Mode tetap berjalan dengan sensor yang tersedia.
2. **Assume freeze can happen**: jangan desain emergency flow yang mewajibkan user confirm saat bahaya; user hanya perlu cancel jika false alarm.
3. **No-response escalation**: Guardian Mode wajib punya safety check-in/timer agar tetap berguna saat user tidak bisa bicara, bergerak, atau menekan tombol.
4. **Offline tolerant**: SOS, audio, dan lokasi harus bisa di-buffer saat offline.
5. **No secret in mobile**: hanya pakai public anon key dan public API URL.
6. **Minimal tap during emergency**: tombol SOS harus besar, jelas, dan cepat diakses.
7. **Explicit permissions**: jelaskan alasan akses lokasi, mikrofon, dan notifikasi dengan copy yang user-friendly.
8. **Non-blocking SOS**: setelah user trigger SOS, jangan tunggu audio/AI selesai untuk membuat incident. Incident harus dibuat dulu.
9. **Realtime state ≠ server state**:
   - TanStack Query untuk contacts, incidents, profile.
   - Zustand untuk Guardian Mode, risk score, sensor status, safety check-in, active SOS.
10. **Top-level background task**: semua `TaskManager.defineTask` wajib didefinisikan di top-level module, bukan di dalam component React.

---

# 8. Step-by-Step Task Frontend

## Phase FE-0 — Persiapan dan Dependency Check

### Task FE-0.1 — Validasi monorepo dan workspace

**Tujuan:** Pastikan frontend berada di workspace yang benar.

**File terkait:**

- `package.json`
- `pnpm-workspace.yaml`
- `apps/mobile/package.json`
- `packages/shared/src/*`

**Langkah:**

1. Jalankan install dependency dari root repo.
2. Pastikan `apps/mobile` terdaftar sebagai workspace package.
3. Pastikan `@safeher/shared` bisa di-import dari mobile.
4. Pastikan script mobile tersedia:
   - `pnpm --filter @safeher/mobile start`
   - `pnpm --filter @safeher/mobile android`
   - `pnpm --filter @safeher/mobile typecheck`

**Acceptance criteria:**

- Mobile app bisa start via Expo.
- TypeScript bisa resolve import `@safeher/shared`.
- Tidak ada duplicate React/React Native version.

---

### Task FE-0.2 — Setup environment dan config app

**Tujuan:** Siapkan konfigurasi app untuk permission, deep link, dan public env.

**File terkait:**

- `apps/mobile/app.json`
- `apps/mobile/.env`
- `apps/mobile/src/lib/env.ts`

**Langkah:**

1. Tambahkan Expo config:
   - `scheme: "safeher"`,
   - `plugins: expo-router`,
   - `expo-location` dengan background location enabled,
   - `expo-audio` dengan background recording enabled,
   - `expo-notifications`,
   - `expo-secure-store`.
2. Tambahkan Android permissions:
   - `ACCESS_FINE_LOCATION`,
   - `ACCESS_COARSE_LOCATION`,
   - `ACCESS_BACKGROUND_LOCATION`,
   - `RECORD_AUDIO`,
   - `FOREGROUND_SERVICE`,
   - `FOREGROUND_SERVICE_LOCATION`,
   - `FOREGROUND_SERVICE_MICROPHONE`,
   - `VIBRATE`,
   - `RECEIVE_BOOT_COMPLETED`,
   - `POST_NOTIFICATIONS`.
3. Buat `src/lib/env.ts` untuk membaca dan memvalidasi env public.
4. Jika env belum lengkap, tampilkan error jelas saat development.

**Acceptance criteria:**

- App bisa membaca `EXPO_PUBLIC_API_URL` dan Supabase env.
- Android manifest hasil prebuild memiliki permission yang dibutuhkan.
- Tidak ada secret backend masuk ke mobile env.

---

## Phase FE-1 — Foundation App, Provider, dan Client

### Task FE-1.1 — Setup root layout dan providers

**Tujuan:** Semua global provider tersedia sejak app start.

**File terkait:**

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/src/lib/query-client.ts`
- `apps/mobile/src/stores/auth-store.ts`

**Langkah:**

1. Buat `QueryClient` dengan default:
   - query `staleTime` 5 menit,
   - retry query 2x,
   - retry mutation 1x,
   - `refetchOnWindowFocus: false`.
2. Wrap app dengan `QueryClientProvider`.
3. Setup root `Stack` Expo Router.
4. Daftarkan modal routes:
   - `countdown`,
   - `sos`.
5. Load session/auth state saat app start.
6. Setup notification action categories di root startup.

**Acceptance criteria:**

- Semua screen bisa menggunakan TanStack Query.
- Auth state siap sebelum redirect ke auth/main flow.
- Modal `countdown` dan `sos` bisa dibuka via router.

---

### Task FE-1.2 — Setup Supabase client

**Tujuan:** Client Supabase tersedia untuk Auth dan Realtime.

**File terkait:**

- `apps/mobile/src/lib/supabase.ts`
- `apps/mobile/src/stores/auth-store.ts`

**Langkah:**

1. Inisialisasi Supabase client dengan:
   - `EXPO_PUBLIC_SUPABASE_URL`,
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Integrasikan session persistence dengan secure storage jika memungkinkan.
3. Buat helper untuk:
   - `getSession()`,
   - `getAccessToken()`,
   - `signOut()`.
4. Subscribe ke `onAuthStateChange` untuk update auth store.

**Acceptance criteria:**

- User session tetap tersimpan setelah app restart.
- Access token bisa dipakai untuk request backend.
- Logout membersihkan session lokal.

---

### Task FE-1.3 — Setup API client

**Tujuan:** Satu pintu komunikasi ke backend.

**File terkait:**

- `apps/mobile/src/lib/api.ts`
- `apps/mobile/src/lib/errors.ts`
- `apps/mobile/src/hooks/useAuth.ts`
- `apps/mobile/src/hooks/useContacts.ts`
- `apps/mobile/src/hooks/useIncidents.ts`
- `apps/mobile/src/hooks/useSOS.ts`

**Langkah:**

1. Buat wrapper `fetch` atau Hono RPC client.
2. Semua request protected harus otomatis mengirim:

   ```txt
   Authorization: Bearer <accessToken>
   ```

3. Buat normalized error shape:
   - `status`,
   - `message`,
   - `code` jika ada,
   - `isNetworkError`.
4. Tambahkan handling untuk:
   - 401: logout atau refresh token,
   - 413: audio terlalu besar,
   - 500: tampilkan generic error.
5. Pastikan multipart upload audio tidak memaksa header JSON.

**Acceptance criteria:**

- Semua hook data memakai client yang sama.
- Token auth tidak diduplikasi manual di tiap screen.
- Error dari API tampil sebagai pesan yang bisa dipahami user.

---

### Task FE-1.4 — Setup design system ringan

**Tujuan:** UI konsisten dan cepat dibangun.

**File terkait:**

- `apps/mobile/src/components/ui/*`
- `apps/mobile/src/styles/theme.ts`
- `apps/mobile/tailwind.config.js`

**Langkah:**

1. Setup NativeWind.
2. Tentukan warna utama:
   - primary/pink: `#E91E63`,
   - danger/red,
   - success/green,
   - warning/orange,
   - neutral/gray.
3. Buat komponen reusable:
   - `Button`,
   - `Card`,
   - `TextField`,
   - `Badge`,
   - `LoadingState`,
   - `ErrorState`.
4. Buat varian button:
   - primary,
   - secondary,
   - danger,
   - ghost.

**Acceptance criteria:**

- Screen tidak membuat style button/form berulang.
- Semua state loading/error punya tampilan standar.

---

## Phase FE-2 — Auth dan Onboarding

### Task FE-2.1 — Auth route groups

**Tujuan:** Pisahkan flow auth dan main app.

**File terkait:**

- `apps/mobile/app/(auth)/_layout.tsx`
- `apps/mobile/app/(auth)/login.tsx`
- `apps/mobile/app/(auth)/register.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`

**Langkah:**

1. Buat route group `(auth)` untuk login/register.
2. Buat route group `(tabs)` untuk app utama.
3. Tambahkan redirect guard:
   - belum login → `/login`,
   - sudah login → `/(tabs)`.
4. Jangan render main tabs sebelum auth loading selesai.

**Acceptance criteria:**

- User tidak bisa membuka screen protected tanpa login.
- User login otomatis masuk dashboard setelah app restart.

---

### Task FE-2.2 — Login screen

**Tujuan:** User bisa login dengan email/password.

**File terkait:**

- `apps/mobile/app/(auth)/login.tsx`
- `apps/mobile/src/hooks/useAuth.ts`

**Langkah:**

1. Buat form:
   - email,
   - password.
2. Validasi minimal:
   - email valid,
   - password tidak kosong.
3. Panggil `POST /api/auth/login` atau Supabase Auth sesuai keputusan backend.
4. Simpan session/access token.
5. Redirect ke `/(tabs)` saat sukses.
6. Tampilkan error jika credential salah.

**Acceptance criteria:**

- Login sukses mengarah ke Home.
- Error login tidak crash app.
- Button disabled saat loading.

---

### Task FE-2.3 — Register screen

**Tujuan:** User bisa membuat akun baru.

**File terkait:**

- `apps/mobile/app/(auth)/register.tsx`
- `apps/mobile/src/hooks/useAuth.ts`

**Langkah:**

1. Buat form:
   - full name,
   - phone optional,
   - email,
   - password,
   - confirm password.
2. Validasi:
   - password dan confirm password sama,
   - email valid,
   - full name tidak kosong.
3. Panggil `POST /api/auth/register`.
4. Simpan session jika response langsung mengembalikan session.
5. Redirect ke `/(tabs)` atau login sesuai response backend.

**Acceptance criteria:**

- Register sukses membuat profile.
- User dapat lanjut ke dashboard.
- Error validasi tampil inline.

---

### Task FE-2.4 — Logout

**Tujuan:** User bisa keluar dengan aman.

**File terkait:**

- `apps/mobile/app/(tabs)/settings.tsx`
- `apps/mobile/src/hooks/useAuth.ts`
- `apps/mobile/src/stores/auth-store.ts`

**Langkah:**

1. Tambahkan tombol logout di Settings.
2. Panggil endpoint logout jika tersedia.
3. Clear Supabase/session/token lokal.
4. Stop Guardian Mode jika masih aktif.
5. Redirect ke login.

**Acceptance criteria:**

- Setelah logout, user tidak bisa back ke protected screen.
- Background tracking berhenti.

---

## Phase FE-3 — Main Navigation dan Core Screens

### Task FE-3.1 — Tab navigation

**Tujuan:** Buat navigasi utama.

**File terkait:**

- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/guardian.tsx`
- `apps/mobile/app/(tabs)/settings.tsx`

**Langkah:**

1. Buat 3 tab:
   - Home,
   - Guardian,
   - Settings.
2. Gunakan icon sederhana atau text jika icon belum tersedia.
3. Pastikan active tab jelas.
4. Semua tab protected by auth.

**Acceptance criteria:**

- User bisa pindah Home ↔ Guardian ↔ Settings.
- Tab layout tidak muncul di auth screen.

---

### Task FE-3.2 — Home dashboard

**Tujuan:** Home menjadi entry point cepat untuk SOS dan status.

**File terkait:**

- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/src/components/sos/SOSButton.tsx`
- `apps/mobile/src/components/guardian/GuardianStatusCard.tsx`
- `apps/mobile/src/hooks/useIncidents.ts`
- `apps/mobile/src/hooks/useContacts.ts`

**UI wajib:**

1. Greeting user.
2. Quick SOS button besar.
3. Guardian status card:
   - active/inactive,
   - current risk score,
   - GPS status,
   - mic status.
4. Emergency contacts preview.
5. Recent incidents preview.

**Interaksi:**

- Tap Quick SOS → buka countdown atau langsung trigger manual sesuai UX final.
- Untuk MVP safety, disarankan Quick SOS membuka countdown pendek dengan tombol confirm besar, atau langsung trigger jika user menahan tombol.

**Acceptance criteria:**

- Quick SOS mudah ditemukan.
- Recent incidents tampil dari API.
- Jika belum ada contacts, tampilkan CTA tambah contact.

---

### Task FE-3.3 — Guardian screen

**Tujuan:** User bisa mengaktifkan/mematikan Guardian Mode.

**File terkait:**

- `apps/mobile/app/(tabs)/guardian.tsx`
- `apps/mobile/src/stores/guardian-store.ts`
- `apps/mobile/src/services/guardian.ts`
- `apps/mobile/src/components/guardian/*`

**UI wajib:**

1. Tombol besar `Activate Guardian` / `Stop Guardian`.
2. Risk level indicator:
   - low,
   - medium,
   - high,
   - critical.
3. Sensor status:
   - GPS,
   - microphone/keyword,
   - accelerometer,
   - notification.
4. Last known location.
5. Detected keywords list.
6. Last risk signal.

**Acceptance criteria:**

- Tap activate menjalankan permission flow lalu start service.
- Tap stop menghentikan background location, accelerometer, dan keyword detection.
- UI berubah realtime sesuai state Guardian.

---

### Task FE-3.4 — Settings screen

**Tujuan:** Entry point untuk profile, contacts, incidents, dan app info.

**File terkait:**

- `apps/mobile/app/(tabs)/settings.tsx`
- `apps/mobile/app/settings/profile.tsx`
- `apps/mobile/app/settings/contacts.tsx`
- `apps/mobile/app/incidents/index.tsx`

**UI wajib:**

1. Profile summary.
2. Menu:
   - Profile,
   - Emergency Contacts,
   - Incident History,
   - Permissions Status,
   - About SafeHer.
3. Logout button.

**Acceptance criteria:**

- Semua menu membuka screen yang sesuai.
- Logout bekerja.

---

## Phase FE-4 — Profile dan Emergency Contacts

### Task FE-4.1 — Profile screen

**Tujuan:** User bisa melihat dan update profil.

**File terkait:**

- `apps/mobile/app/settings/profile.tsx`
- `apps/mobile/src/hooks/useAuth.ts`

**Langkah:**

1. Fetch current user via `GET /api/auth/me`.
2. Tampilkan:
   - full name,
   - phone,
   - email readonly.
3. Update profile via `PUT /api/auth/profile`.
4. Invalidate auth/profile query setelah update.

**Acceptance criteria:**

- Data profile tampil benar.
- Update full name/phone tersimpan.
- Loading dan error state jelas.

---

### Task FE-4.2 — Contacts list

**Tujuan:** User bisa melihat emergency contacts.

**File terkait:**

- `apps/mobile/app/settings/contacts.tsx`
- `apps/mobile/src/hooks/useContacts.ts`
- `apps/mobile/src/components/contacts/ContactListItem.tsx`

**Langkah:**

1. Fetch contacts via `GET /api/contacts`.
2. Tampilkan list contacts dengan:
   - name,
   - phone,
   - relationship,
   - primary badge.
3. Tampilkan empty state jika belum ada contact.
4. Tambahkan CTA `Add Contact`.

**Acceptance criteria:**

- Contacts tampil dari backend.
- Primary contact mudah dibedakan.
- Empty state mengarahkan user tambah contact.

---

### Task FE-4.3 — Contact create/update/delete

**Tujuan:** User bisa CRUD contact.

**File terkait:**

- `apps/mobile/app/settings/contacts.tsx`
- `apps/mobile/src/components/contacts/ContactForm.tsx`
- `apps/mobile/src/hooks/useContacts.ts`

**Langkah:**

1. Buat form contact:
   - name,
   - phone,
   - relationship,
   - isPrimary.
2. Validasi sesuai `CreateContactSchema`:
   - name wajib,
   - phone 8-20 karakter,
   - phone hanya angka, spasi, dash, plus.
3. Create via `POST /api/contacts`.
4. Update via `PUT /api/contacts/:id`.
5. Delete via `DELETE /api/contacts/:id`.
6. Set primary via `PUT /api/contacts/:id/primary`.
7. Invalidate query `['contacts']` setelah mutation sukses.

**Acceptance criteria:**

- CRUD contact berhasil.
- Hanya satu primary contact aktif.
- Delete contact meminta konfirmasi.

---

## Phase FE-5 — Permission Management

### Task FE-5.1 — Permission service

**Tujuan:** Semua permission request dikelola di satu service.

**File terkait:**

- `apps/mobile/src/services/permissions.ts`
- `apps/mobile/src/hooks/usePermissions.ts`

**Permission yang perlu dicek:**

1. Foreground location.
2. Background location.
3. Microphone.
4. Notifications.
5. Motion/accelerometer jika platform membutuhkan.

**Langkah:**

1. Buat function:
   - `checkGuardianPermissions()`,
   - `requestGuardianPermissions()`,
   - `checkNotificationPermission()`,
   - `requestNotificationPermission()`.
2. Buat hasil terstruktur:

   ```ts
   type PermissionStatus = 'granted' | 'denied' | 'undetermined'
   ```

3. Jika permission ditolak, tampilkan instruksi buka system settings.
4. Jangan block seluruh Guardian Mode jika microphone ditolak; Guardian tetap jalan tanpa keyword detection.

**Acceptance criteria:**

- User tahu permission mana yang kurang.
- Guardian bisa berjalan partial saat mic ditolak.
- SOS manual tetap tersedia walau permission mic ditolak.

---

### Task FE-5.2 — Permission UX sebelum Guardian aktif

**Tujuan:** Mengurangi kegagalan aktivasi Guardian Mode.

**File terkait:**

- `apps/mobile/app/(tabs)/guardian.tsx`
- `apps/mobile/src/components/guardian/SensorStatusList.tsx`

**Langkah:**

1. Saat user tap `Activate Guardian`, tampilkan permission checklist.
2. Request permission secara bertahap:
   - location foreground,
   - location background,
   - notification,
   - microphone.
3. Jika background location belum granted, tampilkan modal edukasi.
4. Jika user menolak permission wajib lokasi, jangan start Guardian.
5. Jika user menolak mic, start Guardian tanpa keyword detection.

**Acceptance criteria:**

- Aktivasi Guardian tidak gagal diam-diam.
- Error permission memakai bahasa user-friendly.

---

## Phase FE-6 — Guardian Mode Core

### Task FE-6.1 — Guardian store

**Tujuan:** State realtime Guardian tersedia global.

**File terkait:**

- `apps/mobile/src/stores/guardian-store.ts`

**State minimal:**

```ts
type GuardianState = {
  isActive: boolean
  startedAt: string | null
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  lastLocation: {
    latitude: number
    longitude: number
    accuracy?: number
    speed?: number | null
    heading?: number | null
  } | null
  sensorStatus: {
    gps: 'idle' | 'active' | 'error'
    microphone: 'idle' | 'active' | 'error' | 'disabled'
    accelerometer: 'idle' | 'active' | 'error'
    notification: 'idle' | 'active' | 'error'
  }
  checkIn: {
    enabled: boolean
    intervalSeconds: number
    graceSeconds: number
    nextCheckInAt: string | null
    lastCheckInAt: string | null
    missedCount: number
    status: 'idle' | 'scheduled' | 'prompting' | 'countdown' | 'triggered'
  }
  detectedKeywords: string[]
  lastSignal: string | null
}
```

**Actions minimal:**

- `setActive()`
- `setInactive()`
- `setLocation()`
- `setRiskResult()`
- `addKeyword()`
- `setSensorStatus()`
- `configureCheckIn()`
- `markCheckInSafe()`
- `markCheckInMissed()`
- `setCheckInStatus()`
- `resetGuardian()`

**Acceptance criteria:**

- Home dan Guardian screen membaca state yang sama.
- Check-in schedule tampil di Guardian screen saat Guardian aktif.
- State reset saat Guardian stop/logout.

---

### Task FE-6.2 — Risk engine service

**Tujuan:** Menghitung risiko dari multi-signal.

**File terkait:**

- `apps/mobile/src/services/risk-engine.ts`
- `packages/shared/src/constants/risk.ts`
- `packages/shared/src/constants/keywords.ts`

**Langkah:**

1. Implement `calculateRisk(signals)` memakai constants dari `@safeher/shared`.
2. Sinyal MVP yang dihitung:
   - distress keyword score,
   - accelerometer anomaly/shake,
   - phone drop/free-fall.
3. Jangan memakai perubahan speed atau perubahan lokasi sebagai risk signal MVP; lokasi dipakai untuk tracking/evidence.
4. Implement `detectAccelerometerAnomaly(x, y, z)`:
   - shake jika magnitude `> SHAKE_THRESHOLD * 9.81`,
   - drop jika magnitude `< DROP_THRESHOLD * 9.81`.
5. Cap total risk score di 100.
6. Return:
   - `totalScore`,
   - `level`,
   - `shouldTriggerCountdown`,
   - `triggerReason`,
   - `signals`.
7. Trigger countdown jika salah satu terpenuhi:
   - `totalScore >= RISK_LEVELS.CRITICAL`,
   - `keywordScore >= RISK_THRESHOLD`,
   - phone drop terdeteksi bersama accelerometer anomaly.

**Acceptance criteria:**

- Unit test manual atau dev screen bisa menunjukkan risk score naik.
- Keyword threshold, phone drop + anomaly, atau score critical membuka countdown sekali, tidak berulang-ulang selama modal aktif.
- Perubahan speed/lokasi biasa tidak menaikkan risk score.

---

### Task FE-6.3 — Location service dan foreground service

**Tujuan:** Guardian Mode menjaga GPS aktif di background dengan persistent notification.

**File terkait:**

- `apps/mobile/src/services/guardian.ts`
- `apps/mobile/src/services/location.ts`
- `apps/mobile/src/stores/guardian-store.ts`

**Langkah:**

1. Definisikan `GUARDIAN_TASK = 'guardian-location-task'`.
2. Panggil `TaskManager.defineTask(GUARDIAN_TASK, handler)` di top-level module.
3. Dalam task handler:
   - ambil lokasi terbaru,
   - update guardian store atau queue event,
   - gunakan lokasi untuk tracking, bukan sebagai sinyal utama risk scoring,
   - broadcast location jika active incident ada,
   - persist location via API jika active incident ada.
4. Implement `startGuardian()`:
   - request permission,
   - start location updates dengan:
     - accuracy high,
     - interval 5 detik,
     - distance 10 meter,
     - foreground notification title `🛡️ Guardian Active`,
     - `killServiceOnDestroy: false`.
   - start accelerometer,
   - start keyword detection,
   - schedule sticky notification.
5. Implement `stopGuardian()`:
   - stop location updates,
   - stop accelerometer,
   - stop keyword detection,
   - dismiss Guardian notification,
   - reset store.

**Acceptance criteria:**

- Saat Guardian aktif, Android menampilkan persistent notification.
- Location update tetap berjalan saat app background.
- Stop Guardian benar-benar menghentikan background update.

---

### Task FE-6.4 — Accelerometer monitoring

**Tujuan:** Deteksi guncangan kasar dan phone drop.

**File terkait:**

- `apps/mobile/src/services/accelerometer.ts`
- `apps/mobile/src/services/risk-engine.ts`
- `apps/mobile/src/stores/guardian-store.ts`

**Langkah:**

1. Gunakan `expo-sensors` Accelerometer.
2. Set sampling interval `100ms`.
3. Pada setiap update:
   - hitung magnitude,
   - deteksi shake,
   - deteksi drop/free-fall,
   - update risk signals.
4. Tambahkan debouncing agar satu guncangan tidak dihitung berkali-kali.
5. Jika `shouldTriggerCountdown`, panggil flow countdown dengan `triggerReason` dari risk engine.

**Acceptance criteria:**

- Guncangan besar menaikkan risk score.
- Free-fall/drop menaikkan risk score lebih besar.
- Listener dibersihkan saat Guardian stop.

---

### Task FE-6.5 — Keyword detection service

**Tujuan:** Mendeteksi distress keyword dari mikrofon.

**File terkait:**

- `apps/mobile/src/services/keyword.ts`
- `apps/mobile/src/services/keyword-fallback.ts`
- `packages/shared/src/constants/keywords.ts`

**Strategi MVP:**

1. Jika Picovoice access key dan `.ppn` files tersedia, gunakan Picovoice.
2. Jika belum tersedia, buat fallback service dengan interface yang sama.
3. Fallback boleh berupa:
   - `expo-speech-recognition` jika dependency disetujui,
   - atau mock/dev-only detector untuk testing UI sampai Picovoice siap.

**Langkah:**

1. Buat interface service:

   ```ts
   startKeywordDetection(onKeywordDetected: (keyword: string, score: number) => void): Promise<void>
   stopKeywordDetection(): Promise<void>
   ```

2. Cocokkan keyword dengan `DISTRESS_KEYWORDS`.
3. Saat keyword terdeteksi:
   - update `detectedKeywords`,
   - update risk signal,
   - hitung total risk,
   - trigger countdown jika `keywordScore >= RISK_THRESHOLD` atau risk engine mengembalikan `shouldTriggerCountdown`.
4. Jika init gagal, set microphone status `error` dan lanjutkan Guardian tanpa keyword detection.

**Acceptance criteria:**

- Ucapan/test keyword `tolong`, `ampun`, atau `help` menaikkan risk score saat service tersedia.
- Jika Picovoice gagal, Guardian tidak mati total.

---

### Task FE-6.6 — Notification category dan action buttons

**Tujuan:** User bisa trigger SOS/Stop dari persistent notification.

**File terkait:**

- `apps/mobile/src/services/notifications.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/src/services/sos.ts`
- `apps/mobile/src/services/guardian.ts`

**Langkah:**

1. Daftarkan notification category `guardian` dengan actions:
   - `SAFE_ACTION` → `✅ Saya aman`,
   - `SOS_ACTION` → `🚨 SOS`,
   - `STOP_ACTION` → `⬛ Stop`.
2. Tambahkan listener `addNotificationResponseReceivedListener`.
3. Jika `SAFE_ACTION`:
   - tandai check-in aman,
   - jadwalkan check-in berikutnya.
4. Jika `SOS_ACTION`:
   - buka app ke foreground,
   - trigger SOS dengan `triggerType: 'notification_button'`,
   - skip countdown karena user eksplisit menekan SOS.
5. Jika `STOP_ACTION`:
   - stop Guardian.
6. Pastikan listener tidak didaftarkan berkali-kali.

**Acceptance criteria:**

- Tombol `Saya aman` di notification memperpanjang check-in session.
- Tombol SOS di notification memicu incident.
- Tombol Stop menghentikan Guardian.
- Tidak ada duplicate action listener setelah hot reload/app reload.

---

### Task FE-6.7 — Safety check-in dan no-response escalation

**Tujuan:** Guardian Mode tetap berguna saat user freeze/tonic immobility dan tidak bisa menekan tombol, berbicara, atau menggerakkan HP.

**File terkait:**

- `apps/mobile/src/services/safety-checkin.ts`
- `apps/mobile/src/services/guardian.ts`
- `apps/mobile/src/services/sos.ts`
- `apps/mobile/src/stores/guardian-store.ts`
- `apps/mobile/src/components/guardian/SafetyCheckInCard.tsx`

**Prinsip UX:**

- User tidak diwajibkan confirm untuk mengirim SOS saat kondisi bahaya.
- User hanya perlu cancel/menjawab `Saya aman` jika ini false alarm.
- Jika user tidak merespons sampai timeout, app otomatis trigger SOS.

**Langkah:**

1. Saat `startGuardian()`, buat safety session lokal dengan config default:
   - check-in interval 5 menit,
   - grace period 60 detik,
   - countdown SOS 5 detik setelah grace period habis.
2. Tampilkan status check-in di Guardian screen:
   - next check-in time,
   - tombol `Saya aman`,
   - status missed/prompting jika user belum merespons.
3. Schedule local notification/check-in prompt dengan action:
   - `SAFE_ACTION` → tandai user aman dan jadwalkan check-in berikutnya,
   - `SOS_ACTION` → trigger SOS segera,
   - `STOP_ACTION` → stop Guardian jika user sengaja mengakhiri session.
4. Jika waktu check-in tiba:
   - tampilkan prompt/check-in card,
   - kirim haptic/notification,
   - mulai grace timer.
5. Jika user menekan `Saya aman` sebelum grace habis:
   - update `lastCheckInAt`,
   - reset `missedCount`,
   - jadwalkan check-in berikutnya.
6. Jika grace timer habis tanpa respons:
   - buka countdown modal dengan reason `no_response`,
   - jika countdown tidak dicancel, panggil `triggerSOS({ triggerType: 'no_response' })`.
7. Payload `triggerContext` untuk no-response:

   ```ts
   {
     guardianStartedAt: string
     lastCheckInAt: string | null
     missedCheckInAt: string
     escalationReason: 'missed_checkin' | 'countdown_timeout'
   }
   ```

8. Saat Guardian stop/logout/incident resolved:
   - cancel semua timer/check-in notification,
   - reset check-in state.

**Acceptance criteria:**

- Guardian menampilkan jadwal check-in berikutnya.
- User bisa menekan `Saya aman` untuk memperpanjang session.
- Missed check-in membuka countdown no-response.
- Jika countdown tidak dicancel, SOS terkirim dengan `triggerType: 'no_response'`.
- Stop Guardian membersihkan semua timer agar tidak ada false SOS setelah mode dimatikan.

---

## Phase FE-7 — Countdown dan SOS Trigger

### Task FE-7.1 — Countdown modal

**Tujuan:** Mencegah false positive sebelum auto-SOS.

**File terkait:**

- `apps/mobile/app/countdown.tsx`
- `apps/mobile/src/components/guardian/CountdownOverlay.tsx`
- `apps/mobile/src/stores/sos-store.ts`
- `apps/mobile/src/services/sos.ts`

**UI wajib:**

1. Full-screen modal warna danger.
2. Angka countdown 5 → 0.
3. Pesan jelas: `SOS akan dikirim otomatis`.
4. Tombol cancel/false alarm.
5. Tombol trigger now.
6. Haptic feedback saat countdown mulai dan tiap detik terakhir.

**Flow:**

1. Risk trigger, manual SOS, atau no-response check-in membuka modal.
2. Timer berjalan 5 detik dengan prinsip auto-send unless canceled.
3. Jika user cancel:
   - tutup modal,
   - reset temporary risk/no-response trigger,
   - Guardian tetap aktif.
4. Jika timeout:
   - panggil `triggerSOS('risk_engine' | 'keyword' | 'manual' | 'no_response')` sesuai reason.
5. Jika user tap trigger now:
   - panggil `triggerSOS()` segera.

**Acceptance criteria:**

- Countdown bisa dicancel.
- Timeout otomatis trigger SOS, termasuk no-response saat user tidak merespons.
- Tidak ada multiple SOS jika user tap berkali-kali.

---

### Task FE-7.2 — SOS store

**Tujuan:** State active incident dan progress SOS tersedia global.

**File terkait:**

- `apps/mobile/src/stores/sos-store.ts`

**State minimal:**

```ts
type SOSState = {
  activeIncidentId: string | null
  isTriggering: boolean
  isRecordingAudio: boolean
  isUploadingAudio: boolean
  isAnalyzingAI: boolean
  contactsNotified: number | null
  lastError: string | null
  startedAt: string | null
}
```

**Acceptance criteria:**

- Screen `sos` bisa menampilkan progress dari state.
- Active incident id dipakai oleh audio upload dan live tracking.

---

### Task FE-7.3 — SOS trigger service

**Tujuan:** Satu function untuk semua sumber SOS.

**File terkait:**

- `apps/mobile/src/services/sos.ts`
- `apps/mobile/src/services/location.ts`
- `apps/mobile/src/services/audio.ts`
- `apps/mobile/src/services/live-tracking.ts`
- `apps/mobile/src/services/offline-queue.ts`

**Input:**

```ts
type TriggerSOSOptions = {
  triggerType: 'manual' | 'keyword' | 'risk_engine' | 'notification_button' | 'no_response'
  riskScore?: number
  keywordsDetected?: string[]
  triggerContext?: {
    guardianStartedAt?: string
    lastCheckInAt?: string | null
    missedCheckInAt?: string
    escalationReason?: 'missed_checkin' | 'countdown_timeout'
  }
  skipCountdown?: boolean
}
```

**Langkah:**

1. Prevent duplicate trigger jika `isTriggering` atau `activeIncidentId` sudah ada.
2. Ambil last known location dari store.
3. Jika belum ada, request current position.
4. Jika GPS gagal, tetap coba pakai low accuracy fallback jika tersedia.
5. Panggil `POST /api/sos/trigger` dengan payload valid.
6. Jika online dan sukses:
   - simpan `incident.id` ke `sos-store`,
   - set `contactsNotified`,
   - buka modal/screen `sos`,
   - start audio recording 15 detik,
   - start live broadcast `tracking:{incidentId}`,
   - persist route history.
7. Jika offline:
   - queue request ke offline queue,
   - simpan local pending SOS id,
   - tetap rekam audio lokal,
   - tampilkan status `Pending upload saat online`.
8. Jika request gagal server-side:
   - tampilkan error,
   - jangan hapus audio/lokasi lokal.

**Acceptance criteria:**

- Manual SOS membuat incident di backend.
- Auto SOS dari countdown memakai payload risk/keywords atau `triggerType: 'no_response'`.
- SOS tidak bisa double-created karena double tap.
- Offline request masuk queue.

---

### Task FE-7.4 — SOS active screen

**Tujuan:** User melihat status proses darurat.

**File terkait:**

- `apps/mobile/app/sos.tsx`
- `apps/mobile/src/components/sos/SOSStatusTimeline.tsx`
- `apps/mobile/src/components/sos/AudioRecordingStatus.tsx`

**UI wajib:**

1. Status incident active.
2. Checklist progress:
   - location sent,
   - emergency contacts notified,
   - audio recording,
   - audio uploading,
   - AI analyzing,
   - live tracking active.
3. Current location summary.
4. Tombol `Resolve`.
5. Tombol `False Alarm`.
6. Warning: jangan tutup app jika belum aman.

**Acceptance criteria:**

- Screen muncul setelah SOS triggered.
- Progress berubah sesuai state.
- User bisa resolve atau mark false alarm.

---

### Task FE-7.5 — Resolve / false alarm

**Tujuan:** User bisa mengakhiri incident dengan status benar.

**File terkait:**

- `apps/mobile/app/sos.tsx`
- `apps/mobile/src/services/sos.ts`
- `apps/mobile/src/services/live-tracking.ts`
- `apps/mobile/src/stores/sos-store.ts`

**Langkah:**

1. Tambahkan confirmation modal.
2. Untuk MVP, gunakan confirm button. Jika security PIN sudah ada, wajib input PIN.
3. Panggil `PUT /api/sos/:id/resolve` dengan:

   ```ts
   { resolution: 'resolved' | 'false_alarm', notes?: string }
   ```

4. Stop live broadcast.
5. Stop active SOS state.
6. Invalidate incidents query.
7. Jika Guardian masih dibutuhkan, user boleh tetap mengaktifkannya; jika tidak, stop Guardian.

**Acceptance criteria:**

- Incident status berubah menjadi `resolved` atau `false_alarm`.
- Live tracking berhenti setelah resolve.
- Family menerima update dari backend jika fitur push sudah siap.

---

## Phase FE-8 — Audio Recording dan AI Upload

### Task FE-8.1 — Audio recording service

**Tujuan:** Rekam audio lingkungan selama 15 detik setelah SOS.

**File terkait:**

- `apps/mobile/src/services/audio.ts`
- `apps/mobile/src/stores/sos-store.ts`

**Langkah:**

1. Request microphone permission jika belum granted.
2. Jika permission denied:
   - update status `microphone disabled`,
   - jangan gagalkan SOS.
3. Mulai recording setelah incident dibuat.
4. Durasi recording: `AUDIO_RECORD_SECONDS = 15`.
5. Simpan file lokal dengan format `.m4a` jika tersedia.
6. Return metadata:
   - `uri`,
   - `duration`,
   - `mimeType`,
   - `size` jika bisa diakses.
7. Batasi upload max 10MB.

**Acceptance criteria:**

- Recording dimulai otomatis setelah SOS.
- Recording berhenti otomatis setelah 15 detik.
- File URI tersedia untuk upload.
- SOS tetap lanjut tanpa audio jika mic ditolak.

---

### Task FE-8.2 — Audio upload service

**Tujuan:** Upload audio ke backend untuk storage dan AI analysis.

**File terkait:**

- `apps/mobile/src/services/audio.ts`
- `apps/mobile/src/services/sos.ts`
- `apps/mobile/src/hooks/useIncidents.ts`

**Langkah:**

1. Buat `FormData` berisi file audio.
2. Panggil `POST /api/sos/:id/audio`.
3. Jangan set `Content-Type: application/json` untuk multipart.
4. Saat response sukses:
   - update incident cache,
   - tampilkan transcript/AI summary jika screen masih aktif,
   - invalidate `['incidents']` dan `['incidents', id]`.
5. Jika offline atau upload gagal:
   - queue upload,
   - simpan file URI lokal,
   - retry saat online.
6. Jika file terlalu besar:
   - tampilkan error `Audio terlalu besar. Maksimal 10MB.`

**Acceptance criteria:**

- Audio upload sukses mengembalikan updated incident.
- AI summary muncul di incident detail setelah tersedia.
- Upload failure tidak menghapus file lokal.

---

## Phase FE-9 — Live Tracking

### Task FE-9.1 — Live broadcast sender

**Tujuan:** HP korban mengirim lokasi realtime ke channel incident.

**File terkait:**

- `apps/mobile/src/services/live-tracking.ts`
- `apps/mobile/src/services/location.ts`
- `apps/mobile/src/services/guardian.ts`

**Langkah:**

1. Buat `startLiveBroadcast(incidentId, userId)`.
2. Subscribe ke Supabase channel `tracking:{incidentId}`.
3. Buat `broadcastLocation(incidentId, userId, coords)` dengan payload:

   ```ts
   {
     userId,
     incidentId,
     latitude,
     longitude,
     speed,
     heading,
     accuracy,
     timestamp
   }
   ```

4. Panggil broadcast setiap ada location update saat incident aktif.
5. Panggil `POST /api/tracking/location` secara berkala untuk persist history.
6. Jika realtime disconnect:
   - buffer lokasi lokal,
   - flush saat reconnect.
7. Buat `stopLiveBroadcast()` saat incident resolved.

**Acceptance criteria:**

- Channel `tracking:{incidentId}` mengirim event `location-update`.
- Location history tetap tersimpan via REST.
- Broadcast berhenti setelah incident resolve.

---

### Task FE-9.2 — Live tracking receiver hook

**Tujuan:** Family/tracking screen menerima posisi realtime.

**File terkait:**

- `apps/mobile/src/hooks/useLiveTracking.ts`

**Langkah:**

1. Subscribe ke channel `tracking:{incidentId}`.
2. Listen event broadcast `location-update`.
3. Simpan:
   - `currentLocation`,
   - `locationHistory`.
4. Remove channel saat unmount.
5. Tambahkan fallback initial route dari `GET /api/incidents/:id/locations` jika tersedia.

**Acceptance criteria:**

- Hook mengembalikan current location terbaru.
- History bertambah setiap event masuk.
- Unsubscribe bersih saat keluar screen.

---

### Task FE-9.3 — Live tracking screen

**Tujuan:** Kontak keluarga bisa melihat lokasi korban bergerak di map.

**File terkait:**

- `apps/mobile/app/tracking/[incidentId].tsx`
- `apps/mobile/src/components/maps/LiveMap.tsx`
- `apps/mobile/src/hooks/useLiveTracking.ts`
- `apps/mobile/src/hooks/useIncidents.ts`

**UI wajib:**

1. Map dengan marker korban.
2. Polyline route history.
3. Incident status.
4. User/victim info jika tersedia.
5. AI summary jika sudah tersedia.
6. Last updated timestamp.
7. Button buka Google Maps/Maps app ke koordinat terbaru.

**Deep link:**

- Notification dari backend sebaiknya membuka:

  ```txt
  safeher://tracking/{incidentId}
  ```

**Acceptance criteria:**

- Marker bergerak saat sender broadcast lokasi.
- Jika belum ada event, screen menunjukkan waiting state.
- Deep link membuka tracking screen.

---

## Phase FE-10 — Incident History dan Detail

### Task FE-10.1 — Incident list

**Tujuan:** User bisa melihat riwayat insiden.

**File terkait:**

- `apps/mobile/app/incidents/index.tsx`
- `apps/mobile/src/hooks/useIncidents.ts`
- `apps/mobile/src/components/incidents/IncidentCard.tsx`

**Langkah:**

1. Fetch `GET /api/incidents`.
2. Tampilkan filter status jika sempat:
   - all,
   - active,
   - resolved,
   - false alarm.
3. Set pagination/infinite scroll optional.
4. Tiap card menampilkan:
   - status,
   - trigger type,
   - risk score,
   - classification,
   - waktu kejadian,
   - lokasi singkat.
5. Tap card membuka `incidents/[id]`.

**Acceptance criteria:**

- List incident tampil.
- Empty state jelas.
- Pull-to-refresh bekerja.

---

### Task FE-10.2 — Incident detail

**Tujuan:** User bisa melihat hasil AI, transcript, audio, dan route.

**File terkait:**

- `apps/mobile/app/incidents/[id].tsx`
- `apps/mobile/src/components/incidents/AISummaryCard.tsx`
- `apps/mobile/src/components/maps/RouteMap.tsx`
- `apps/mobile/src/hooks/useIncidents.ts`

**UI wajib:**

1. Incident status.
2. Trigger type.
3. Created at/resolved at.
4. Risk score.
5. Classification.
6. AI summary:
   - risk,
   - classification,
   - recommendation,
   - confidence,
   - summary,
   - detected keywords.
7. Transcript.
8. Audio playback jika `audioUrl` tersedia.
9. Map lokasi awal dan route history.
10. Resolution notes jika ada.

**Acceptance criteria:**

- Detail incident tampil lengkap.
- Jika AI summary belum ada, tampilkan status `AI analysis pending`.
- Audio playback tidak crash jika file belum tersedia.

---

## Phase FE-11 — Offline Queue dan Network Handling

### Task FE-11.1 — Network status store

**Tujuan:** App tahu status online/offline.

**File terkait:**

- `apps/mobile/src/stores/network-store.ts`
- `apps/mobile/src/hooks/useNetworkStatus.ts`

**Langkah:**

1. Gunakan NetInfo jika dependency ditambahkan.
2. Simpan:
   - `isConnected`,
   - `isInternetReachable`,
   - `lastOnlineAt`.
3. Tampilkan offline banner global jika offline.

**Acceptance criteria:**

- App menampilkan banner saat offline.
- Queue processor dipanggil saat online kembali.

---

### Task FE-11.2 — Offline request queue

**Tujuan:** SOS, tracking, dan audio upload tidak hilang saat offline.

**File terkait:**

- `apps/mobile/src/services/offline-queue.ts`

**Queue item minimal:**

```ts
type QueuedRequest = {
  id: string
  type: 'sos_trigger' | 'audio_upload' | 'tracking_location' | 'tracking_batch'
  endpoint: string
  method: 'POST' | 'PUT'
  body?: unknown
  fileUri?: string
  incidentId?: string
  timestamp: string
  retryCount: number
}
```

**Langkah:**

1. Simpan queue di local storage.
2. Tambahkan `queueRequest()`.
3. Tambahkan `processQueue()`.
4. Batasi retry dan simpan item yang masih gagal.
5. Untuk audio upload, pastikan file URI masih valid sebelum retry.
6. Untuk tracking, batch lokasi agar hemat request.

**Acceptance criteria:**

- SOS saat offline masuk queue.
- Saat online, request terkirim otomatis.
- Queue gagal tidak hilang diam-diam.

---

### Task FE-11.3 — Error handling matrix frontend

**Tujuan:** Semua edge case safety punya perilaku jelas.

| Scenario | Expected behavior |
| --- | --- |
| GPS unavailable | Tampilkan warning low accuracy, SOS tetap bisa dikirim jika ada last known location. |
| No internet | Queue SOS/audio/location, retry saat online. |
| Missed safety check-in | Buka no-response countdown; jika timeout, trigger SOS dengan `triggerType: 'no_response'`. |
| Microphone denied | Guardian tetap aktif tanpa keyword detection. |
| Background task error | Log error, update sensor status, minta user restart Guardian jika perlu. |
| Picovoice init failed | Fallback service atau disable keyword detection. |
| Supabase Realtime disconnected | Buffer lokasi dan batch-send saat reconnect. |
| API 401 | Refresh token atau logout jika refresh gagal. |
| API 413 audio | Tampilkan pesan file audio terlalu besar. |
| API 500 | Tampilkan generic error dan retry jika aman. |

**Acceptance criteria:**

- Tidak ada error teknis mentah tampil ke user.
- SOS manual tetap menjadi prioritas di semua edge case.

---

## Phase FE-12 — Push Notification dan Deep Linking

### Task FE-12.1 — Notification setup

**Tujuan:** App siap menerima push notification dari backend.

**File terkait:**

- `apps/mobile/src/services/notifications.ts`
- `apps/mobile/app/_layout.tsx`

**Langkah:**

1. Request notification permission.
2. Ambil Expo/FCM push token sesuai strategi backend.
3. Kirim token ke backend/profile jika endpoint sudah tersedia.
4. Set notification handler foreground.
5. Handle notification tap:
   - emergency alert → `tracking/[incidentId]`,
   - no-response alert → `tracking/[incidentId]`,
   - AI summary update → `incidents/[id]` atau `tracking/[incidentId]`,
   - resolved update → detail incident.

**Acceptance criteria:**

- App menerima notification saat foreground/background.
- Tap notification membuka screen yang sesuai.

---

### Task FE-12.2 — Deep link routing

**Tujuan:** Link dari push notification membuka screen target.

**File terkait:**

- `apps/mobile/app.json`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/tracking/[incidentId].tsx`

**Langkah:**

1. Pastikan scheme `safeher` aktif.
2. Support link:

   ```txt
   safeher://tracking/{incidentId}
   safeher://incidents/{incidentId}
   safeher://sos/{incidentId}
   ```

3. Test dengan Expo linking command atau adb intent.
4. Jika user belum login, simpan pending link lalu redirect setelah login.

**Acceptance criteria:**

- Deep link tracking membuka map screen.
- Pending link tidak hilang saat user perlu login dulu.

---

## Phase FE-13 — Android Device Testing

### Task FE-13.1 — Development build Android

**Tujuan:** Test fitur native yang tidak cukup dengan Expo Go.

**File terkait:**

- `apps/mobile/app.json`
- native project hasil prebuild jika ada

**Langkah:**

1. Jalankan `expo prebuild` atau script monorepo `moon run mobile:prebuild`.
2. Build dan install ke device Android fisik.
3. Jangan hanya mengandalkan emulator untuk background location/mic.
4. Test permission flow dari fresh install.

**Acceptance criteria:**

- APK/dev build terinstall di HP Android.
- Background location dan notification berjalan di real device.

---

### Task FE-13.2 — Manual verification flow utama

**Tujuan:** Pastikan workflow dari `flowchart.md` berjalan end-to-end.

**Checklist:**

- [ ] Register user baru.
- [ ] Login.
- [ ] Tambah minimal 1 emergency contact.
- [ ] Buka Guardian tab.
- [ ] Grant foreground location.
- [ ] Grant background location.
- [ ] Grant notification permission.
- [ ] Grant microphone permission.
- [ ] Activate Guardian.
- [ ] Persistent notification muncul.
- [ ] Jadwal safety check-in tampil.
- [ ] Tombol `Saya aman` memperpanjang check-in session.
- [ ] Missed check-in membuka countdown no-response.
- [ ] Cancel no-response countdown berhasil.
- [ ] GPS status active.
- [ ] Accelerometer status active.
- [ ] Keyword/mic status active atau disabled dengan alasan jelas.
- [ ] Goyang/drop HP menaikkan risk score.
- [ ] Trigger manual SOS dari Home.
- [ ] Countdown muncul 5 detik.
- [ ] Cancel countdown berhasil.
- [ ] Trigger manual SOS ulang sampai timeout.
- [ ] Incident dibuat di backend.
- [ ] Ulangi missed check-in sampai timeout dan pastikan incident dibuat dengan `triggerType: 'no_response'`.
- [ ] SOS active screen muncul.
- [ ] Audio recording berjalan 15 detik.
- [ ] Audio upload terkirim.
- [ ] AI summary muncul setelah backend selesai.
- [ ] Live tracking channel aktif.
- [ ] Buka tracking screen dan marker bergerak.
- [ ] Resolve incident.
- [ ] Live tracking berhenti.
- [ ] Incident muncul di history.

---

### Task FE-13.3 — Offline verification

**Tujuan:** Pastikan safety flow tidak rusak saat internet mati.

**Checklist:**

- [ ] Login saat online terlebih dahulu.
- [ ] Matikan internet.
- [ ] Activate Guardian.
- [ ] Trigger SOS manual.
- [ ] App menampilkan status pending/offline.
- [ ] Simulasikan missed check-in dan pastikan `no_response` SOS masuk queue saat offline.
- [ ] Audio tetap direkam lokal jika permission ada.
- [ ] Location update masuk buffer.
- [ ] Nyalakan internet.
- [ ] Queue terkirim otomatis.
- [ ] Incident muncul di backend/history setelah sync.

---

# 9. Urutan Eksekusi yang Direkomendasikan

Gunakan urutan ini agar frontend bisa progres walau backend belum 100% selesai.

## Sprint 1 — App Foundation

1. Setup `apps/mobile/package.json`, `app.json`, env, NativeWind.
2. Setup Expo Router root layout.
3. Setup Supabase client.
4. Setup API client.
5. Setup QueryClient.
6. Setup design system basic.

**Output:** app bisa start, route dasar tersedia, env terbaca.

---

## Sprint 2 — Auth dan Main UI

1. Login screen.
2. Register screen.
3. Auth guard.
4. Main tabs.
5. Home dashboard skeleton.
6. Settings skeleton.

**Output:** user bisa auth dan masuk ke dashboard.

---

## Sprint 3 — Contacts dan Profile

1. Profile screen.
2. Contacts list.
3. Contact create/update/delete.
4. Set primary contact.
5. Empty/loading/error states.

**Output:** user bisa mengatur emergency contacts.

---

## Sprint 4 — Guardian Mode MVP

1. Permission service.
2. Guardian store.
3. Location foreground/background task.
4. Persistent notification.
5. Accelerometer monitoring.
6. Risk engine.
7. Safety check-in/no-response service.
8. Guardian UI realtime.

**Output:** Guardian bisa aktif, GPS/sensor berjalan, risk score berubah, dan missed check-in bisa membuka countdown.

---

## Sprint 5 — Countdown dan SOS Trigger

1. Countdown modal.
2. SOS store.
3. Trigger SOS service.
4. Manual SOS button.
5. Notification action Safe/SOS/Stop.
6. SOS active screen.
7. Resolve/false alarm.

**Output:** incident bisa dibuat dan diselesaikan.

---

## Sprint 6 — Audio dan AI Result

1. Audio recording 15 detik.
2. Audio upload multipart.
3. Incident detail AI summary.
4. Audio/transcript UI.
5. Retry/queue jika upload gagal.

**Output:** audio terkirim ke backend dan hasil AI tampil.

---

## Sprint 7 — Live Tracking

1. Live broadcast sender.
2. Live tracking receiver hook.
3. Tracking map screen.
4. Route history persist.
5. Deep link dari notification.

**Output:** family/tracking screen melihat lokasi realtime.

---

## Sprint 8 — Offline, Polish, Device QA

1. Network status.
2. Offline queue.
3. Edge case permission denied.
4. UI polish.
5. Android physical device test.
6. APK/dev build untuk demo.

**Output:** MVP siap demo end-to-end.

---

# 10. Dependency antar Task

```mermaid
flowchart TD
    A[FE-0 Setup] --> B[FE-1 Providers and Clients]
    B --> C[FE-2 Auth]
    C --> D[FE-3 Main Screens]
    C --> E[FE-4 Contacts and Profile]
    D --> F[FE-5 Permissions]
    F --> G[FE-6 Guardian Mode]
    G --> H[FE-7 Countdown and SOS]
    H --> I[FE-8 Audio and AI Upload]
    H --> J[FE-9 Live Tracking]
    E --> H
    I --> K[FE-10 Incident History]
    J --> K
    H --> L[FE-11 Offline Queue]
    J --> M[FE-12 Push and Deep Link]
    L --> N[FE-13 Android QA]
    M --> N
    K --> N
```

---

# 11. Definition of Done Frontend MVP

Frontend dianggap selesai untuk MVP jika semua kondisi berikut terpenuhi:

## App & Auth

- [ ] App berjalan di Android physical device.
- [ ] User bisa register, login, logout.
- [ ] Session persist setelah app restart.
- [ ] Protected routes tidak bisa dibuka tanpa login.

## Contacts

- [ ] User bisa CRUD emergency contacts.
- [ ] User bisa set primary contact.
- [ ] Empty/loading/error state tersedia.

## Guardian Mode

- [ ] User bisa activate/stop Guardian.
- [ ] Persistent notification muncul saat Guardian aktif.
- [ ] Background location update berjalan.
- [ ] Accelerometer monitoring berjalan.
- [ ] Keyword detection berjalan atau gracefully disabled.
- [ ] Risk score dihitung dan tampil di UI.
- [ ] Risk critical/keyword threshold/phone drop membuka countdown.
- [ ] Safety check-in berjalan saat Guardian aktif.
- [ ] Missed check-in membuka countdown no-response.

## SOS

- [ ] Manual SOS dari Home/Guardian bekerja.
- [ ] SOS dari notification action bekerja.
- [ ] Countdown 5 detik bisa cancel.
- [ ] Timeout countdown membuat incident.
- [ ] Timeout no-response countdown membuat incident dengan `triggerType: 'no_response'`.
- [ ] Active SOS screen menampilkan progress.
- [ ] Resolve dan false alarm bekerja.

## Audio & AI

- [ ] Audio direkam 15 detik setelah SOS.
- [ ] Audio diupload ke backend.
- [ ] AI summary/transcript tampil di incident detail jika tersedia.
- [ ] Upload gagal masuk retry/queue.

## Live Tracking

- [ ] Sender broadcast lokasi ke `tracking:{incidentId}`.
- [ ] Receiver menerima update realtime.
- [ ] Map menampilkan marker dan route.
- [ ] Tracking berhenti setelah incident resolved.

## Offline & Error Handling

- [ ] SOS saat offline masuk queue.
- [ ] Queue diproses saat online kembali.
- [ ] GPS unavailable tidak crash.
- [ ] Mic denied tidak mematikan Guardian.
- [ ] Realtime disconnect tidak menghilangkan lokasi buffered.

## QA

- [ ] `typecheck` mobile lulus.
- [ ] Manual verification checklist utama lulus.
- [ ] Offline verification lulus minimal untuk SOS trigger, no-response queue, dan audio queue.
- [ ] APK/dev build bisa dipakai demo.

---

# 12. Catatan Koordinasi dengan Backend Developer

Frontend membutuhkan keputusan/konfirmasi berikut dari backend:

1. Auth source of truth:
   - login/register lewat backend Hono,
   - atau langsung Supabase Auth dari mobile dengan backend menerima Supabase JWT.
2. Format final response semua endpoint.
3. Endpoint untuk menyimpan FCM/Expo push token profile.
4. Format payload push notification:
   - `incidentId`,
   - `type`,
   - `trackingUrl` atau deep link.
5. Apakah family tracking screen butuh auth atau bisa memakai signed/public tracking token.
6. Export type Hono app jika frontend memakai Hono RPC typed client.
7. Batas rate limit SOS agar frontend bisa menampilkan pesan yang tepat.
8. Konfirmasi backend menerima `triggerType: 'no_response'` dan optional `triggerContext` pada `POST /api/sos/trigger`.
9. Format audio file yang paling aman untuk Gemini/backend:
   - `.m4a`,
   - `.wav`,
   - `.webm`.

Jika backend belum siap, frontend boleh memakai mock API layer sementara selama interface `src/lib/api.ts` tidak berubah.

---

# 13. Risiko Teknis Frontend

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Expo background microphone terbatas | Keyword detection tidak stabil | Prioritaskan Picovoice native/dev build, fallback manual SOS + accelerometer. |
| Android membunuh background task | Guardian berhenti | Gunakan foreground service notification, edukasi battery optimization. |
| Permission background location ditolak | Live tracking tidak jalan di background | Tampilkan permission education screen dan fallback foreground-only. |
| Audio file terlalu besar | Upload gagal | Rekam 15 detik, kompres/format `.m4a`, validasi max 10MB. |
| Supabase Realtime disconnect | Family tidak melihat lokasi terbaru | Buffer location dan persist via REST batch. |
| Double tap SOS | Incident dobel | Lock dengan `isTriggering` dan `activeIncidentId`. |
| User freeze/tonic immobility | User tidak bisa tekan SOS/bicara | Safety check-in/no-response escalation dengan auto-send unless canceled. |
| App dimatikan saat Guardian aktif | Check-in timer bisa gagal | Foreground service notification, edukasi battery optimization, dan post-MVP server-side watchdog. |
| Backend belum siap | Frontend terblokir | Mock API client dengan contract sama. |

---

# 14. Bonus / Post-MVP

Kerjakan setelah MVP stabil:

1. Android Quick Settings Tile untuk one-tap SOS.
2. PIN keamanan untuk cancel/resolve false alarm.
3. Battery optimization warning screen.
4. Server-side Guardian watchdog/heartbeat jika app dibunuh OS saat safety session aktif.
5. Geofencing safe/unsafe zones.
6. Route anomaly detection yang lebih akurat.
7. Family app role khusus.
8. Share live tracking link via WhatsApp/SMS.
9. Local encrypted storage untuk offline audio.
10. E2E test dengan Detox/Maestro.
11. EAS build pipeline.
