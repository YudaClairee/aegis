# SafeHer — Backend Implementation Guide (Step-by-Step)

Panduan implementasi backend SafeHer untuk `apps/api` dan `packages/shared`, disusun sebagai task step-by-step untuk backend developer.

Dokumen ini berdasarkan:

- [`implementation.md`](./implementation.md)
- [`flowchart.md`](./flowchart.md)
- Keputusan teknis tambahan:
  - AI backend memakai **OpenRouter** sebagai provider utama.
  - Model default: `google/gemini-2.5-flash` melalui OpenRouter.
  - Keluarga/kontak darurat **wajib download app dan register/login** agar bisa menerima push notification dan membuka live tracking.

> Catatan: `implementation.md` awal menyebut Gemini direct via `@google/genai`. Untuk backend guide ini, baseline diganti menjadi **OpenRouter** agar model AI bisa diganti tanpa mengubah banyak kode backend.

---

## 1. Tujuan Backend

Backend SafeHer bertanggung jawab untuk:

1. Auth user dan profile management.
2. Emergency contacts CRUD.
3. Linking akun keluarga/kontak darurat ke user korban.
4. SOS trigger:
   - validasi payload,
   - create incident,
   - fetch emergency contacts,
   - kirim push notification.
5. Audio upload:
   - validasi file,
   - upload ke Supabase Storage,
   - analisis AI via OpenRouter,
   - update incident dengan transcript dan AI summary.
6. Incident query:
   - list,
   - detail,
   - location history.
7. Live tracking support:
   - persistence location history via REST,
   - authorization untuk keluarga yang sudah register.
8. FCM push notification:
   - SOS alert,
   - AI summary update,
   - resolution update.
9. Security:
   - JWT verification,
   - ownership checks,
   - relationship-based access checks,
   - rate limiting,
   - idempotency untuk anti duplicate SOS.
10. Deployment:
   - Docker,
   - nginx reverse proxy,
   - HTTPS,
   - env/secret hardening.

---

## 2. High-Level Backend Flow

```mermaid
sequenceDiagram
    participant M as Mobile User
    participant API as Hono API
    participant DB as Supabase DB
    participant ST as Supabase Storage
    participant AI as OpenRouter AI
    participant FCM as Firebase FCM
    participant F as Family App

    M->>API: POST /api/sos/trigger
    API->>API: Verify JWT + rate limit + idempotency
    API->>DB: Create incident
    API->>DB: Fetch linked emergency contacts
    API->>FCM: Send SOS alert to family devices
    API-->>M: Return incident

    M->>API: POST /api/sos/:id/audio
    API->>API: Verify ownership + validate audio
    API->>ST: Upload audio
    API->>AI: Analyze audio via OpenRouter
    AI-->>API: transcript + AISummary JSON
    API->>DB: Update incident
    API->>FCM: Send AI summary update
    API-->>M: Return updated incident

    M->>API: POST /api/tracking/location
    API->>API: Verify owner + active incident
    API->>DB: Persist location history

    F->>API: GET /api/incidents/:id
    API->>API: Verify family linked to incident owner
    API-->>F: Return limited incident detail

    M->>API: PUT /api/sos/:id/resolve
    API->>DB: Update incident status
    API->>FCM: Notify family resolution
```

---

## 3. Backend Architecture

```txt
apps/api/
  Dockerfile
  .env.example
  src/
    index.ts
    app.ts
    lib/
      env.ts
      errors.ts
    middleware/
      auth.ts
      rate-limit.ts
    routes/
      auth.ts
      contacts.ts
      contact-links.ts
      sos.ts
      incidents.ts
      tracking.ts
      ai.ts
    services/
      supabase.ts
      openrouter.ts
      fcm.ts
      incidents.ts
      contact-access.ts
      idempotency.ts
      storage.ts
    tests/
      auth.test.ts
      contacts.test.ts
      sos.test.ts
      tracking.test.ts
      ai.test.ts
```

`packages/shared` tetap menjadi sumber shared types, validators, dan constants untuk mobile dan API.

---

## 4. Environment Variables

Buat/update `apps/api/.env.example`:

```env
# Server
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter AI
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_SITE_URL=https://safeher.biz.id
OPENROUTER_APP_NAME=SafeHer

# Firebase Admin / FCM
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional security config
SOS_RATE_LIMIT_PER_HOUR=5
TRACKING_BATCH_MAX_SIZE=100
AUDIO_MAX_BYTES=10485760
```

Rules:

