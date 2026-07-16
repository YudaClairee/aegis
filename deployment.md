# Panduan Deployment SafeHer API ke VPS DigitalOcean & Cloudflare

Dokumen ini menyediakan panduan langkah demi langkah lengkap untuk mendeploy **SafeHer API** ke VPS **DigitalOcean** dengan manajemen domain dan SSL yang terintegrasi menggunakan **Cloudflare**.

API ini dibangun menggunakan framework [Hono](https://hono.dev/) dengan Node.js, terhubung ke database **Supabase**, mengirim push notification lewat **Firebase Cloud Messaging (FCM)**, dan memproses analisis AI menggunakan **OpenRouter**.

---

## Prasyarat (Prerequisites)
Sebelum memulai, pastikan Anda memiliki:
1. Akun **DigitalOcean** dengan Droplet aktif (Direkomendasikan: Ubuntu 22.04 LTS atau 24.04 LTS, minimal 1 GB RAM).
2. Akun **Cloudflare** dengan domain yang sudah mengarah ke name server Cloudflare.
3. Akses SSH ke VPS Droplet Anda.
4. Nilai-nilai konfigurasi API Key (dari file [.env.example](file:///home/yudaclairee/project/safeher/apps/api/.env.example)).

---

## Langkah 1: Persiapan Awal VPS DigitalOcean

Hubungkan ke Droplet Anda melalui SSH:
```bash
ssh root@ip_address_vps_anda
```

### 1. Update dan Upgrade System
Perbarui seluruh package sistem Anda ke versi terbaru:
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Set Up Firewall (UFW)
Untuk keamanan tambahan, aktifkan firewall bawaan Ubuntu dan buka port SSH, HTTP, dan HTTPS:
```bash
# Izinkan SSH agar koneksi Anda tidak terputus
sudo ufw allow OpenSSH

# Izinkan Nginx (HTTP & HTTPS)
sudo ufw allow 'Nginx Full'

# Aktifkan Firewall
sudo ufw enable
```

---

## Langkah 2: Konfigurasi Domain di Cloudflare

Untuk mengarahkan domain ke VPS dan mengaktifkan proteksi serta SSL Cloudflare:
1. Masuk ke dashboard Cloudflare dan pilih domain Anda.
2. Navigasi ke menu **DNS** -> **Records**.
3. Tambahkan DNS Record baru:
   - **Type**: `A`
   - **Name**: `api` (untuk subdomain `api.domainanda.com`) atau `@` (untuk domain utama `domainanda.com`).
   - **IPv4 address**: `ip_address_vps_anda`
   - **Proxy status**: **Proxied (Orange Cloud)** - Ini akan menyembunyikan IP VPS asli Anda dan mengaktifkan CDN serta SSL dari Cloudflare.
   - **TTL**: `Auto`
4. Klik **Save**.

### Konfigurasi SSL/TLS di Cloudflare:
Masuk ke menu **SSL/TLS** -> **Overview**:
* **Opsi A (Flexible - Termudah)**: Enkripsi hanya terjadi dari Browser/Cloudflare ke Client. Lalu lintas dari Cloudflare ke VPS menggunakan HTTP biasa (port 80). Ini tidak memerlukan konfigurasi sertifikat SSL SSL/TLS local di VPS.
* **Opsi B (Full / Full Strict - Direkomendasikan)**: Lalu lintas dienkripsi penuh secara end-to-end. Anda perlu mengonfigurasi sertifikat SSL (misalnya Let's Encrypt atau Cloudflare Origin CA) di server Nginx VPS Anda.

---

## Langkah 3: Pilih Metode Deployment

Kami menyediakan 2 metode deployment yang bisa Anda gunakan. **Metode A (Docker)** sangat direkomendasikan karena terisolasi dengan rapi dan menggunakan konfigurasi [Dockerfile](file:///home/yudaclairee/project/safeher/apps/api/Dockerfile) bawaan.

### Metode A: Menggunakan Docker & Docker Compose (Sangat Direkomendasikan)

#### 1. Install Docker di VPS
Jalankan script instalasi resmi Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

#### 2. Kloning Repositori di VPS
Clone repositori proyek SafeHer Anda ke VPS (misalnya ke direktori `/var/www/safeher`):
```bash
mkdir -p /var/www && cd /var/www
git clone <URL_REPOSITORI_ANDA> safeher
cd safeher
```

#### 3. Buat File `docker-compose.yml`
Buat file `docker-compose.yml` di root direktori `/var/www/safeher`:
```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: safeher-api
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - apps/api/.env
```

#### 4. Siapkan File `.env` untuk API
Salin file template `.env.example` ke `.env` di dalam folder `apps/api/`:
```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```
Isi konfigurasi Anda (lihat detail variabel di **Langkah 4** di bawah).

#### 5. Jalankan Container Docker
Build dan jalankan aplikasi secara background:
```bash
docker compose up -d --build
```
Aplikasi API sekarang berjalan di port `3000` di dalam VPS.

---

### Metode B: Menggunakan Node.js, PNPM, & PM2 (Alternatif Tradisional)

Jika Anda tidak ingin menggunakan Docker, Anda bisa menjalankannya langsung di Node.js host.

#### 1. Install Node.js v22 & PNPM
Install Node.js menggunakan Node Source (atau NVM):
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Install **PNPM** secara global:
```bash
npm install -g pnpm
```
Install **PM2** secara global untuk manajemen proses Node:
```bash
npm install -g pm2
```

#### 2. Kloning dan Install Dependencies
```bash
mkdir -p /var/www && cd /var/www
git clone <URL_REPOSITORI_ANDA> safeher
cd safeher
pnpm install --frozen-lockfile
```

#### 3. Konfigurasi `.env`
```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

#### 4. Build Proyek Monorepo
Build shared library dan API package:
```bash
pnpm --filter @aegis/shared build
pnpm --filter @aegis/api build
```

#### 5. Jalankan dengan PM2
Jalankan aplikasi Hono melalui PM2 agar terus berjalan di latar belakang:
```bash
# Jalankan app
pm2 start "pnpm --filter @aegis/api start" --name safeher-api

# Simpan proses agar otomatis berjalan saat VPS reboot
pm2 save
pm2 startup
```

---

## Langkah 4: Pengisian File `.env` Produksi

Saat mengisi file `.env` di `apps/api/.env`, pastikan data berikut terisi dengan benar:

```env
PORT=3000
NODE_ENV=production

# Supabase URL & Keys (Gunakan credential Production Supabase Anda)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...

# OpenRouter (Konfigurasi AI untuk Incident Trigger Context)
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=google/gemini-3-flash-preview
OPENROUTER_SITE_URL=https://api.domainanda.com
OPENROUTER_APP_NAME=SafeHer

# Firebase Cloud Messaging (Pastikan private key aman tanpa whitespace ganda)
FIREBASE_PROJECT_ID=safeher-xxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@safeher-xxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBAQ... (gunakan \n untuk newline) ...-----END PRIVATE KEY-----\n"
```

> [!IMPORTANT]
> **Penting untuk Firebase Private Key:**
> Pastikan nilai `FIREBASE_PRIVATE_KEY` diapit oleh tanda kutip ganda (`"`) dan baris baru diganti dengan penulisan literal `\n`. Kode parser env API Anda ([env.ts](file:///home/yudaclairee/project/safeher/apps/api/src/lib/env.ts)) sudah otomatis merubah teks `\n` tersebut menjadi baris baru asli.

---

## Langkah 5: Konfigurasi Reverse Proxy Nginx

Nginx digunakan untuk menerima lalu lintas port `80`/`443` dari publik dan meneruskannya ke port `3000` (port API SafeHer yang berjalan secara lokal).

### 1. Install Nginx
```bash
sudo apt install nginx -y
```

### 2. Buat File Konfigurasi Server Block
Buat konfigurasi virtual host baru:
```bash
sudo nano /etc/nginx/sites-available/safeher-api
```

Tempelkan konfigurasi berikut (sesuaikan `server_name` dengan subdomain/domain Anda):

```nginx
server {
    listen 80;
    server_name api.domainanda.com; # Ganti dengan domain/subdomain Anda

    # Peningkatan batasan upload payload (untuk fitur upload audio/media SOS)
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Header untuk websocket & keep-alive
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Teruskan IP Asli dari Cloudflare ke API
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Aktifkan Konfigurasi & Restart Nginx
Hubungkan file konfigurasi tersebut ke folder `sites-enabled`:
```bash
sudo ln -s /etc/nginx/sites-available/safeher-api /etc/nginx/sites-enabled/
```
Uji apakah sintaks konfigurasi Nginx sudah benar:
```bash
sudo nginx -t
```
Jika tidak ada error (`syntax is ok`), restart layanan Nginx:
```bash
sudo systemctl restart nginx
```

---

## Langkah 6: Mengamankan Koneksi HTTPS (SSL)

Untuk menyempurnakan integrasi Cloudflare dan mengamankan lalu lintas API Anda, pilih salah satu dari dua cara berikut:

### Opsi 1: Menggunakan Let's Encrypt Certbot (Gratis & Paling Umum)
Ini sangat bagus jika Anda ingin server VPS Anda memiliki sertifikat SSL yang valid secara mandiri.
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.domainanda.com
```
Ikuti petunjuk di layar. Certbot akan memperbarui konfigurasi Nginx secara otomatis dan mengaktifkan SSL di port 443.
Setelah terpasang, ubah mode SSL/TLS di Cloudflare menjadi **Full** atau **Full (strict)**.

### Opsi 2: Menggunakan Cloudflare Origin Certificate (Direkomendasikan untuk Integrasi Cloudflare Maksimal)
Ini adalah sertifikat gratis dari Cloudflare yang dipasang di VPS Anda, sehingga hanya Cloudflare yang dapat berkomunikasi dengan VPS Anda dengan enkripsi penuh.
1. Di dashboard Cloudflare domain Anda, buka **SSL/TLS** -> **Origin Server**.
2. Klik **Create Certificate**.
3. Klik **Create** (default RSA 2048, validitas 15 tahun).
4. Cloudflare akan menampilkan **Origin Certificate** (PEM) dan **Private Key**.
5. Di VPS Anda, buat dua file untuk menyimpan sertifikat tersebut:
   ```bash
   sudo mkdir -p /etc/ssl/cloudflare
   sudo nano /etc/ssl/cloudflare/origin.pem    # Paste Origin Certificate disini
   sudo nano /etc/ssl/cloudflare/private.key   # Paste Private Key disini
   sudo chmod 600 /etc/ssl/cloudflare/private.key
   ```
6. Edit konfigurasi Nginx Anda untuk menyertakan sertifikat tersebut di port 443:
   ```nginx
   server {
       listen 80;
       server_name api.domainanda.com;
       return 301 https://$host$request_uri; # Redirect HTTP ke HTTPS
   }

   server {
       listen 443 ssl http2;
       server_name api.domainanda.com;

       ssl_certificate /etc/ssl/cloudflare/origin.pem;
       ssl_certificate_key /etc/ssl/cloudflare/private.key;

       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;

       client_max_body_size 20M;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
7. Test dan restart Nginx:
   ```bash
   sudo nginx -t && sudo systemctl restart nginx
   ```
8. Pastikan di dashboard Cloudflare, menu **SSL/TLS Overview** diset ke **Full (strict)**.

---

## Langkah 7: Pemeliharaan (Maintenance) & Log Monitor

### Jika menggunakan Docker:
* **Melihat Log Realtime API**:
  ```bash
  docker compose logs -f api
  ```
* **Restart API**:
  ```bash
  docker compose restart api
  ```
* **Update Versi Baru (Mengambil perubahan dari git)**:
  ```bash
  git pull origin main
  docker compose up -d --build
  ```

### Jika menggunakan PM2:
* **Melihat Log**:
  ```bash
  pm2 logs safeher-api
  ```
* **Restart API**:
  ```bash
  pm2 restart safeher-api
  ```
* **Update Versi Baru**:
  ```bash
  git pull origin main
  pnpm install --frozen-lockfile
  pnpm --filter @aegis/shared build
  pnpm --filter @aegis/api build
  pm2 restart safeher-api
  ```

---
🛡️ **SafeHer Deployment Guide Selesai.** Aplikasi Anda sekarang aman di-proxy oleh Cloudflare, dilayani oleh Nginx di VPS DigitalOcean, dan berjalan dengan andal di port local 3000!
