# Panduan Deploy SIGAP

Target produksi: **Cloudflare → nginx (TLS) → PHP-FPM 8.4 + Reverb**, database
**PostgreSQL 16**, queue worker + scheduler di bawah systemd/supervisor.

| Lingkungan | Domain | Server |
|---|---|---|
| Produksi | `app1.andimohamad.my.id` | `/var/www/sigap` (DB `sigap`) |
| Staging | `staging-app1.andimohamad.my.id` | `/var/www/sigap-staging` (DB `sigap_staging`, app id/key Reverb berbeda) |

Urutan wajib: **server (§1) → database (§2) → `.env` (§3) → build (§4) → Cloudflare & nginx (§5–6) → proses (§7) → firewall & backup (§8–9)**.
Rilis berikutnya dan rollback ada di §10.

> **Pihak ketiga yang dipakai halaman** (diizinkan CSP): `fonts.bunny.net` (font Inter),
> `*.tile.openstreetmap.org` (peta Leaflet), dan Google reCAPTCHA v3
> (`www.google.com/recaptcha`, `www.gstatic.com/recaptcha`) bila `RECAPTCHA_SITE_KEY` diisi.
> Tidak ada CDN lain. Bila salah satunya diganti, sesuaikan `App\Http\Middleware\SecurityHeaders`.

---

## 1. Persiapan server

```bash
# PHP 8.4 + ekstensi (PPA ondrej/sury untuk Ubuntu 22.04/24.04)
sudo apt install php8.4-cli php8.4-fpm php8.4-pgsql php8.4-mbstring php8.4-xml \
  php8.4-curl php8.4-zip php8.4-gd php8.4-bcmath php8.4-intl php8.4-pcntl php8.4-redis
sudo apt install nginx postgresql-16 redis-server supervisor composer restic
# Node 22 LTS hanya untuk build aset (boleh di mesin CI lalu salin public/build).

# Pengguna deploy (bukan root) — anggota grup www-data agar dapat membaca .env
# (root:www-data 640) dan menulis storage/bootstrap/cache (www-data, g=rwX).
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG www-data deploy
sudo install -d -o deploy -g www-data -m 2750 /var/www/sigap /var/www/sigap/releases /var/www/sigap/shared
sudo install -d -o www-data -g www-data -m 2770 /var/www/sigap/shared/storage
```

Model izin yang dipakai di SEMUA langkah rilis (§4, §10.2):

| Path | Pemilik | Mode |
|---|---|---|
| `releases/<rilis>/` (kode, vendor, build) | `deploy:www-data` | `u=rwX,g=rX,o=` |
| `shared/.env` | `root:www-data` | `640` (dibaca grup: PHP-FPM & pengguna deploy) |
| `shared/storage/`, `releases/<rilis>/bootstrap/cache/` | `www-data:www-data` | `ug=rwX,o=` + setgid direktori |

Perintah `artisan` di server selalu dijalankan sebagai **`sudo -u www-data php artisan …`**
agar berkas cache/log yang dibuat dimiliki `www-data` (bukan root/deploy).

### 1.1 PHP-FPM (`/etc/php/8.4/fpm/conf.d/99-sigap.ini`)

Batas unggah diselaraskan dengan validasi Laravel (`attachment` `max:5120` = 5 MB di
`StorePengaduanRequest`, `StorePengaduanInternalRequest`, `StoreInputManualRequest`)
dan nginx `client_max_body_size 12m`:

```ini
upload_max_filesize = 6M      ; 5 MB lampiran + sedikit ruang
post_max_size = 12M           ; seluruh body multipart (field + lampiran)
max_file_uploads = 5
memory_limit = 256M
max_execution_time = 30
expose_php = Off
cgi.fix_pathinfo = 0
opcache.enable = 1
opcache.validate_timestamps = 0   ; rilis memakai symlink baru + reload php-fpm
```

`sudo systemctl reload php8.4-fpm` setelah mengubahnya.

---