- Jangan commit `.env`.
- Jangan bake `.env` ke Docker image.
- `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, dan Firebase private key hanya boleh ada di server.
- Mobile hanya memakai Supabase anon key dan public API URL.

---

## 5. Shared Package Tasks

**Batch:** 1  
**Estimasi:** 30-45 menit  
**Dependency:** Tidak ada

### 5.1 Types

Buat file:

```txt
packages/shared/src/types/user.ts
packages/shared/src/types/contact.ts
packages/shared/src/types/incident.ts
packages/shared/src/types/tracking.ts
```

Minimal types sesuai `implementation.md`:

- `Profile`
- `AuthUser`
- `EmergencyContact`
- `CreateContactInput`
- `UpdateContactInput`
- `IncidentStatus`
- `IncidentClassification`
- `TriggerType`
- `IncidentLocation`
- `AISummary`
- `Incident`
- `IncidentListItem`
- `LocationUpdate`
- `LocationHistoryEntry`

### 5.2 Validators

Buat file:

```txt
packages/shared/src/validators/sos.ts
packages/shared/src/validators/contact.ts
```

Schemas wajib:

- `SOSTriggerSchema`
- `AudioUploadSchema`
- `ResolveIncidentSchema`
- `CreateContactSchema`
- `UpdateContactSchema`

Tambahkan juga tracking validators:

```txt
packages/shared/src/validators/tracking.ts
```

Schemas:

- `TrackingLocationSchema`
- `TrackingBatchSchema`

Validasi tracking minimal:

- `incidentId`: UUID.
- `latitude`: -90 sampai 90.
- `longitude`: -180 sampai 180.
- `accuracy`: number >= 0.
- `speed`: nullable optional.
- `heading`: nullable optional.
- batch max 100 item.

### 5.3 Constants

Buat file:

```txt
packages/shared/src/constants/keywords.ts
packages/shared/src/constants/risk.ts
```

Export constants:

- `DISTRESS_KEYWORDS`
- `RISK_THRESHOLD`
- `COUNTDOWN_SECONDS`
- `AUDIO_RECORD_SECONDS`
- `LOCATION_INTERVAL_MS`
- `LOCATION_DISTANCE_M`
- `RISK_WEIGHTS`
- `RISK_LEVELS`
- `ACCELEROMETER`

### 5.4 Barrel Export

Update:

```txt
packages/shared/src/index.ts
```

Export semua types, validators, dan constants.

### Deliverable Batch 1

```txt
packages/shared/src/
  index.ts
  types/
    user.ts
    contact.ts
    incident.ts
    tracking.ts
  validators/
    sos.ts
    contact.ts
    tracking.ts
  constants/
    keywords.ts
    risk.ts
```

### Verifikasi

```bash
moon run shared:typecheck
moon run shared:test
```

---

## 6. Supabase Schema & Security Model

**Batch:** 2  
**Estimasi:** 60-90 menit  
**Dependency:** Batch 1

### 6.1 Migration File

Jangan hanya copy SQL manual ke dashboard. Simpan schema sebagai migration agar reproducible.

Buat:

```txt
supabase/migrations/001_initial_schema.sql
```

Isi migration berdasarkan `implementation.md` Component 6:

- `profiles`
- `emergency_contacts`
- `incidents`
- `location_history`
- triggers:
  - `handle_new_user()`
  - `update_updated_at()`
- indexes:
  - `idx_one_primary_contact`
  - `idx_incidents_user_status`
  - `idx_location_history_incident`
- storage bucket `incident-audio`
- RLS policies.

### 6.2 Tambahan Schema untuk Family Registered Tracking

Karena keluarga wajib download app dan register, backend perlu relasi akun keluarga ke emergency contact.

Tambahkan kolom ke `emergency_contacts`:

```sql
ALTER TABLE emergency_contacts
ADD COLUMN linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN invite_code TEXT UNIQUE,
ADD COLUMN invite_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (invite_status IN ('pending', 'accepted', 'revoked')),
ADD COLUMN accepted_at TIMESTAMPTZ;
```

Penjelasan:

- `user_id`: pemilik contact, yaitu korban/user utama.
- `linked_user_id`: akun keluarga yang sudah register dan menerima undangan.
- `fcm_token`: token device keluarga, bisa tetap disimpan di `profiles.fcm_token` atau di contact jika satu contact satu device.
- `invite_code`: kode/link untuk menghubungkan contact ke akun keluarga.
- `invite_status`: status relasi.

Rekomendasi tambahan untuk multi-device:

```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own device tokens"
  ON device_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Jika ingin MVP lebih simpel, boleh pakai `profiles.fcm_token` dulu. Tapi `device_tokens` lebih aman untuk user dengan lebih dari satu device.

### 6.3 RLS dan Service Role Warning

Backend memakai `SUPABASE_SERVICE_ROLE_KEY`, sehingga RLS bisa ter-bypass. Karena itu, **semua route backend wajib melakukan authorization manual**.

Rules wajib:

- Query contacts selalu filter `user_id = authenticatedUserId` kecuali route khusus family access.
- Query incident owner selalu filter `incidents.user_id = authenticatedUserId` untuk user korban.
- Family hanya boleh akses incident jika ada accepted contact relation:

```sql
emergency_contacts.user_id = incidents.user_id
AND emergency_contacts.linked_user_id = authenticatedFamilyUserId
AND emergency_contacts.invite_status = 'accepted'
```

### 6.4 Supabase Storage

Bucket:

```txt
incident-audio
```

Rules:

- max 10MB.
- allowed MIME:
  - `audio/mpeg`
  - `audio/mp4`
  - `audio/wav`
  - `audio/webm`
  - `audio/m4a`
- path:

```txt
incident-audio/{userId}/{incidentId}.m4a
```

### Deliverable Batch 2

