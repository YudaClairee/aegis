# SafeHer Integration Check: `apps/mobile` ↔ `apps/api`

Tanggal pengecekan: 2026-07-16

## Verdict

`apps/mobile` dan `apps/api` **sudah punya fondasi integrasi**: mobile memakai `EXPO_PUBLIC_API_URL` untuk memanggil endpoint API, API memakai Supabase JWT dari mobile, shared types/validators dipakai di kedua sisi, dan endpoint utama seperti contacts, incidents, SOS, upload audio, tracking, profile, serta push token sudah tersedia.

Namun project **belum sepenuhnya siap untuk end-to-end testing** tanpa perbaikan/konfigurasi tambahan. Ada beberapa mismatch schema/config dan beberapa flow frontend yang belum tersambung ke endpoint backend.

## Validasi yang sudah dijalankan

Command yang berhasil:

```bash
pnpm --filter @aegis/api typecheck
pnpm --filter @aegis/mobile typecheck
pnpm --filter @aegis/shared typecheck
pnpm --filter @aegis/api build
pnpm --filter @aegis/api test
```

Hasil:

- Typecheck API/mobile/shared: pass.
- Build API: pass.
- API unit tests: 6 files / 18 tests pass.

Catatan: API unit tests memakai mock Supabase/AI, jadi tidak membuktikan schema Supabase production/local sudah cocok.

---

## Blocking / perlu diperbaiki sebelum E2E test

### 1. Migration Supabase belum punya kolom `incidents.trigger_context`

**Dampak:** `POST /api/sos/trigger` berpotensi gagal saat insert incident ke Supabase real database.

Evidence:

- API selalu insert `trigger_context` di `apps/api/src/routes/sos.ts`.
- Shared schema dan dokumen memang mendukung `triggerContext`.
- `supabase/migrations/001_initial_schema.sql` belum menambahkan kolom `trigger_context` pada tabel `incidents`.
- `supabase/migrations/002_add_no_response_trigger.sql` hanya memperbaiki constraint `trigger_type`, belum menambah kolom `trigger_context`.

Fix yang disarankan: tambah migration baru, misalnya `003_add_incident_trigger_context.sql`:

```sql
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS trigger_context JSONB DEFAULT '{}'::jsonb;
```

Tambahan opsional: update mapper response API agar mobile bisa menerima konteks ini:

- `apps/api/src/routes/sos.ts` → `mapIncidentRow()` tambahkan `triggerContext: row.trigger_context || null`.
- `apps/api/src/routes/incidents.ts` → `mapIncidentRow()` tambahkan field yang sama.

---

### 2. Env mobile belum tersedia di repo

**Dampak:** mobile tidak bisa konek ke API/Supabase jika env belum dibuat secara manual.

Evidence:

- `apps/mobile/src/lib/env.ts` membutuhkan:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Tidak ditemukan `apps/mobile/.env` atau `apps/mobile/.env.example`.

Fix yang disarankan: buat `apps/mobile/.env.example`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Untuk testing device/emulator, jangan asal pakai `localhost`:

- Android emulator biasanya perlu `http://10.0.2.2:3000`.
- Physical device perlu IP LAN host atau tunnel seperti ngrok/cloudflared.
- Nilai Supabase URL/anon key mobile harus project yang sama dengan API.

---

### 3. Live tracking sender belum tersambung ke flow Guardian/SOS

**Dampak:** keluarga bisa membuka screen tracking, tetapi lokasi realtime/history tidak akan terisi otomatis dari korban setelah SOS.

Evidence:

- `apps/mobile/src/services/live-tracking.ts` punya fungsi:
  - `startLiveBroadcast()`
  - `broadcastLocation()`
  - `persistLocationHistory()`
- Tetapi pencarian call site hanya menemukan definisi fungsi; belum dipanggil dari Guardian/SOS flow.
- Background location task di `apps/mobile/src/services/guardian.ts` hanya memanggil `setLocation()` ke Zustand store.
- Setelah `triggerSOS`, `apps/mobile/src/stores/guardian-store.ts` hanya menjalankan `startRecordingSession()` dan navigasi ke incident detail.

Fix yang disarankan:

1. Simpan `activeIncidentId` setelah `POST /api/sos/trigger` berhasil.
2. Saat background location task menerima lokasi baru dan ada `activeIncidentId`:
   - panggil `broadcastLocation(activeIncidentId, userId, coords)` untuk Supabase Realtime;
   - panggil `persistLocationHistory(activeIncidentId, coords)` untuk `POST /api/tracking/location`.
3. Stop broadcast/tracking saat incident resolved/false alarm atau Guardian dihentikan.

---

## Major integration gaps

### 4. Contact linking API belum dipakai oleh mobile

**Dampak:** flow end-to-end notifikasi keluarga dan family tracking belum bisa dites dari UI mobile tanpa setup manual.

Evidence:

- API punya route `apps/api/src/routes/contact-links.ts`:
  - `POST /api/contact-links/:contactId/invite`
  - `POST /api/contact-links/accept`
  - `GET /api/contact-links/me`
  - `DELETE /api/contact-links/:contactId`