## 2. PostgreSQL 16 & Redis (hanya 127.0.0.1)

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE sigap LOGIN PASSWORD '<kata-sandi-acak>';
CREATE DATABASE sigap OWNER sigap ENCODING 'UTF8';
CREATE ROLE sigap_staging LOGIN PASSWORD '<kata-sandi-acak-lain>';
CREATE DATABASE sigap_staging OWNER sigap_staging ENCODING 'UTF8';
SQL
```

- `/etc/postgresql/16/main/postgresql.conf`: `listen_addresses = 'localhost'`, `password_encryption = scram-sha-256`.
- `pg_hba.conf`: hanya `host sigap sigap 127.0.0.1/32 scram-sha-256` (dan `::1/128`) — tanpa entri `0.0.0.0/0`.
- `DB_SSLMODE=prefer` (default `config/database.php`) cukup selama DB di mesin yang sama.
  **Bila DB dipindah ke host lain**: aktifkan TLS di server PostgreSQL lalu set
  `DB_SSLMODE=verify-full` + `DB_SSLROOTCERT=/etc/ssl/certs/<ca-db>.pem` (mencegah MITM).

Redis (opsional — untuk cache/sesi/queue; driver `database` juga didukung):

```conf
# /etc/redis/redis.conf
bind 127.0.0.1 ::1
protected-mode yes
port 6379
requirepass <kata-sandi-acak-panjang>
```

Isi `REDIS_PASSWORD` di `.env` dengan nilai yang sama. Tanpa Redis, biarkan
`CACHE_STORE=database`, `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database`.

---

## 3. Konfigurasi `.env` produksi

> **Tulis `.env` SEBELUM `npm run build`.** Variabel `VITE_*` (key & host Reverb)
> ditanam ke JavaScript saat build; build dengan `.env` lokal membuat browser
> mencoba `ws://localhost:8080` dan realtime mati di produksi. Bila key kosong,
> aplikasi tetap jalan (realtime dilewati, UI kembali ke polling).

```dotenv
APP_NAME=SIGAP
APP_ENV=production
APP_DEBUG=false
APP_URL=https://app1.andimohamad.my.id
APP_LOCALE=id
APP_FALLBACK_LOCALE=id
APP_TIMEZONE=Asia/Jakarta
# APP_KEY diisi `key:generate` (§4). Rotasi: kunci lama pindah ke APP_PREVIOUS_KEYS.
APP_PREVIOUS_KEYS=
# Kunci blind index NIK (login & keunikan NIK) — TERPISAH dari APP_KEY dan WAJIB di produksi.
# Buat sekali: php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
NIK_HASH_KEY=base64:<acak 32 byte>

# nginx memulihkan IP asli dari CF-Connecting-IP (§6.1); Laravel hanya percaya localhost.
TRUSTED_PROXIES=127.0.0.1

LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
LOG_DAILY_DAYS=14

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=sigap
DB_USERNAME=sigap
DB_PASSWORD=<rahasia>
DB_SSLMODE=prefer

SESSION_DRIVER=database          # atau redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=true
SESSION_DOMAIN=null              # host-only: cookie prod tidak terkirim ke staging
SESSION_COOKIE=sigap_session

CACHE_STORE=database             # atau redis
QUEUE_CONNECTION=database        # atau redis — surel & broadcast di-queue, worker WAJIB jalan (§7)
FILESYSTEM_DISK=local            # lampiran di storage/app/private (tidak dilayani publik)
REDIS_PASSWORD=<sama dengan requirepass>

SANCTUM_STATEFUL_DOMAINS=app1.andimohamad.my.id
SANCTUM_EXPIRATION=10080         # token Bearer kedaluwarsa 7 hari

# SMTP kementerian — WAJIB agar notifikasi surel terkirim
MAIL_MAILER=smtp
MAIL_HOST=mail.kemen.go.id
MAIL_PORT=465
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=sigap@kemen.go.id
MAIL_FROM_NAME="SIGAP"

# --- Reverb: sisi SERVER (PHP → Reverb lokal, tidak lewat internet) ---
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=sigap
REVERB_APP_KEY=<acak 32 heks>
REVERB_APP_SECRET=<acak 64 heks>
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http
REVERB_SERVER_HOST=127.0.0.1     # reverb:start hanya bind localhost
REVERB_SERVER_PORT=8080
REVERB_ALLOWED_ORIGINS=app1.andimohamad.my.id
REVERB_APP_MAX_CONNECTIONS=1000
REVERB_APP_RATE_LIMITING_ENABLED=true

# --- Reverb: sisi BROWSER (wss lewat Cloudflare → nginx :443 → Reverb) ---
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST=app1.andimohamad.my.id
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https

RECAPTCHA_SITE_KEY=<site key v3>
RECAPTCHA_SECRET_KEY=<secret key v3>
RECAPTCHA_MIN_SCORE=0.5
```