```txt
supabase/migrations/001_initial_schema.sql
apps/api/src/services/supabase.ts
apps/api/src/lib/env.ts
```

### Verifikasi

- Migration bisa dijalankan di Supabase project baru.
- Tables dan policies terbentuk.
- Bucket `incident-audio` tersedia.
- `device_tokens` tersedia jika memilih multi-device token support.

---

## 7. API Foundation

**Batch:** 3  
**Estimasi:** 45-60 menit  
**Dependency:** Batch 2

### 7.1 Env Validation

File:

```txt
apps/api/src/lib/env.ts
```

Gunakan Zod untuk validate env:

- `PORT`
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `SOS_RATE_LIMIT_PER_HOUR`
- `TRACKING_BATCH_MAX_SIZE`
- `AUDIO_MAX_BYTES`

Pastikan `FIREBASE_PRIVATE_KEY` mengganti escaped newline:

```ts
privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
```

### 7.2 Hono App Setup

File:

```txt
apps/api/src/app.ts
```

Setup:

- `new Hono().basePath('/api')`
- CORS
- logger
- `/health`
- route mounting placeholder
- global error handler
- not found handler

Health response:

```json
{
  "status": "ok",
  "service": "safeher-api"
}
```

### 7.3 Entry Point

File:

```txt
apps/api/src/index.ts
```

Gunakan `@hono/node-server` dan `env.PORT`.

### 7.4 Supabase Admin Client

File:

```txt
apps/api/src/services/supabase.ts
```

Export Supabase service role client untuk server-only operations.

### Deliverable Batch 3

```txt
apps/api/src/
  index.ts
  app.ts
  lib/env.ts
  services/supabase.ts
```

### Verifikasi

```bash
pnpm --filter @safeher/api dev
curl http://localhost:3000/api/health
moon run api:typecheck
```

---

## 8. Auth Middleware & Auth Routes

**Batch:** 4  
**Estimasi:** 60-90 menit  
**Dependency:** Batch 3

### 8.1 Auth Middleware

File:

```txt
apps/api/src/middleware/auth.ts
```

Responsibilities:

1. Extract `Authorization: Bearer <token>`.
2. Verify via Supabase:

```ts
supabase.auth.getUser(token)
```

3. Set Hono context variables:

```ts
userId
userEmail
accessToken
```

4. Throw `401` jika token missing/invalid.

### 8.2 Auth Routes

File:

```txt
apps/api/src/routes/auth.ts
```

Endpoints:

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Register user baru |
| `POST` | `/api/auth/login` | No | Login user |
| `POST` | `/api/auth/logout` | Yes | Logout |
| `GET` | `/api/auth/me` | Yes | Get current user profile |
| `PUT` | `/api/auth/profile` | Yes | Update profile |
| `POST` | `/api/auth/refresh` | No | Refresh session |
| `PUT` | `/api/auth/push-token` | Yes | Register/update device push token |
| `DELETE` | `/api/auth/push-token` | Yes | Remove device push token |

### 8.3 Push Token Route

Karena keluarga wajib register di app, FCM token sebaiknya disimpan per akun/device.

Request:

```ts
{
  token: string
  platform: 'android' | 'ios' | 'web'
}
```

Behavior:

- Upsert ke `device_tokens` jika table dipakai.
- Atau update `profiles.fcm_token` untuk MVP simple.
- Token invalid harus bisa dihapus saat FCM send gagal dengan error token invalid.

### 8.4 Auth Response Contract

Register response:

```ts
{
  user: AuthUser
  session: {
    accessToken: string
    refreshToken: string
  }
}
```

Login response sama dengan register.

`GET /api/auth/me`:

```ts
{
  user: AuthUser
}
```

### Deliverable Batch 4

```txt
apps/api/src/middleware/auth.ts
apps/api/src/routes/auth.ts
```

### Verifikasi

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234","fullName":"Test User"}'

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}'

curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## 9. Emergency Contacts & Family Linking

**Batch:** 5  
**Estimasi:** 90-120 menit  
**Dependency:** Batch 4

### 9.1 Contacts CRUD

File:

```txt
apps/api/src/routes/contacts.ts
```

Endpoints:

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/contacts` | Yes | List emergency contacts milik user |
| `POST` | `/api/contacts` | Yes | Add contact |
| `PUT` | `/api/contacts/:id` | Yes | Update contact |
| `DELETE` | `/api/contacts/:id` | Yes | Delete contact |
| `PUT` | `/api/contacts/:id/primary` | Yes | Set primary contact |

Rules:

- Semua query wajib filter `user_id = c.get('userId')`.
- Validate input dengan `CreateContactSchema` dan `UpdateContactSchema`.
- Only one primary contact per user.
- Delete contact milik user sendiri saja.

### 9.2 Family Linking Routes

File:

```txt
apps/api/src/routes/contact-links.ts
```

Karena keluarga wajib register di app, perlu flow linking:

#### Flow rekomendasi

1. Korban menambahkan emergency contact.
2. Backend generate `invite_code` untuk contact.
3. Korban share invite code/link ke keluarga.
4. Keluarga register/login di SafeHer app.
5. Keluarga submit invite code.
6. Backend set:
   - `linked_user_id = familyUserId`
   - `invite_status = 'accepted'`
   - `accepted_at = now()`

#### Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/contact-links/:contactId/invite` | Yes | Generate/regenerate invite code untuk contact milik user |
| `POST` | `/api/contact-links/accept` | Yes | Family accept invite code |
| `GET` | `/api/contact-links/me` | Yes | List hubungan dimana user adalah family/contact linked |
| `DELETE` | `/api/contact-links/:contactId` | Yes | Revoke contact link |