- Mobile tidak punya call ke `contact-links`, `inviteCode`, atau `accept`.
- `apps/api/src/services/fcm.ts` hanya fetch token dari emergency contacts yang `invite_status = 'accepted'` dan punya `linked_user_id`.

Fix yang disarankan:

- Di UI contacts, tambahkan action generate invite code untuk owner contact.
- Tambahkan screen/form accept invite code untuk family user.
- Tambahkan list linked victims untuk family user bila perlu.
- Untuk testing sementara, link contact bisa dibuat via API manual/Postman atau langsung DB, tapi itu belum E2E dari mobile.

---

### 5. Deep link push notification mismatch dengan Expo scheme

**Dampak:** tap push notification mungkin tidak membuka screen tracking yang benar.

Evidence:

- `apps/mobile/app.json` memakai scheme `aegis`.
- `apps/api/src/services/fcm.ts` mengirim `deepLink: safeher://tracking/{incidentId}`.

Fix yang disarankan: pilih salah satu dan konsisten.

Opsi A, ubah API deep link ke scheme mobile saat ini:

```ts
deepLink: `aegis://tracking/${params.incidentId}`
```

Opsi B, ubah `apps/mobile/app.json` scheme menjadi `safeher`, lalu pastikan routing `tracking/[incidentId]` tetap benar.

---

### 6. Auth flow mobile tidak memakai endpoint auth API

**Dampak:** secara token masih bisa jalan, tapi kontrak frontend/backend tidak konsisten.

Evidence:

- API menyediakan:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/auth/refresh`
- Mobile `AuthProvider` memakai Supabase langsung:
  - `supabase.auth.signUp()`
  - `supabase.auth.signInWithPassword()`
  - `supabase.auth.signOut()`
- `POST /api/auth/register` membutuhkan `fullName`, tetapi UI register mobile hanya meminta email dan password.

Ini tidak selalu blocking karena API middleware memang menerima Supabase access token dari mobile. Tetapi untuk testing kontrak API auth dari mobile, flow ini belum terintegrasi.

Fix yang disarankan: tentukan strategi auth.

- Jika ingin auth via backend: update mobile untuk call `/api/auth/register` dan `/api/auth/login`, tambahkan input `fullName` di register, simpan/session-kan token sesuai kebutuhan.
- Jika ingin auth direct Supabase: dokumentasikan bahwa endpoint auth API hanya optional/admin compatibility, dan pastikan profile default `User` memang diterima sampai user update profile.

---

### 7. Audio storage bucket private tetapi API mengembalikan public URL

**Dampak:** `audioUrl` yang dikembalikan API kemungkinan tidak bisa dibuka oleh mobile/family jika bucket tetap private.

Evidence:

- Migration membuat bucket `incident-audio` dengan `public = false`.
- API upload audio memakai `getPublicUrl(filePath)`.

Fix yang disarankan:

- Jika audio boleh public: ubah bucket menjadi public secara eksplisit dan pertimbangkan privacy risk.
- Jika audio harus private: jangan pakai `getPublicUrl`; buat signed URL via Supabase Storage `createSignedUrl()` saat user yang authorized meminta detail incident.

---

## Non-blocking / polish sebelum testing luas

### 8. Offline queue belum dipakai saat request gagal

`processQueue()` sudah dipanggil saat reconnect melalui `network-store`, tetapi `queueRequest()` belum dipanggil dari flow SOS/audio/tracking. Jadi saat offline, request utama masih langsung gagal dan tidak otomatis masuk queue.

Fix: wrap `triggerSOS`, `uploadIncidentAudio`, dan tracking persist agar queue request saat offline/network error.

### 9. CORS `origin: '*'` + `credentials: true`

Untuk React Native native runtime ini biasanya tidak blocking. Namun untuk web/browser testing, kombinasi wildcard origin dan credentials tidak valid. Jika akan testing dari web, set origin eksplisit atau matikan credentials.

### 10. Default OpenRouter model tidak konsisten dengan dokumen

- `apps/api/src/lib/env.ts` default: `google/gemini-3-flash-preview`.
- `backend.md` contoh/default: `google/gemini-2.5-flash`.

Fix: samakan default code, `.env.example`, dan dokumentasi.

---

## Checklist minimal sebelum E2E test

1. Tambahkan migration `trigger_context` dan apply ke Supabase local/remote.
2. Pastikan API `.env` berisi env wajib:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENROUTER_API_KEY`
   - Firebase Admin env
3. Buat `apps/mobile/.env` dengan API URL yang reachable dari device/emulator.
4. Samakan Supabase project antara API dan mobile.
5. Wire live tracking sender ke Guardian/SOS flow.
6. Tambahkan UI/call contact invite + accept, atau siapkan link accepted manual untuk testing notifikasi keluarga.
7. Samakan deep link scheme API dan mobile.
8. Jalankan smoke test:
   - login/register;
   - update profile;
   - CRUD contacts;
   - generate/accept contact link;
   - register push token;
   - trigger SOS;
   - upload audio;
   - persist/broadcast location;
   - family user buka incident/tracking;
   - resolve/false alarm.