Staging: salin dengan `APP_ENV=staging`; `APP_URL`, `VITE_REVERB_HOST`, `REVERB_ALLOWED_ORIGINS`,
`SANCTUM_STATEFUL_DOMAINS` = `staging-app1.andimohamad.my.id`; DB `sigap_staging`;
**key/secret Reverb berbeda**; Reverb pada port lain (mis. 8081, juga di nginx staging).

Catatan:

- `APP_ENV=production` mengaktifkan CSP ketat berbasis **nonce** (`SecurityHeaders`):
  script hanya dari `'self'` + nonce per-request; `connect-src` hanya `'self'` dan
  `wss://app1.andimohamad.my.id` (diturunkan dari `VITE_REVERB_*`).
- `SESSION_SECURE_COOKIE` default-nya otomatis `true` bila `APP_ENV=production`, tetapi tetap tulis eksplisit.
- `.env` milik `root:www-data` mode `640` (dibaca grup `www-data`: PHP-FPM & pengguna `deploy`). Jangan pernah commit `.env.*` (sudah di `.gitignore`).
- **`NIK_HASH_KEY` jangan pernah diubah tanpa rehash.** NIK disimpan terenkripsi (APP_KEY)
  dan dicari lewat blind index HMAC berkunci `NIK_HASH_KEY`. Bila kunci ini berubah, login
  dengan NIK & cek NIK ganda rusak sampai `sudo -u www-data php artisan sigap:rehash-nik --force`
  dijalankan (membaca NIK terdekripsi lalu menulis ulang `nik_hash`/`reporter_nik_hash`
  per-chunk dalam satu transaksi). Tanpa `NIK_HASH_KEY`, aplikasi produksi menolak jalan
  dengan pesan galat yang jelas.
- **Rotasi `APP_KEY`**: pindahkan kunci lama ke `APP_PREVIOUS_KEYS` (dipisah koma) lalu isi
  `APP_KEY` baru — data terenkripsi lama tetap terbaca dan blind index NIK tidak terpengaruh
  (kunci terpisah). Simpan semua kunci di brankas.
- `APP_ENV` selain `local`/`testing` (termasuk staging) mengaktifkan CSP ketat berbasis nonce.

---

## 4. Build & instalasi pertama (struktur rilis)

Struktur direktori dipakai agar rilis atomik dan rollback cepat:

```
/var/www/sigap/
├── current -> releases/20261012-0900/sigap   # symlink ke folder aplikasi (dilayani nginx)
├── releases/20261012-0900/               # root repo (docs/ + sigap/: kode, vendor, public/build)
└── shared/
    ├── .env
    └── storage/                          # app/private (lampiran), logs, framework
```

Jalankan sebagai pengguna `deploy` (anggota grup `www-data`, §1):

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE=/var/www/sigap
R=$BASE/releases/$(date +%Y%m%d-%H%M)
git clone --depth 1 --branch main <repo> "$R"
APP="$R/sigap"                      # root repo = folder induk berisi docs/ dan sigap/
cd "$APP"
ln -s $BASE/shared/.env .env
rm -rf storage && ln -s $BASE/shared/storage storage

composer install --no-dev --optimize-autoloader --no-interaction
npm ci && npm run build            # .env (shared) SUDAH final — lihat §3

# Izin rilis (diulang setiap rilis — lihat tabel §1)
sudo chown -R deploy:www-data "$R"
sudo chmod -R u=rwX,g=rX,o= "$R"
sudo chown -R www-data:www-data $BASE/shared/storage "$APP/bootstrap/cache"
sudo chmod -R ug=rwX,o= $BASE/shared/storage "$APP/bootstrap/cache"
sudo find $BASE/shared/storage "$APP/bootstrap/cache" -type d -exec chmod g+s {} +
sudo chown root:www-data $BASE/shared/.env && sudo chmod 640 $BASE/shared/.env

# HANYA instalasi pertama: tampilkan APP_KEY, lalu tempel ke .env sebagai root & simpan di brankas
#   sudo -u www-data php artisan key:generate --show
sudo -u www-data php artisan migrate --force --seed # seed master: kategori, kawasan, kanal, pengaturan
sudo -u www-data php artisan optimize               # config/route/view/event cache
sudo -u www-data php artisan sigap:admin            # BUAT akun super_admin — tidak ada akun default (SEC-01)