Request accept:

```ts
{
  inviteCode: string
}
```

Response accept:

```ts
{
  contact: EmergencyContact
  linkedTo: {
    userId: string
    fullName: string
  }
}
```

Security rules:

- User pemilik contact hanya boleh generate/revoke invite untuk contact miliknya.
- Family tidak boleh accept invite yang sudah `accepted` atau `revoked`.
- Family tidak boleh accept invite milik dirinya sendiri jika `emergency_contacts.user_id === familyUserId`.

### 9.3 Contact Access Service

File:

```txt
apps/api/src/services/contact-access.ts
```

Functions:

```ts
assertOwnContact(userId: string, contactId: string)
assertCanAccessIncident(userId: string, incidentId: string)
assertIsIncidentOwner(userId: string, incidentId: string)
assertIsLinkedFamilyForIncident(userId: string, incidentId: string)
```

Access model:

- Incident owner can read/write own incident.
- Linked family can read limited incident detail and tracking info.
- Linked family cannot resolve or upload audio.
- Linked family cannot edit victim contacts.

### Deliverable Batch 5

```txt
apps/api/src/routes/contacts.ts
apps/api/src/routes/contact-links.ts
apps/api/src/services/contact-access.ts
```

### Verifikasi

```bash
# Create contact
curl -X POST http://localhost:3000/api/contacts \
  -H "Authorization: Bearer <victimToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mama","phone":"+6281234567890","relationship":"parent","isPrimary":true}'

# Generate invite
curl -X POST http://localhost:3000/api/contact-links/<contact-id>/invite \
  -H "Authorization: Bearer <victimToken>"

# Accept invite as family
curl -X POST http://localhost:3000/api/contact-links/accept \
  -H "Authorization: Bearer <familyToken>" \
  -H "Content-Type: application/json" \
  -d '{"inviteCode":"<invite-code>"}'
```

---

## 10. FCM Push Notification Service

**Batch:** 6  
**Estimasi:** 45-60 menit  
**Dependency:** Batch 5

### 10.1 Firebase Admin Setup

File:

```txt
apps/api/src/services/fcm.ts
```

Responsibilities:

- Init Firebase Admin SDK once.
- Load credentials from env.
- Send push to linked family device tokens.
- Handle partial success.
- Delete invalid tokens if FCM returns invalid/unregistered token.

### 10.2 Notification Types

Implement functions:

```ts
sendSOSNotification(params)
sendAISummaryNotification(params)
sendResolutionNotification(params)
```

### 10.3 SOS Notification Payload

Payload data wajib:

```ts
{
  type: 'sos_alert'
  incidentId: string
  victimUserId: string
  victimName: string
  deepLink: `safeher://tracking/${incidentId}`
}
```

Notification title/body example:

```txt
🚨 SafeHer SOS Alert
{victimName} membutuhkan bantuan. Tap untuk melihat lokasi live.
```

### 10.4 AI Summary Notification Payload

```ts
{
  type: 'ai_summary_ready'
  incidentId: string
  classification: string
  risk: string
  deepLink: `safeher://tracking/${incidentId}`
}
```

### 10.5 Resolution Notification Payload

```ts
{
  type: 'incident_resolved' | 'false_alarm'
  incidentId: string
  deepLink: `safeher://incidents/${incidentId}`
}
```

### 10.6 Who Receives Notification?

Only emergency contacts with:

```txt
invite_status = 'accepted'
linked_user_id IS NOT NULL
```

Then get their device tokens from `device_tokens` or `profiles.fcm_token`.

### Deliverable Batch 6

```txt
apps/api/src/services/fcm.ts
```

### Verifikasi

- Send test push to registered family device token.
- Invalid token is logged and removed.
- Partial FCM failure does not fail SOS trigger response.

---

## 11. SOS Core, Incidents & Idempotency

**Batch:** 7  
**Estimasi:** 120-180 menit  
**Dependency:** Batch 6  
**Priority:** Core feature

### 11.1 Rate Limit Middleware

File:

```txt
apps/api/src/middleware/rate-limit.ts
```

Rules MVP:

- `POST /api/sos/trigger`: max 5 per user per hour.
- Return `429` if exceeded.
- Use in-memory store for MVP dev only.
- For production, use Supabase table or Redis/Upstash.

Do not put rate limiter inside global error handler.

### 11.2 Idempotency Service

File:

```txt
apps/api/src/services/idempotency.ts
```

Goal: prevent duplicate SOS from double tap or retry.

Recommended request header:

```txt
Idempotency-Key: <uuid-from-mobile>
```

Alternative payload field:

```ts
{
  idempotencyKey: string
}
```

Behavior:

- If same user sends same idempotency key again, return the same incident response.
- If no key exists, fallback check active incident in last 30-60 seconds.

Recommended DB table:

```sql
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);
```

### 11.3 SOS Routes

File:

```txt
apps/api/src/routes/sos.ts
```

Endpoints:

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/sos/trigger` | Yes | Trigger SOS |
| `POST` | `/api/sos/:id/audio` | Yes | Upload audio recording |
| `PUT` | `/api/sos/:id/resolve` | Yes | Resolve/false alarm |
| `GET` | `/api/sos/:id/status` | Yes | Get incident status |

