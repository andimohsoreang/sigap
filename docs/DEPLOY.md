# Panduan Deploy SIGAP

Target: **nginx + php-fpm + sqlite/MySQL + Reverb + queue worker + scheduler**.
Server prod yang lama (`app1.andimohamad.my.id`) — cutover dijelaskan di bagian terakhir.

---

## 1. Persiapan server

```bash
# PHP 8.4 + ekstensi (sury.org/ondrej PPA untuk Ubuntu 22.04)
sudo apt install php8.4-cli php8.4-fpm php8.4-sqlite3 php8.4-mbstring php8.4-xml \
  php8.4-curl php8.4-zip php8.4-gd php8.4-bcmath php8.4-intl php8.4-pcntl php8.4-redis
sudo apt install nginx sqlite3 composer nodejs npm
```

Ambil kode (misal ke `/var/www/sigap`), lalu:

```bash
cd /var/www/sigap
composer install --no-dev --optimize-autoloader
npm ci && npm run build                # hasil: public/build
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
chmod -R 775 storage bootstrap/cache database
```

## 2. Konfigurasi `.env` produksi

```dotenv
APP_NAME=SIGAP
APP_ENV=production
APP_DEBUG=false
APP_URL=https://app1.andimohamad.my.id

APP_LOCALE=id
APP_FALLBACK_LOCALE=id
APP_TIMEZONE=Asia/Jakarta

DB_CONNECTION=sqlite
# DB_DATABASE=/var/www/sigap/database/database.sqlite

SESSION_DRIVER=database
SESSION_DOMAIN=app1.andimohamad.my.id
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_COOKIE=SIGAP_SESSION
SANCTUM_STATEFUL_DOMAINS=app1.andimohamad.my.id,staging-app1.andimohamad.my.id

BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database
CACHE_STORE=database
FILESYSTEM_DISK=local

# SMTP kementerian — WAJIB diisi agar notifikasi D10 (email) terkirim
MAIL_MAILER=smtp
MAIL_HOST=mail.kemen.go.id
MAIL_PORT=465
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=sigap@kemen.go.id
MAIL_FROM_NAME="SIGAP"

REVERB_APP_ID=sigap
REVERB_APP_KEY=<acak 20+ karakter>
REVERB_APP_SECRET=<acak 40+ karakter>
REVERB_HOST=app1.andimohamad.my.id
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8080

RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
```

Catatan penting:

- `MAIL_MAILER=log` hanya untuk dev. Produksi harus `smtp`.
- `APP_DEBUG=false` — `SecurityHeaders` memakai CSP **ketat** di `APP_ENV=production`.
- `SANCTUM_STATEFUL_DOMAINS` harus mencakup domain sesungguhnya agar `/api/v1` bisa memakai sesi cookie.

## 3. Migrasi & akun pertama

```bash
php artisan migrate --seed            # master: kategori, kawasan, kanal, pengaturan
php artisan storage:link              # bila lampiran diupload
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan sigap:admin               # BUAT akun super_admin — tidak ada default (SEC-01)
```

## 4. Proses yang harus jalan terus-menerus

| Proses | Perintah | Contoh service |
|---|---|---|
| PHP-FPM | `systemctl status php8.4-fpm` | bawaan OS |
| Reverb (WebSocket) | `php artisan reverb:start --host=127.0.0.1 --port=8080` | `sigap-reverb.service` |
| Queue worker | `php artisan queue:work --tries=3 --max-time=3600` | `sigap-queue.service` |
| Scheduler | cron `* * * * * php artisan schedule:run >/dev/null 2>&1` | — |

Contoh systemd (`/etc/systemd/system/sigap-reverb.service`):

```ini
[Unit]
Description=SIGAP Reverb
After=network.target

[Service]
WorkingDirectory=/var/www/sigap
ExecStart=/usr/bin/php artisan reverb:start --host=127.0.0.1 --port=8080
Restart=always
User=www-data
Environment=APP_ENV=production
Environment=APP_DEBUG=false

[Install]
WantedBy=multi-user.target
```

Salin pola yang sama untuk `sigap-queue.service` (`queue:work`), lalu:

```bash
sudo systemctl enable --now sigap-reverb sigap-queue
```

## 5. nginx (reverse proxy + static)

```nginx
server {
    listen 443 ssl http2;
    server_name app1.andimohamad.my.id;

    ssl_certificate     /etc/letsencrypt/live/app1.andimohamad.my.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app1.andimohamad.my.id/privkey.pem;

    root /var/www/sigap/public;
    index index.php;

    client_max_body_size 10M;          # lampiran ≤ 5 MB + overhead form

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # WebSocket Reverb — proxy ke 127.0.0.1:8080
    location /app {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~* \.(?:css|js|mjs|map|jpg|jpeg|png|webp|gif|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

> Header keamanan utama **bukan** dari nginx melainkan middleware
> `SecurityHeaders` Laravel (SEC-03) — yang di atas hanya lapisan defensif.

## 6. Pengujian sebelum go-live

```bash
php artisan test          # Pest
npm test                  # Vitest
npm run test:e2e          # Playwright (butuh chromium terpasang)
php artisan sigap:sync-channels   # uji adapter STUB + log
curl -s https://app1.andimohamad.my.id/api/v1/health
```

Checklist minimal:

- [ ] `/`, `/katalog`, `/peta`, `/pengaduan/baru`, `/lacak` termuat tanpa error 500.
- [ ] Login admin & warga berhasil; `/admin` memantulkan warga ke `/portal-warga`.
- [ ] Pengaduan publik menghasilkan tiket + riwayat + SLA benar (perbaikan B1/B2).
- [ ] Survei muncul setelah status Selesai dan tersimpan.
- [ ] Notifikasi lonceng admin muncul (Reverb) dan surel masuk (MAIL_MAILER=smtp).
- [ ] CSP produksi tidak memblokir font/aset (uji di browser → tab Console).
- [ ] Akun demo lama (`admin/admin123`, `warga123`) **tidak lagi valid**.

## 7. Cutover (PRD F8)

1. **Staging** dulu: deploy ke `staging-app1.andimohamad.my.id` dengan DB terpisah; uji paritas 14 halaman publik + 9 sub-halaman admin (light/dark, ID/EN).
2. Backup penuh DB lama + `storage` lama; migrasi data (seeder/ekspor-import) sesuai TECH-SPEC §6.
3. Matikan `sigap-api` lama; arahkan DNS/nginx ke stack Laravel.
4. Matikan "MODE DEMO" di mana pun tersisa (blok kredensial plaintext harus dihapus).
5. Pantau `storage/logs/laravel.log` + `php artisan queue:failed` selama 1–2 minggu; jalankan `php artisan schedule:run` via cron.

Rollback: pertahankan backup DB lama & `sigap-api` dalam keadaan siap (jangan dihapus) minimal 30 hari.