ln -sfn "$APP" $BASE/current
sudo systemctl reload php8.4-fpm
```

> `.env` (root:www-data 640) tidak dapat ditulis `www-data`, karena itu `APP_KEY` dibuat
> dengan `--show` lalu disunting sebagai root. `NIK_HASH_KEY` juga diisi manual (§3)
> SEBELUM `migrate --seed`, dan tidak boleh berubah tanpa `sigap:rehash-nik`.

> **Tidak ada `php artisan storage:link`.** Lampiran pengaduan disimpan di disk privat
> `local` (`storage/app/private`, `serve => false`) dan hanya diunduh lewat controller
> yang memeriksa otorisasi (admin/warga pemilik). Jangan membuat symlink `public/storage`.

---

## 5. Cloudflare

- DNS `app1` & `staging-app1`: **Proxied** (awan oranye). SSL/TLS mode **Full (strict)**
  dengan **Cloudflare Origin Certificate** di nginx (§6.3).
- **Authenticated Origin Pulls** (mTLS) aktif — nginx menolak koneksi TLS yang bukan dari Cloudflare (§6.3).
- Network → **WebSockets: On**. "Always Use HTTPS": On.
- Staging: lindungi dengan **Cloudflare Access** (direkomendasikan; login email kementerian)
  atau Basic Auth nginx (§6.4), plus `X-Robots-Tag: noindex`.
- HSTS dikirim oleh origin (§6.2). Jangan aktifkan "preload" (lihat catatan HSTS §6.3).

---

## 6. nginx

### 6.1 IP asli klien (Cloudflare → nginx → PHP)

`/etc/nginx/conf.d/cloudflare-realip.conf` — rentang resmi Cloudflare
(**salinan per Okt 2026 — WAJIB dicocokkan & disegarkan berkala dari
<https://www.cloudflare.com/ips/>**, mis. job bulanan yang membuat ulang berkas ini dari
`https://www.cloudflare.com/ips-v4` & `ips-v6` lalu `nginx -t && systemctl reload nginx`):

```nginx
# IPv4
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
# IPv6
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
```

**Mengapa di nginx, bukan `TRUSTED_PROXIES=<rentang Cloudflare>`?**
nginx hanya menerima `CF-Connecting-IP` bila koneksi TCP benar-benar datang dari
rentang Cloudflare, lalu menulis ulang `$remote_addr`; PHP menerimanya sebagai
`REMOTE_ADDR` lewat `fastcgi_params`. Dengan begitu log nginx, rate limit Laravel
(`login`, `pengaduan`, `lookup`), audit log, dan verifikasi reCAPTCHA memakai IP
asli tanpa Laravel perlu tahu daftar Cloudflare (satu sumber kebenaran). Laravel cukup
`TRUSTED_PROXIES=127.0.0.1` (pertahanan berlapis bila kelak ada proxy lokal);
header `X-Forwarded-*` dari klien diabaikan karena `REMOTE_ADDR` bukan proxy tepercaya,
dan nginx juga mengosongkannya (§6.3). Jangan pernah `TRUSTED_PROXIES=*` (kode menolaknya).

> Akibat real_ip: `allow/deny` nginx mengevaluasi IP **klien asli**, sehingga
> membatasi origin ke Cloudflare **tidak bisa** dengan `allow <rentang CF>; deny all;`
> di nginx. Gunakan firewall (§8) + Authenticated Origin Pulls (§6.3).

### 6.2 Header keamanan bersama