### 11.4 Flow `POST /api/sos/trigger`

Steps:

1. Verify JWT.
2. Apply rate limit.
3. Validate request with `SOSTriggerSchema`.
4. Handle idempotency key.
5. Create incident:
   - `user_id`
   - `status = 'triggered'`
   - `trigger_type`
   - `latitude`
   - `longitude`
   - `accuracy`
   - `speed`
   - `heading`
   - `risk_score`
   - `keywords_detected`
6. Fetch accepted linked emergency contacts.
7. Send FCM SOS alert async.
8. Store idempotency response.
9. Return:

```ts
{
  incident: Incident
  message: 'SOS triggered. Emergency contacts notified.'
  contactsNotified: number
}
```

Important:

- FCM partial failure should not rollback incident creation.
- If no linked family device exists, still create incident and return `contactsNotified: 0`.

### 11.5 Flow `PUT /api/sos/:id/resolve`

Steps:

1. Verify JWT.
2. Validate incident belongs to user.
3. Validate body with `ResolveIncidentSchema`.
4. Only allow resolve if status is `triggered` or `active`.
5. Update:
   - `status = resolved | false_alarm`
   - `resolved_at = now()`
   - `resolution_notes`
6. Fetch linked emergency contacts.
7. Send resolution notification.
8. Return updated incident.

### 11.6 Flow `GET /api/sos/:id/status`

Access:

- Owner can read.
- Linked family can read limited status.

Return:

```ts
{
  incident: {
    id: string
    status: IncidentStatus
    riskScore: number | null
    classification: IncidentClassification | null
    createdAt: string
    resolvedAt: string | null
  }
}
```

### 11.7 Incident Routes

File:

```txt
apps/api/src/routes/incidents.ts
```

Endpoints:

| Method | Path | Auth | Access |
| --- | --- | --- | --- |
| `GET` | `/api/incidents` | Yes | Owner: own incidents. Family: linked active/shared incidents optional. |
| `GET` | `/api/incidents/:id` | Yes | Owner or linked family |
| `GET` | `/api/incidents/:id/locations` | Yes | Owner or linked family |

Rules:

- Owner gets full incident detail.
- Linked family gets safe subset:
  - status,
  - victim name,
  - location,
  - risk score,
  - classification,
  - AI summary,
  - transcript optional depending privacy decision,
  - no private internal metadata.

### Deliverable Batch 7

```txt
apps/api/src/middleware/rate-limit.ts
apps/api/src/services/idempotency.ts
apps/api/src/routes/sos.ts
apps/api/src/routes/incidents.ts
```

### Verifikasi

```bash
curl -X POST http://localhost:3000/api/sos/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: test-key-1" \
  -H "Content-Type: application/json" \
  -d '{"triggerType":"manual","location":{"latitude":-6.2088,"longitude":106.8456,"accuracy":10}}'

# Same idempotency key should return same incident, not create duplicate
curl -X POST http://localhost:3000/api/sos/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: test-key-1" \
  -H "Content-Type: application/json" \
  -d '{"triggerType":"manual","location":{"latitude":-6.2088,"longitude":106.8456,"accuracy":10}}'
```

---

## 12. OpenRouter AI Pipeline & Audio Processing

**Batch:** 8  
**Estimasi:** 90-120 menit  
**Dependency:** Batch 7

### 12.1 OpenRouter Service

File:

```txt
apps/api/src/services/openrouter.ts
```

Dependency:

```txt
openai
```

Install if not present:

```bash
pnpm --filter @safeher/api add openai
```

Setup:

```ts
import OpenAI from 'openai'
import { env } from '../lib/env'

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': env.OPENROUTER_SITE_URL,
    'X-Title': env.OPENROUTER_APP_NAME,
  },
})
```

### 12.2 Function `analyzeIncidentAudio`

Input:

```ts
type AnalyzeIncidentAudioInput = {
  audioBuffer: Buffer
  mimeType: string
  incidentId: string
  triggerType: TriggerType
  location: IncidentLocation
  riskScore?: number | null
  keywordsDetected?: string[]
}
```

Output:

```ts
type AnalyzeIncidentAudioOutput = {
  transcript: string
  aiSummary: AISummary
}
```

### 12.3 Prompt Requirements

AI harus menghasilkan JSON valid:

```ts
{
  "transcript": "string",
  "aiSummary": {
    "risk": 0,
    "classification": "harassment | robbery | assault | stalking | unknown",
    "recommendation": "send_sos | monitor | false_alarm",
    "summary": "string",
    "keywords_detected": ["string"],
    "confidence": 0.0
  }
}
```