`/etc/nginx/snippets/sigap-security-headers.conf` — di-`include` di level server **dan
di setiap `location` yang punya `add_header` sendiri** (aturan nginx: `add_header` di
dalam location membuang semua header warisan dari level server):

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(self), camera=(), microphone=()" always;
```

CSP **tidak** diset di nginx: CSP berisi nonce per-request dan dikirim oleh Laravel.
Pada respons PHP, header yang sama dari Laravel disembunyikan (`fastcgi_hide_header`)
agar tidak terkirim dobel.

### 6.3 Server block produksi

`/etc/nginx/sites-available/sigap.conf`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name app1.andimohamad.my.id;
    server_tokens off;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name app1.andimohamad.my.id;
    server_tokens off;

    # Cloudflare Origin Certificate (mode Full strict)
    ssl_certificate     /etc/ssl/cloudflare/app1.andimohamad.my.id.pem;
    ssl_certificate_key /etc/ssl/cloudflare/app1.andimohamad.my.id.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Authenticated Origin Pulls: hanya Cloudflare yang punya sertifikat klien ini.
    # CA: https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
    ssl_client_certificate /etc/ssl/cloudflare/origin-pull-ca.pem;
    ssl_verify_client on;

    root /var/www/sigap/current/public;
    index index.php;
    charset utf-8;

    # Selaras dengan php-fpm post_max_size=12M & validasi lampiran 5 MB.
    client_max_body_size 12m;

    include snippets/sigap-security-headers.conf;

    access_log /var/log/nginx/sigap.access.log;
    error_log  /var/log/nginx/sigap.error.log warn;

    # Berkas tersembunyi (.env, .git, .htaccess, …) — kecuali ACME .well-known.
    location ~ /\.(?!well-known) {
        deny all;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Aset Vite ber-hash: cache selamanya. include ulang header keamanan!
    location ^~ /build/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        include snippets/sigap-security-headers.conf;
        access_log off;
    }

    location ~* \.(?:ico|png|jpe?g|webp|gif|svg|woff2?)$ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, max-age=604800" always;
        include snippets/sigap-security-headers.conf;
        access_log off;
    }

    # WebSocket Reverb (Pusher protocol: /app/{key}) → 127.0.0.1:8080
    location ~ ^/app/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;     # > ping_interval (60 s) + activity_timeout (30 s)
        proxy_buffering off;
    }

    # HTTP API Reverb (/apps/{id}/events) hanya untuk publikasi server.
    # PHP mempublikasikan langsung ke 127.0.0.1:8080, jadi dari luar selalu ditolak.
    location ^~ /apps/ {
        allow 127.0.0.1;
        allow ::1;
        deny all;
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
    }

    # Hanya front controller yang dieksekusi.
    location = /index.php {
        try_files $uri =404;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        include fastcgi_params;            # REMOTE_ADDR = IP asli (real_ip §6.1)
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        fastcgi_param HTTPS on;
        # Abaikan header forwarding dari klien (Laravel juga tidak mempercayainya).
        fastcgi_param HTTP_X_FORWARDED_FOR "";
        fastcgi_param HTTP_X_FORWARDED_HOST "";
        fastcgi_param HTTP_X_FORWARDED_PORT "";
        fastcgi_param HTTP_X_FORWARDED_PROTO "";
        fastcgi_hide_header X-Powered-By;
        # Header ini sudah dikirim nginx (snippet) — cegah duplikasi dari Laravel.
        fastcgi_hide_header Strict-Transport-Security;
        fastcgi_hide_header X-Content-Type-Options;
        fastcgi_hide_header X-Frame-Options;
        fastcgi_hide_header Referrer-Policy;
        fastcgi_hide_header Permissions-Policy;
        fastcgi_read_timeout 60s;
    }

    location ~ \.php$ {
        return 404;
    }
}
```

`$realpath_root` membuat PHP-FPM memakai path rilis yang **sudah di-resolve**, sehingga
pergantian symlink `current` langsung berlaku (bersama `opcache.validate_timestamps=0`
+ `systemctl reload php8.4-fpm`).

**HSTS.** `includeSubDomains` di `app1.andimohamad.my.id` hanya mencakup
`*.app1.andimohamad.my.id` (bukan saudara `staging-app1`). `preload` **sengaja tidak**
dipasang: daftar preload hanya menerima domain apex (`andimohamad.my.id`) dan berlaku untuk
semua subdomain tanpa bisa ditarik cepat — aktifkan hanya bila seluruh subdomain sudah
HTTPS-only dan pemilik domain setuju.

### 6.4 Staging

Salin blok di atas dengan `server_name staging-app1.andimohamad.my.id`, root
`/var/www/sigap-staging/current/public`, Reverb ke port `8081`. Bila tidak memakai
Cloudflare Access, tambahkan Basic Auth di level server:

```nginx
    auth_basic "SIGAP Staging";
    auth_basic_user_file /etc/nginx/.htpasswd-sigap-staging;   # htpasswd -B (bcrypt)
    add_header X-Robots-Tag "noindex, nofollow" always;        # juga di tiap location ber-add_header
```

Monitor health (`/api/v1/health`, `/up`) boleh dikecualikan dengan `location` khusus berisi `auth_basic off;`.

```bash
sudo ln -s /etc/nginx/sites-available/sigap.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Proses latar (systemd / supervisor)

Queue **wajib** berjalan: surel notifikasi dan broadcast Reverb di-queue.

| Proses | Perintah | Unit |
|---|---|---|
| PHP-FPM | — | `php8.4-fpm.service` (bawaan) |
| Reverb | `php artisan reverb:start --host=127.0.0.1 --port=8080` | `sigap-reverb.service` |
| Queue worker | `php artisan queue:work --tries=3 --backoff=10 --max-time=3600 --sleep=3` | `sigap-queue.service` |
| Scheduler | `php artisan schedule:run` tiap menit (sync kanal 06:00, EWS 07:00) | `sigap-scheduler.timer` |

`/etc/systemd/system/sigap-reverb.service`:

```ini
[Unit]
Description=SIGAP Reverb (WebSocket)
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/sigap/current
ExecStart=/usr/bin/php artisan reverb:start --host=127.0.0.1 --port=8080
Restart=always
RestartSec=3
LimitNOFILE=10000
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/sigap-queue.service`:

```ini
[Unit]
Description=SIGAP queue worker
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/sigap/current
ExecStart=/usr/bin/php artisan queue:work --tries=3 --backoff=10 --max-time=3600 --sleep=3
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/sigap-scheduler.service` dan `sigap-scheduler.timer`:

```ini
# sigap-scheduler.service
[Unit]
Description=SIGAP scheduler (schedule:run)

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/var/www/sigap/current
ExecStart=/usr/bin/php artisan schedule:run --no-interaction
```

```ini
# sigap-scheduler.timer
[Unit]
Description=SIGAP scheduler tiap menit

[Timer]
OnCalendar=*-*-* *:*:00
AccuracySec=1s
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sigap-reverb sigap-queue sigap-scheduler.timer
```

Setiap rilis: `php artisan queue:restart` dan `sudo systemctl restart sigap-reverb`
(proses lama tetap memakai kode lama sampai di-restart). Alternatif supervisor:
program `sigap-queue` dengan `command=php /var/www/sigap/current/artisan queue:work --tries=3 --max-time=3600`,
`user=www-data`, `autorestart=true`, `stopwaitsecs=3600`.

---

## 8. Firewall (ufw)

Reverb (8080), PostgreSQL (5432), dan Redis (6379) **hanya** bind `127.0.0.1` — tidak dibuka di firewall.

```bash
#!/usr/bin/env bash
set -euo pipefail

ADMIN_IP="${ADMIN_IP:-}"               # IP/CIDR VPN/bastion admin, mis. ADMIN_IP=203.0.113.10/32
if [[ -z "$ADMIN_IP" ]]; then
  echo "ADMIN_IP kosong — batal (SSH bisa terkunci)." >&2
  exit 1
fi

# 1) Ambil rentang Cloudflare ke berkas; batal bila kosong/gagal.
CF=$(mktemp)
trap 'rm -f "$CF"' EXIT
curl -fsS https://www.cloudflare.com/ips-v4 >  "$CF"
echo                                     >> "$CF"
curl -fsS https://www.cloudflare.com/ips-v6 >> "$CF"
sed -i '/^[[:space:]]*$/d' "$CF"
if [[ ! -s "$CF" ]]; then
  echo "Daftar IP Cloudflare kosong — batal." >&2
  exit 1
fi

# 2) SSH DULU agar sesi admin tidak terputus.
sudo ufw allow from "$ADMIN_IP" to any port 22 proto tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3) 80/443 hanya dari Cloudflare (sumber sama dengan §6.1; jalankan ulang saat daftar berubah)
while read -r net; do
  sudo ufw allow from "$net" to any port 80,443 proto tcp
done < "$CF"

# 4) Tinjau sebelum mengaktifkan.
sudo ufw show added
sudo ufw status numbered || true
echo "PERINGATAN: pastikan aturan SSH dari $ADMIN_IP ada di atas sebelum mengaktifkan."
read -r -p "Aktifkan ufw sekarang? [y/N] " ok
[[ "$ok" == "y" ]] && sudo ufw enable
sudo ufw status numbered
sudo ss -tlnp | grep -E ':(5432|6379|8080)\b' || true   # harus 127.0.0.1/::1 saja
```

SSH: `PasswordAuthentication no`, `PermitRootLogin no`, fail2ban untuk `sshd`.

---

## 9. Backup terenkripsi off-site

Harian pukul 02:00: dump PostgreSQL + lampiran privat (`storage/app/private`) + `.env`,
dienkripsi & dideduplikasi oleh **restic** ke penyimpanan off-site (S3-compatible/B2/SFTP lain,
bukan server yang sama). Kata sandi repo restic disimpan di brankas terpisah dari server.

`/usr/local/bin/sigap-backup` (mode 700, milik root):

```bash
#!/usr/bin/env bash
set -euo pipefail
export RESTIC_REPOSITORY="s3:https://<endpoint>/<bucket>/sigap"
export RESTIC_PASSWORD_FILE=/root/.restic-sigap-pass
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...