Instruction penting:

- Jangan mengarang jika audio tidak jelas.
- Jika audio tidak bisa dipahami, classification `unknown`, confidence rendah.
- Risk score 0-100.
- Summary dalam Bahasa Indonesia.
- Return JSON only, no markdown.

### 12.4 Retry Strategy

- Retry AI call 2x dengan exponential backoff.
- Jika gagal:
  - audio tetap tersimpan,
  - incident tetap update `audio_url`,
  - `transcript` dan `ai_summary` boleh null,
  - log error server-side,
  - return response dengan status audio uploaded but analysis pending/failed.

### 12.5 Audio Upload Route

Update:

```txt
apps/api/src/routes/sos.ts
```

Endpoint:

```txt
POST /api/sos/:id/audio
```

Steps:

1. Verify JWT.
2. Verify incident belongs to user.
3. Reject upload if incident resolved/false_alarm unless explicitly allowed for retry.
4. Parse multipart form.
5. Validate file exists with field name `audio`.
6. Validate max size 10MB.
7. Validate MIME allowlist:
   - `audio/mpeg`
   - `audio/mp4`
   - `audio/wav`
   - `audio/webm`
   - `audio/m4a`
8. Upload to Supabase Storage path:

```txt
{userId}/{incidentId}.m4a
```

9. Call OpenRouter analysis.
10. Update incident:
    - `audio_url`
    - `transcript`
    - `ai_summary`
    - `risk_score`
    - `classification`
11. Fetch linked family contacts.
12. Send AI summary notification.
13. Return updated incident.

### 12.6 Standalone AI Route

File:

```txt
apps/api/src/routes/ai.ts
```

Endpoint:

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/ai/analyze` | Yes | Analyze audio langsung tanpa incident |

Use case:

- Testing AI pipeline.
- Debugging.
- Optional internal tool.

Apply same audio validation.

### Deliverable Batch 8

```txt
apps/api/src/services/openrouter.ts
apps/api/src/routes/ai.ts
apps/api/src/routes/sos.ts # updated audio endpoint
```

### Verifikasi

```bash
curl -X POST http://localhost:3000/api/sos/<incident-id>/audio \
  -H "Authorization: Bearer <token>" \
  -F "audio=@test-audio.m4a"

curl -X POST http://localhost:3000/api/ai/analyze \
  -H "Authorization: Bearer <token>" \
  -F "audio=@test-audio.m4a"
```

---

## 13. Tracking Persistence & Family Access

**Batch:** 9  
**Estimasi:** 60-90 menit  
**Dependency:** Batch 7

### 13.1 Tracking Routes

File:

```txt
apps/api/src/routes/tracking.ts
```

Endpoints:

| Method | Path | Auth | Access |
| --- | --- | --- | --- |
| `POST` | `/api/tracking/location` | Yes | Owner only |
| `POST` | `/api/tracking/batch` | Yes | Owner only |
| `GET` | `/api/tracking/:incidentId/access` | Yes | Owner or linked family |

`POST /api/tracking/location` request:

```ts
{
  incidentId: string
  latitude: number
  longitude: number
  speed?: number | null
  heading?: number | null
  accuracy: number
}
```

`POST /api/tracking/batch` request:

```ts
{
  incidentId: string
  locations: Array<{
    latitude: number
    longitude: number
    speed?: number | null
    heading?: number | null
    accuracy: number
    timestamp: string
  }>
}
```

### 13.2 Tracking Rules

For owner sending location:

- Verify incident belongs to user.
- Verify incident status is `triggered` or `active`.
- Validate coordinates.
- Batch max 100 locations.
- Insert into `location_history`.

For family reading tracking:

- Family must be authenticated.
- Family must be linked via accepted emergency contact relation.
- Family can read incident status and location history.
- Family receives realtime location from Supabase Realtime channel on mobile client.

### 13.3 Supabase Realtime Access Note

Live tracking broadcast is client-to-client via Supabase Realtime channel:

```txt
tracking:{incidentId}
```

Backend responsibilities:

- Ensure only authenticated users can get incident detail/tracking access metadata.
- Persist route history via REST.
- Optionally provide channel authorization metadata to client.

MVP note:

- If Supabase Realtime broadcast authorization cannot be restricted per channel easily in MVP, frontend should only reveal `incidentId` channel to authenticated owner and linked family.
- Backend must not expose incident detail to unlinked users.

### Deliverable Batch 9

```txt
apps/api/src/routes/tracking.ts
```

### Verifikasi

```bash
curl -X POST http://localhost:3000/api/tracking/location \
  -H "Authorization: Bearer <victimToken>" \
  -H "Content-Type: application/json" \
  -d '{"incidentId":"<id>","latitude":-6.2088,"longitude":106.8456,"accuracy":10}'

curl http://localhost:3000/api/incidents/<id>/locations \
  -H "Authorization: Bearer <familyToken>"