# 1) Database (format custom; konsisten tanpa menghentikan aplikasi)
sudo -u postgres pg_dump --format=custom --no-owner sigap \
  | restic backup --stdin --stdin-filename sigap.dump --tag db

# 2) Lampiran pengaduan (privat) + .env (berisi APP_KEY — tanpanya data terenkripsi tak terbaca)
restic backup /var/www/sigap/shared/storage/app/private /var/www/sigap/shared/.env --tag files

# 3) Retensi: 14 harian, 8 mingguan, 12 bulanan
restic forget --prune --keep-daily 14 --keep-weekly 8 --keep-monthly 12
restic check --read-data-subset=5%
```

Jadwalkan dengan systemd timer `OnCalendar=*-*-* 02:00:00` dan pasang alert bila gagal.

**Uji restore (wajib bulanan & sebelum go-live):**

```bash
#!/usr/bin/env bash
set -euo pipefail
restic snapshots --tag db
restic dump latest sigap.dump --tag db > /tmp/sigap.dump
sudo -u postgres createdb sigap_restore_test
sudo -u postgres pg_restore --no-owner --dbname=sigap_restore_test /tmp/sigap.dump
sudo -u postgres psql sigap_restore_test -c "select count(*) from tickets;"
restic restore latest --tag files --target /tmp/restore-files
ls /tmp/restore-files/var/www/sigap/shared/storage/app/private
sudo -u postgres dropdb sigap_restore_test && rm -rf /tmp/sigap.dump /tmp/restore-files
```

Catat tanggal & hasil uji restore di log operasional.

---

## 10. Rilis berikutnya & rollback

### 10.1 Persiapan (H-1)

- Turunkan TTL DNS `app1` ke 300 detik **24 jam sebelum** cutover/rilis besar (agar
  perpindahan atau pembalikan origin cepat). Kembalikan setelah stabil.
- Pastikan backup terakhir sukses (§9) dan uji restore < 30 hari.
- Uji rilis yang sama di staging.

### 10.2 Langkah rilis

Jalankan sebagai pengguna `deploy` (§1). Skrip berhenti pada galat pertama.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE=/var/www/sigap
R=$BASE/releases/$(date +%Y%m%d-%H%M)
git clone --depth 1 --branch <tag-rilis> <repo> "$R"
APP="$R/sigap"
cd "$APP"
ln -s $BASE/shared/.env .env
rm -rf storage && ln -s $BASE/shared/storage storage
composer install --no-dev --optimize-autoloader --no-interaction
npm ci && npm run build

# Izin rilis — diterapkan ulang SETIAP rilis (tabel §1)
sudo chown -R deploy:www-data "$R"
sudo chmod -R u=rwX,g=rX,o= "$R"
sudo chown -R www-data:www-data $BASE/shared/storage "$APP/bootstrap/cache"
sudo chmod -R ug=rwX,o= $BASE/shared/storage "$APP/bootstrap/cache"
sudo find $BASE/shared/storage "$APP/bootstrap/cache" -type d -exec chmod g+s {} +
sudo chown root:www-data $BASE/shared/.env && sudo chmod 640 $BASE/shared/.env

# Mode perawatan dengan secret bypass (petugas tetap bisa menguji):
sudo -u www-data php $BASE/current/artisan down --secret="<token-acak>" --retry=60
#   → buka https://app1.andimohamad.my.id/<token-acak> untuk cookie bypass

# Backup DB tepat sebelum migrasi — direktori 0700 milik postgres
BACKUP_DIR=/var/backups/sigap
sudo install -d -o postgres -g postgres -m 0700 "$BACKUP_DIR"
DUMP="$BACKUP_DIR/pre-migrate-$(date +%F-%H%M).dump"
sudo -u postgres pg_dump -Fc -f "$DUMP" sigap
sudo -u postgres pg_restore --list "$DUMP" > /dev/null   # dump terbaca
echo "Backup pra-migrasi: $DUMP"

sudo -u www-data php artisan migrate --force
sudo -u www-data php artisan optimize
ln -sfn "$APP" $BASE/current
sudo systemctl reload php8.4-fpm
sudo -u www-data php artisan queue:restart && sudo systemctl restart sigap-reverb
sudo -u www-data php artisan up

curl -fsS https://app1.andimohamad.my.id/api/v1/health
ls -1dt $BASE/releases/* | tail -n +6 | xargs -r sudo rm -rf   # simpan 5 rilis terakhir
```