```

Expected:

- Victim can insert tracking location.
- Linked family can read locations.
- Unlinked user gets 403.

---

## 14. Global Error Handling

**Batch:** 10  
**Estimasi:** 30-45 menit  
**Dependency:** Semua route utama

### 14.1 Error Handler

Update:

```txt
apps/api/src/app.ts
```

Behavior:

- `HTTPException` returns its status and message.
- Zod validation returns `400` with safe validation error.
- Unexpected error returns `500` with generic message.
- Never return stack trace to client in production.
- Log detailed error server-side.

Response shape:

```ts
{
  error: {
    message: string
    code?: string
  }
}
```

### 14.2 Not Found Handler

Return:

```ts
{
  error: {
    message: 'Route not found'
  }
}
```

### 14.3 Backend Error Strategy

| Scenario | Status | Handling |
| --- | --- | --- |
| Invalid/missing token | 401 | Return auth error. |
| User accesses other user's resource | 403 | Return forbidden. |
| Resource not found | 404 | Return not found. |
| Invalid body | 400 | Return validation message. |
| SOS rate limit exceeded | 429 | Return retry-friendly message. |
| Audio too large | 413 | Return max 10MB message. |
| Unsupported audio MIME | 415 | Return supported formats. |
| OpenRouter error | 200 or 202 for upload success, log AI failure | Keep audio saved. |
| FCM partial failure | 200/201 | Return contacts notified count, log failures. |
| Supabase DB error | 500 | Generic client error, detailed server log. |

---

## 15. Docker & Deployment

**Batch:** 11  
**Estimasi:** 60-90 menit  
**Dependency:** Backend feature complete

### 15.1 Dockerfile

File:

```txt
apps/api/Dockerfile
```

Requirements:

- Multi-stage build.
- Build shared package and API.
- Run as non-root user.
- Do not copy `.env` into image.
- Expose port `3000`.
- `NODE_ENV=production`.

### 15.2 Nginx

Requirements:

- Reverse proxy `backend.safeher.biz.id` to API container.
- HTTPS via certbot.
- `client_max_body_size 12M` or slightly above audio max.
- Reasonable timeouts for AI/audio request.

Example important nginx settings:

```nginx
client_max_body_size 12M;
proxy_read_timeout 120s;
proxy_connect_timeout 30s;
proxy_send_timeout 120s;
```

### 15.3 Runtime Secrets

Use one of:

- Docker compose `env_file` on VPS.
- Systemd environment file.
- Secret manager if available.

Never:

- commit production `.env`,
- include service role key in frontend,
- print secrets in logs.

### 15.4 Health Check

Endpoint:

```txt
GET /api/health
```

Expected:

```json
{
  "status": "ok",
  "service": "safeher-api"
}
```

### Verifikasi Deploy

```bash
docker build -t safeher-api -f apps/api/Dockerfile .
docker run -p 3000:3000 --env-file apps/api/.env safeher-api
curl http://localhost:3000/api/health
curl https://backend.safeher.biz.id/api/health
```

---

## 16. Automated Tests

**Batch:** 12  
**Estimasi:** 90-150 menit  
**Dependency:** Backend feature complete

### 16.1 Test Files

Create:

```txt
apps/api/src/tests/auth.test.ts
apps/api/src/tests/contacts.test.ts
apps/api/src/tests/contact-links.test.ts
apps/api/src/tests/sos.test.ts
apps/api/src/tests/tracking.test.ts
apps/api/src/tests/ai.test.ts
```

### 16.2 Minimum Test Coverage

Auth:

- Register success.
- Login success.
- Protected route rejects missing token.
- Push token upsert works.

Contacts:

- Create/list/update/delete own contact.
- Cannot access other user's contact.
- Set primary contact.

Contact links:

- Owner can generate invite.
- Family can accept invite.
- Unlinked user cannot access victim incident.
- Linked family can access victim active incident.

SOS:

- Trigger SOS creates incident.
- Trigger validates payload.
- Rate limit returns 429.
- Same idempotency key does not create duplicate incident.
- Resolve updates status and sends notification mock.

Audio/AI:

- Reject unsupported MIME.
- Reject file >10MB.
- Reject upload to other user's incident.
- OpenRouter service can be mocked.
- AI failure keeps audio URL saved.

Tracking:

- Owner can persist location.
- Owner cannot persist to resolved incident.
- Batch max enforced.
- Linked family can read location history.
- Unlinked user gets 403.

### 16.3 Commands

```bash
moon run shared:test
moon run api:test
moon run api:typecheck
moon run api:build
```

---

## 17. Manual Verification Checklist

### Auth & Family Linking

- [ ] User korban register/login.
- [ ] User keluarga register/login.
- [ ] Korban menambahkan emergency contact.
- [ ] Korban generate invite code.
- [ ] Keluarga accept invite code.
- [ ] Keluarga register push token.

### SOS

- [ ] Korban trigger SOS.
- [ ] Incident created.
- [ ] Linked family receives FCM alert.
- [ ] Unlinked user cannot read incident.
- [ ] Linked family can open incident/tracking detail.

### Audio & AI

- [ ] Audio upload max 10MB accepted.
- [ ] Unsupported file rejected.
- [ ] OpenRouter returns transcript and summary.
- [ ] Incident updated with AI result.
- [ ] Family receives AI summary notification.

### Tracking

- [ ] Korban posts location history.
- [ ] Linked family reads location history.
- [ ] Linked family receives realtime tracking channel info from app flow.
- [ ] Unlinked user gets 403.

### Resolution

- [ ] Korban resolves incident.
- [ ] Incident status changes to `resolved` or `false_alarm`.
- [ ] Family receives resolution notification.
- [ ] Tracking persistence rejects new locations after resolved.

### Deploy

- [ ] `/api/health` accessible via HTTPS.
- [ ] Audio upload works behind nginx.
- [ ] Secrets are not in image or repo.
- [ ] Logs do not expose tokens/private keys.

---

## 18. Batch Execution Order

```mermaid
flowchart TD
    B1[Batch 1 Shared Types Validators] --> B2[Batch 2 Supabase Schema]
    B2 --> B3[Batch 3 API Foundation]
    B3 --> B4[Batch 4 Auth]
    B4 --> B5[Batch 5 Contacts and Family Linking]
    B5 --> B6[Batch 6 FCM]
    B6 --> B7[Batch 7 SOS Core and Incidents]
    B7 --> B8[Batch 8 OpenRouter Audio AI]
    B7 --> B9[Batch 9 Tracking]
    B8 --> B10[Batch 10 Error Handling]
    B9 --> B10
    B10 --> B11[Batch 11 Docker Deploy]
    B10 --> B12[Batch 12 Tests]