### 10.3 Rollback

1. **Kode saja** (tanpa migrasi / migrasi kompatibel mundur):
   `ln -sfn /var/www/sigap/releases/<rilis-sebelumnya>/sigap /var/www/sigap/current && sudo systemctl reload php8.4-fpm && sudo -u www-data php /var/www/sigap/current/artisan queue:restart && sudo systemctl restart sigap-reverb`.
2. **Dengan migrasi**: `sudo -u www-data php artisan down --secret=...`; dari rilis baru jalankan
   `sudo -u www-data php artisan migrate:rollback --step=<n> --force` bila `down()` aman; bila tidak, pulihkan dump pra-migrasi:
   `sudo -u postgres pg_restore --clean --if-exists --no-owner -d sigap /var/backups/sigap/pre-migrate-<tanggal>.dump`,
   lalu langkah 1 dan `sudo -u www-data php artisan up`.
3. **Cutover dari sistem lama**: arahkan kembali origin/DNS Cloudflare ke server lama
   (TTL sudah rendah). Simpan server lama + backup DB lama siap pakai minimal 30 hari.

---

## 11. Pengujian sebelum go-live

```bash
php artisan test                  # Pest (lihat README "Cek lokal")
npx vitest run && npx tsc --noEmit && npx eslint resources/js
npm run test:e2e                  # Playwright (butuh chromium)
php artisan sigap:sync-channels   # uji adapter STUB + log
curl -s https://app1.andimohamad.my.id/api/v1/health    # {"ok":true,"database":"ok",...}
```

Checklist minimal:

- [ ] `/`, `/katalog`, `/peta`, `/pengaduan/baru`, `/lacak` termuat tanpa error 500 dan **tanpa pelanggaran CSP** di Console browser.
- [ ] `curl -sI https://app1.andimohamad.my.id/ | grep -i content-security` memuat `'nonce-…'` dan `connect-src 'self' wss://app1.andimohamad.my.id`.
- [ ] Realtime: tab Network → WS `wss://app1.andimohamad.my.id/app/<key>` status 101.
- [ ] Login admin & warga; 6× salah sandi beruntun → pesan "Terlalu banyak percobaan".
- [ ] Pengaduan publik (reCAPTCHA v3 aktif) menghasilkan tiket `TKT-YYMMDD-XXXXXX`.
- [ ] `/lacak/<nomor>` menampilkan pelapor tersamar; tiket rahasia → 404.
- [ ] Survei muncul setelah status Selesai dan tersimpan.
- [ ] Notifikasi lonceng (Reverb) muncul dan surel masuk (worker jalan, `php artisan queue:failed` kosong).
- [ ] `https://app1.andimohamad.my.id/.env` → 403; `/storage/...` → 404.
- [ ] `ss -tlnp`: 5432/6379/8080 hanya di 127.0.0.1.
- [ ] Akun demo lama (`admin/admin123`, `warga123`) **tidak lagi valid**.

## 12. Cutover dari sistem lama (PRD F8)

1. **Staging** dulu: deploy ke `staging-app1.andimohamad.my.id` dengan DB terpisah; uji paritas 14 halaman publik + 9 sub-halaman admin (light/dark).
2. Backup penuh DB lama + `storage` lama; migrasi data sesuai TECH-SPEC §6.
3. Turunkan TTL (§10.1), aktifkan mode perawatan, matikan `sigap-api` lama, arahkan origin ke stack Laravel.
4. Hapus "MODE DEMO"/kredensial plaintext di mana pun tersisa.
5. Pantau `storage/logs/laravel-*.log` (harian, simpan 14 hari) + `php artisan queue:failed` selama 1–2 minggu.

Rollback cutover: lihat §10.3 butir 3.