```

---

## 19. Definition of Done Backend MVP

Backend MVP dianggap selesai jika:

### Foundation

- [ ] Env validation lengkap.
- [ ] Hono app berjalan dengan `/api/health`.
- [ ] Supabase service role client hanya dipakai server-side.
- [ ] Migration SQL tersimpan di repo.

### Auth

- [ ] Register/login/logout/me/profile bekerja.
- [ ] JWT middleware melindungi route protected.
- [ ] Push token registration bekerja.

### Contacts & Family

- [ ] Contacts CRUD bekerja.
- [ ] Family bisa register dan accept invite.
- [ ] Linked family bisa menerima alert dan akses incident yang relevan.
- [ ] Unlinked user tidak bisa akses incident/tracking.

### SOS

- [ ] SOS trigger create incident.
- [ ] FCM dikirim ke linked family.
- [ ] Rate limit aktif.
- [ ] Idempotency mencegah duplicate incident.
- [ ] Resolve/false alarm update incident dan notify family.

### Audio & AI

- [ ] Audio upload validasi MIME dan max size.
- [ ] Audio tersimpan di Supabase Storage.
- [ ] OpenRouter menghasilkan transcript dan AI summary.
- [ ] AI failure tidak menggagalkan incident/audio storage.

### Tracking

- [ ] Location persistence single dan batch bekerja.
- [ ] Tracking insert hanya owner dan hanya saat incident active.
- [ ] Linked family bisa read location history.

### Security

- [ ] Semua route sensitive punya ownership/access check.
- [ ] Service role tidak menyebabkan bypass authorization.
- [ ] Error response tidak membocorkan stack trace/secrets.
- [ ] Deploy tidak menyimpan secret di image/repo.

### Verification

- [ ] `moon run shared:test` pass.
- [ ] `moon run api:test` pass.
- [ ] `moon run api:typecheck` pass.
- [ ] `moon run api:build` pass.
- [ ] Manual SOS flow pass di device frontend.

---

## 20. Ringkasan Semua File Backend

```txt
packages/shared/src/
  index.ts
  types/
    user.ts
    contact.ts
    incident.ts
    tracking.ts
  validators/
    sos.ts
    contact.ts
    tracking.ts
  constants/
    keywords.ts
    risk.ts

supabase/
  migrations/
    001_initial_schema.sql

apps/api/
  Dockerfile
  .env.example
  src/
    index.ts
    app.ts
    lib/
      env.ts
      errors.ts
    middleware/
      auth.ts
      rate-limit.ts
    routes/
      auth.ts
      contacts.ts
      contact-links.ts
      sos.ts
      incidents.ts
      tracking.ts
      ai.ts
    services/
      supabase.ts
      openrouter.ts
      fcm.ts
      incidents.ts
      contact-access.ts
      idempotency.ts
      storage.ts
    tests/
      auth.test.ts
      contacts.test.ts
      contact-links.test.ts
      sos.test.ts
      tracking.test.ts
      ai.test.ts
```

---

## 21. Notes untuk Frontend Team

Backend assumptions yang perlu diketahui frontend:

1. AI provider backend adalah OpenRouter, tetapi response contract tetap `AISummary` yang sama.
2. Family/kontak darurat harus register/login app.
3. Korban harus invite/link family contact sebelum FCM alert bisa dikirim ke device keluarga.
4. `POST /api/sos/trigger` sebaiknya mengirim `Idempotency-Key` header.
5. Push notification deep link:
   - SOS alert: `safeher://tracking/{incidentId}`
   - AI update: `safeher://tracking/{incidentId}`
   - resolved/false alarm: `safeher://incidents/{incidentId}`
6. Family yang belum linked tidak boleh melihat incident/tracking.
7. SOS tetap dibuat walaupun belum ada family linked atau FCM gagal.
