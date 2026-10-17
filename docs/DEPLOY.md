# Panduan Deploy SIGAP (Docker)

Target: **Cloudflare → Cloudflare Tunnel (`cloudflared`) → container nginx → container PHP-FPM 8.4
+ Reverb**, database **PostgreSQL 16 di container**, queue worker & scheduler sebagai container.
Semua dijalankan dengan **Docker Compose** dari folder `deploy/docker/` repo ini.

> Keputusan pemilik (12 Okt 2026): deploy memakai **Docker**, bukan instalasi native di OS.
> Server sudah menjalankan stack Docker lain (mis. `app1-sigap`, `codeserver-nginx`, `kasm-proxy`)
> dan `cloudflared`. SIGAP baru dipasang sebagai stack terpisah **`app2-sigap`** di
> **`app2.andimohamad.my.id`**, tanpa mengganggu stack yang sudah ada.

| Lingkungan | Domain | Stack Compose | Database |
|---|---|---|---|
| Produksi (baru) | `app2.andimohamad.my.id` | `app2-sigap` (folder mis. `/opt/app2-sigap`) | volume `app2-sigap_pgdata` |
| Staging (opsional) | `staging-app2.andimohamad.my.id` | `app2-sigap-staging` (clone kedua, `WEB_PORT` lain) | volume terpisah |
| Sistem lama | `app1.andimohamad.my.id` | `app1-sigap` (tidak disentuh) | — |

Urutan: **prasyarat (§1) → ambil kode (§2) → `.env` (§3) → instalasi pertama (§4) → Cloudflare Tunnel (§5)
→ verifikasi (§9)**. Operasional, backup, rilis & rollback: §6–8.

> **Pihak ketiga yang dipakai halaman** (diizinkan CSP): `fonts.bunny.net` (font Inter),
> `*.tile.openstreetmap.org` (peta Leaflet), dan Google reCAPTCHA v3
> (`www.google.com/recaptcha`, `www.gstatic.com/recaptcha`) bila `RECAPTCHA_SITE_KEY` diisi.
> Bila salah satunya diganti, sesuaikan `App\Http\Middleware\SecurityHeaders`.

---

## 0. Arsitektur

```
Browser ──HTTPS/WSS──▶ Cloudflare ──Tunnel (koneksi keluar dari server)──▶ cloudflared
                                                                      │ http://127.0.0.1:8092
┌─────────────────────────── stack app2-sigap (jaringan Docker internal) ─────────────────────┐
│  web (nginx, aset publik) ──fastcgi──▶ app (php-fpm 8.4) ──▶ db (postgres:16)                │
│        └──── /app/* (WebSocket) ──▶ reverb (reverb:start :8080)                              │
│  queue (queue:work)   scheduler (schedule:work)        volume: storage, pgdata              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Service | Image | Fungsi |
|---|---|---|
| `web` | `sigap-web` (nginx + `public/`) | satu-satunya port yang dipublikasikan: `127.0.0.1:${WEB_PORT}` |
| `app` | `sigap-app` | PHP-FPM; saat start menjalankan `php artisan optimize` |
| `queue` | `sigap-app` | `queue:work` — surel notifikasi & broadcast **wajib** jalan |
| `scheduler` | `sigap-app` | `schedule:work` (sync kanal 06:00, EWS 07:00, pembersihan retensi) |
| `reverb` | `sigap-app` | WebSocket chat & notifikasi realtime |
| `db` | `postgres:16-alpine` | tidak dipublikasikan ke host |

Berkas di repo:

| Berkas | Isi |
|---|---|
| `deploy/docker/Dockerfile` | multi-stage: composer → Vite build → `app` (php-fpm) & `web` (nginx) |
| `deploy/docker/compose.yml` | definisi stack |
| `deploy/docker/.env.example` | templat `.env` (salin ke `deploy/docker/.env`, **jangan di-commit**) |
| `deploy/docker/nginx.conf`, `security-headers.conf` | konfigurasi nginx container |
| `deploy/docker/php.ini`, `php-fpm.conf`, `entrypoint.sh` | konfigurasi PHP |
| `scripts/deploy.sh` | instalasi pertama, rilis, rollback |
| `scripts/backup.sh` | backup DB + lampiran + `.env` |

Cache, sesi, dan queue memakai driver **`database`** (PostgreSQL) — tidak perlu Redis.

---

## 1. Prasyarat server

- Docker Engine 24+ dan plugin **Compose v2** (`docker compose version`), `git`, `curl`.
- `cloudflared` sudah berjalan dan mengelola tunnel untuk domain `andimohamad.my.id`.
- Disk kosong ≥ 5 GB (image ± 600 MB, database, backup).
- Login SSH memakai **key**, login password dimatikan.
- User yang menjalankan deploy ada di grup `docker`. Anggota grup `docker` setara root —
  batasi siapa saja yang masuk grup ini.
- Pastikan port lokal untuk SIGAP belum dipakai stack lain:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
sudo ss -tlnp | grep -E ':8092\b' || echo "8092 bebas"
```

Bila 8092 terpakai, pilih port lain dan isi `WEB_PORT` di `.env`.

---

## 2. Ambil kode

```bash
sudo install -d -o "$USER" -g "$USER" /opt/app2-sigap
git clone https://github.com/andimohsoreang/sigap.git /opt/app2-sigap
cd /opt/app2-sigap
```

---

## 3. Konfigurasi `.env`

```bash
cd /opt/app2-sigap/deploy/docker
cp .env.example .env && chmod 600 .env
```

Buat nilai acak di server (jangan tempel hasilnya ke chat/issue):

```bash
echo "base64:$(openssl rand -base64 32)"   # APP_KEY, lalu sekali lagi untuk NIK_HASH_KEY (berbeda)
openssl rand -hex 16                        # REVERB_APP_KEY — VITE_REVERB_APP_KEY diisi NILAI YANG SAMA
openssl rand -hex 32                        # REVERB_APP_SECRET, lalu sekali lagi untuk DB_PASSWORD
```

| Kunci | Nilai |
|---|---|
| `COMPOSE_PROJECT_NAME` | `app2-sigap` |
| `WEB_PORT` | port lokal untuk cloudflared, default `8092` |
| `APP_URL` | `https://app2.andimohamad.my.id` |
| `APP_KEY`, `NIK_HASH_KEY` | hasil perintah di atas; **simpan di brankas** |
| `DB_PASSWORD` | acak; dipakai container `db` saat pertama kali dibuat |
| `REVERB_APP_KEY` = `VITE_REVERB_APP_KEY`, `REVERB_APP_SECRET` | acak |
| `REVERB_ALLOWED_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`, `VITE_REVERB_HOST` | `app2.andimohamad.my.id` |
| `MAIL_*` | SMTP kementerian (wajib agar notifikasi surel terkirim) |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | kunci reCAPTCHA v3 untuk domain ini — **wajib di production**. Bila kosong, verifikasi *fail closed*: pengaduan publik, survei, dan chat tamu ditolak (422). Kosong hanya boleh di `local`/`testing` |

Aturan penting:

- **`NIK_HASH_KEY` tidak boleh berubah** setelah ada data, kecuali diikuti `php artisan sigap:rehash-nik`.
  `APP_KEY` hilang = NIK terenkripsi tidak bisa dibaca. Keduanya ikut backup (§7).
- Variabel `VITE_*` **ditanam ke JavaScript saat build image**. Ubah nilainya → jalankan ulang
  `scripts/deploy.sh` (build ulang). Nilai kosong membuat realtime mati (UI kembali ke polling).
- Hindari karakter `$` di nilai rahasia (Compose menganggapnya variabel); bila perlu tulis `$$`.
- `DB_PASSWORD` hanya dipakai saat volume database **pertama kali** dibuat. Mengganti nilainya kemudian
  juga harus mengganti password di PostgreSQL (`ALTER USER sigap PASSWORD '...'`).
- `APP_ENV=production` mengaktifkan CSP ketat berbasis nonce; `connect-src` mengizinkan
  `wss://app2.andimohamad.my.id` (diturunkan dari `VITE_REVERB_*`).

---

## 4. Instalasi pertama

```bash
cd /opt/app2-sigap
bash scripts/deploy.sh --pertama --no-pull
```

Skrip ini: memeriksa `.env` → build image → menyalakan `db` → `migrate --force --seed`
(seed master: kategori, kawasan, kanal, pengaturan) → menyalakan semua service → cek `/up` →
menjalankan `php artisan sigap:admin` secara interaktif untuk membuat akun **super_admin**
(tidak ada akun bawaan).

Cek:

```bash
cd deploy/docker
docker compose ps                                  # semua running, app "healthy"
curl -sI http://127.0.0.1:8092/up | head -1        # HTTP/1.1 200 OK
docker compose logs --tail=50 app queue reverb
```

---

## 5. Cloudflare Tunnel

Tambahkan hostname baru ke tunnel yang sudah ada — **jangan** mengubah hostname stack lain.

**a) `cloudflared` berjalan di host** (service systemd, config di `/etc/cloudflared/config.yml`):

```yaml
ingress:
  # ... aturan yang sudah ada (app1, codeserver, kasm, dll.) TETAP ...
  - hostname: app2.andimohamad.my.id
    service: http://127.0.0.1:8092
  - service: http_status:404        # aturan penutup tetap paling bawah
```

```bash
cloudflared tunnel ingress validate
cloudflared tunnel route dns <nama-tunnel> app2.andimohamad.my.id
sudo systemctl restart cloudflared
```

**b) `cloudflared` berjalan sebagai container**: `127.0.0.1` di dalam container cloudflared
bukan host. Sambungkan cloudflared ke jaringan stack SIGAP lalu tunjuk ke container `web`:

```bash
docker network connect app2-sigap_internal <nama-container-cloudflared>
# ingress: service: http://app2-sigap-web-1:80
```

Tambahkan jaringan itu juga di compose milik cloudflared (`networks: { app2-sigap_internal: { external: true } }`)
agar tetap tersambung setelah restart.

**c) Tunnel dikelola dari dashboard** (Zero Trust → Networks → Tunnels → Public Hostname):
tambah `app2.andimohamad.my.id` → `HTTP` → `127.0.0.1:8092` (atau `app2-sigap-web-1:80` untuk kasus b).

Pengaturan zona Cloudflare: **WebSockets: On**, **Always Use HTTPS: On**. HSTS dikirim oleh nginx
container; jangan aktifkan HSTS preload. Staging: lindungi dengan **Cloudflare Access**.

nginx container memulihkan IP asli dari header `CF-Connecting-IP` (hanya dipercaya dari alamat
lokal/jaringan Docker), jadi rate limit login/aduan bekerja per IP pengguna, bukan per IP cloudflared.

---

## 6. Operasional harian

Dari `/opt/app2-sigap/deploy/docker`:

```bash
docker compose ps
docker compose logs -f --tail=100 app web queue reverb scheduler
docker compose exec app php artisan about
docker compose exec app php artisan queue:failed          # harus kosong
docker compose exec app php artisan queue:retry all
docker compose exec app php artisan sigap:admin           # tambah admin
docker compose exec app php artisan sigap:sync-channels
docker compose exec db psql -U sigap sigap                # konsol database
docker compose restart queue reverb
```

Log: stdout container (`docker compose logs`, dirotasi 5 × 10 MB) dan berkas harian di volume
`storage` (`storage/logs/laravel-*.log`, 14 hari).

Mode perawatan (berlaku untuk semua container karena `storage` dipakai bersama):

```bash
docker compose exec app php artisan down --secret="<token-acak>" --retry=60
docker compose exec app php artisan up
```

---

## 7. Backup & uji restore

```bash
bash /opt/app2-sigap/scripts/backup.sh      # → deploy/docker/backups/daily-<tanggal>/
```

Isi: `sigap.dump` (pg_dump format custom), `private.tgz` (lampiran pengaduan), `env` (berisi `APP_KEY`
& `NIK_HASH_KEY`). Folder backup mode 700, tidak ikut image (`.dockerignore`) maupun git.

Jadwalkan harian 02:00 (crontab user deploy):

```cron
0 2 * * * cd /opt/app2-sigap && bash scripts/backup.sh >> deploy/docker/backups/backup.log 2>&1
```

**Wajib** salin ke penyimpanan off-site (restic/rclone ke S3/B2/server lain), terenkripsi, dengan kata sandi
di brankas terpisah. Contoh restic:

```bash
restic -r s3:https://<endpoint>/<bucket>/sigap backup /opt/app2-sigap/deploy/docker/backups/daily-<tanggal>
restic forget --prune --keep-daily 14 --keep-weekly 8 --keep-monthly 12
```

**Uji restore (bulanan & sebelum go-live):**

```bash
cd /opt/app2-sigap/deploy/docker
B=backups/daily-<tanggal>
docker compose exec -T db createdb -U sigap sigap_restore_test
docker compose exec -T db pg_restore -U sigap --no-owner -d sigap_restore_test < $B/sigap.dump
docker compose exec -T db psql -U sigap sigap_restore_test -c "select count(*) from tickets;"
docker compose exec -T db dropdb -U sigap sigap_restore_test
tar -tzf $B/private.tgz | head
```

Catat tanggal & hasil uji restore.

---

## 8. Rilis berikutnya & rollback

**Rilis:**

```bash
cd /opt/app2-sigap
bash scripts/deploy.sh
```

Urutan skrip: `git pull --ff-only` → tag image lama `:prev` → `docker compose build --pull` →
**backup DB pra-migrasi** (`deploy/docker/backups/pre-migrate-*.dump`, simpan 10) → `migrate --force` →
`docker compose up -d --wait` (container diganti image baru) → cek `/up` → `docker image prune`.

Sebelum rilis besar: uji di staging, pastikan backup terakhir sukses.

**Rollback kode** (tanpa migrasi, atau migrasi kompatibel mundur):

```bash
bash scripts/deploy.sh --rollback          # kembali ke image :prev
```

**Rollback dengan migrasi:**

```bash
cd deploy/docker
docker compose exec app php artisan down
# a) bila down() migrasi aman:
docker compose exec app php artisan migrate:rollback --step=<n> --force
# b) bila tidak: pulihkan dump pra-migrasi
docker compose exec -T db pg_restore -U sigap --clean --if-exists --no-owner -d sigap \
  < backups/pre-migrate-<tanggal>.dump
cd ../.. && bash scripts/deploy.sh --rollback
docker compose -f deploy/docker/compose.yml exec app php artisan up
```

---

## 9. Pengujian sebelum go-live

Di mesin pengembang (atau CI):

```bash
cd sigap
php artisan test && npx vitest run && npx tsc --noEmit && npx eslint resources/js
npm run test:e2e
```

Di server:

```bash
curl -s https://app2.andimohamad.my.id/api/v1/health      # {"ok":true,"database":"ok",...}
curl -sI https://app2.andimohamad.my.id/ | grep -iE 'content-security|strict-transport'
curl -sI http://app2.andimohamad.my.id/ | grep -i location  # → https://
```

Checklist:

- [ ] `/`, `/katalog`, `/peta`, `/pengaduan/baru`, `/lacak` termuat tanpa error 500 dan tanpa pelanggaran CSP di Console.
- [ ] Header CSP memuat `'nonce-…'` dan `connect-src 'self' wss://app2.andimohamad.my.id`.
- [ ] Realtime: tab Network → WS `wss://app2.andimohamad.my.id/app/<key>` status 101.
- [ ] Login admin & warga; 6× salah sandi beruntun → "Terlalu banyak percobaan".
- [ ] Pengaduan publik (reCAPTCHA v3) menghasilkan tiket `TKT-YYMMDD-XXXXXX`; lacak menampilkan pelapor tersamar.
- [ ] Survei muncul setelah status Selesai.
- [ ] Notifikasi lonceng muncul dan surel masuk (`php artisan queue:failed` kosong).
- [ ] `https://app2.andimohamad.my.id/.env` → 403; `/storage/...` → 404.
- [ ] `docker compose ps`: tidak ada port selain `127.0.0.1:${WEB_PORT}`; `sudo ss -tlnp | grep -E ':(5432|8080)\b'` kosong.
- [ ] `APP_DEBUG=false`; tidak ada akun demo; backup & uji restore sudah dilakukan; rollback sudah dicoba sekali.

---

## 10. Keamanan host

- **Docker melewati ufw** untuk port yang dipublikasikan. Karena itu compose hanya memublikasikan
  `127.0.0.1:${WEB_PORT}`; **jangan** ubah ke `0.0.0.0` atau memublikasikan `db`/`reverb`.
- Dengan Cloudflare Tunnel, server tidak perlu membuka port 80/443 ke internet. Firewall cukup
  mengizinkan SSH dari IP/VPN admin.
- `deploy/docker/.env` mode 600, tidak pernah di-commit (repo ini **publik**).
- Container `app`/`queue`/`reverb`/`scheduler` berjalan sebagai `www-data`, bukan root.
- Lampiran disimpan di disk privat (`storage/app/private`) dan hanya diunduh lewat controller yang
  memeriksa otorisasi — **jangan** membuat `storage:link`.
- Perbarui image dasar berkala: `scripts/deploy.sh` selalu memakai `build --pull`.

---

## 11. Cutover dari sistem lama (`app1`)

1. Jalankan SIGAP baru di `app2` dan uji paritas (14 halaman publik + 9 sub-halaman admin, light/dark).
2. Backup penuh DB & berkas sistem lama; migrasi data sesuai TECH-SPEC §6.
3. Turunkan TTL DNS `app1` ke 300 detik 24 jam sebelumnya.
4. Hari H: mode perawatan, hentikan `app1-sigap`, arahkan hostname `app1` di ingress cloudflared ke
   SIGAP baru, sesuaikan `APP_URL`, `REVERB_ALLOWED_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`,
   `VITE_REVERB_HOST` → `bash scripts/deploy.sh`.
5. Pantau log + `queue:failed` selama 1–2 minggu. Simpan stack & backup lama minimal 30 hari.

Rollback cutover: kembalikan ingress `app1` ke stack lama dan nyalakan lagi `app1-sigap`.

---

## 12. Pemecahan masalah

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| `app` restart terus, log "APP_KEY kosong" | `.env` belum diisi | isi `APP_KEY`, `bash scripts/deploy.sh --no-pull` |
| 502 Bad Gateway | `app` belum sehat | `docker compose ps`, `docker compose logs app` |
| Realtime tidak jalan, WS gagal | `VITE_REVERB_*` salah saat build / WebSockets Cloudflare off | perbaiki `.env`, build ulang; aktifkan WebSockets |
| Login berhasil lalu langsung keluar | `SESSION_SECURE_COOKIE=true` tapi diakses lewat HTTP | akses lewat `https://` (Tunnel) |
| Surel tidak terkirim | `queue` mati / SMTP salah | `docker compose logs queue`, `php artisan queue:failed` |
| `password authentication failed` | `DB_PASSWORD` diganti setelah volume dibuat | samakan password di PostgreSQL atau kembalikan nilainya |
| Port bentrok saat `up` | `WEB_PORT` dipakai stack lain | ganti `WEB_PORT`, sesuaikan ingress cloudflared |
| Asisten selalu meneruskan ke petugas | `AI_*` salah / kuota habis / belum ada artikel terbit | `docker compose logs app \| grep AI:`; cek `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`; terbitkan artikel |
| Dokumen PDF "Sedang diproses" terus | `queue` mati | `docker compose ps queue`, `docker compose restart queue` |

---

## 13. Asisten AI contact center

Asisten AI menjawab pertanyaan warga **hanya dari artikel Basis Pengetahuan yang berstatus Terbit**,
menyebut sumbernya, dan meneruskan ke petugas (beserta ringkasan) untuk aduan, pertanyaan hak pribadi,
permintaan warga, atau bila tidak menemukan sumber. AI tidak menerbitkan tiket dan tidak memutuskan hak
warga. NIK, nomor HP, surel, dan deret angka panjang disamarkan sebelum teks dikirim ke model.

**Nonaktif secara bawaan** (`AI_ENABLED=false`): live chat bekerja seperti sebelumnya (langsung ke petugas).

### Menyalakan

1. Isi Basis Pengetahuan dulu (panel admin → Basis Pengetahuan). Tanpa artikel terbit, AI hanya bisa
   menjawab "belum menemukan informasi resmi" dan meneruskan ke petugas.
   `php artisan db:seed --class=KnowledgeSeeder --force` menambahkan 8 artikel cara memakai SIGAP
   (hanya bila tabel masih kosong).
   `php artisan db:seed --class=OfficialKnowledgeSeeder --force` menambahkan ±29 artikel dari portal PPID,
   JDIH, dan UU 15/1997 jo. UU 29/2009 (layanan informasi publik, jenis transmigrasi, syarat, hak &
   kewajiban transmigran, pertanahan, Program 5T). Semuanya berstatus **Ditinjau**: Super Admin mencocokkan
   isi dengan dokumen asli lewat tautan sumber, lalu klik **Terbitkan**. Aman dijalankan ulang.
   Setelah terbit, cek kualitas: `php artisan sigap:uji-asisten --rinci` (lihat bagian *Menguji kualitas*).
2. Atur `deploy/docker/.env`:

   | Variabel | Nilai |
   |---|---|
   | `AI_ENABLED` | `true` |
   | `AI_DRIVER` | `openai` (endpoint kompatibel OpenAI). `fake` = jawaban tiruan tanpa model, hanya untuk uji |
   | `AI_BASE_URL` | OpenCode Zen: `https://opencode.ai/inference/openai/v1` · Ollama: `http://<host>:11434/v1` · vLLM: `http://<host>:8000/v1` |
   | `AI_API_KEY` | kunci penyedia (kosongkan untuk Ollama lokal) |
   | `AI_MODEL` | mis. `deepseek-v4.1-flash` (Zen) atau nama model Ollama/vLLM |
   | `AI_SERVICE_DAYS`, `AI_SERVICE_START`, `AI_SERVICE_END`, `AI_SERVICE_LABEL` | jam layanan petugas (WIB) |

3. `bash scripts/deploy.sh --no-pull` (container dibuat ulang dengan `.env` baru).

> **Data warga asli:** jangan memakai model berakhiran `-free` di OpenCode Zen (sebagian boleh dipakai
> melatih model). Server Zen berada di AS/UE — untuk produksi instansi publik, konfirmasi dulu ke
> Pusdatin/biro hukum (PP 71/2019, UU 27/2022), atau gunakan model di server Kementerian.

### Yang perlu berjalan

- `queue` — memproses PDF di menu **Basis Pengetahuan → Buat dari dokumen resmi**.
- Server SIGAP saat ini (tanpa GPU, CPU tanpa AVX) **tidak** dapat menjalankan model lokal; pakai
  penyedia API atau server GPU terpisah.

### Rujukan ke portal Kementerian

Contact center menjadi pintu depan portal lain. Aduan yang dilayani portal bertanda **Lacak sampai
berhasil** (bawaan: Trans Tuntas untuk masalah lahan, SP4N-LAPOR! untuk lintas instansi) tidak diantrekan,
tetapi dirujuk:

1. Warga menerima halaman **pengantar** (`/rujukan/{token}`): kegunaan portal, yang perlu disiapkan,
   langkah, ringkasan aduan untuk disalin, lalu tombol ke portal tujuan.
2. Sistem langsung menetapkan **penanggung jawab**: petugas yang merujuk, atau admin aktif dengan rujukan
   terbuka paling sedikit bila dirujuk AI.
3. Rujukan baru **selesai** bila warga memasukkan kode bukti dari portal tujuan (mis. kode tracking Trans
   Tuntas), atau penanggung jawab menutupnya dengan alasan tertulis.
4. Tanpa bukti setelah **2 hari kerja**, atau bila warga menekan "Mengalami kendala", rujukan masuk tab
   **Perlu tindakan** dan penanggung jawab diingatkan setiap pagi hari kerja. Super Admin melihat papan
   penanggung jawab di menu **Rujukan**.

Persiapan: `php artisan db:seed --class=PortalSeeder --force` (9 portal; portal internal seperti TC-More dan
TransCloud tidak pernah ditawarkan ke warga), lalu sesuaikan di **Kelola → Katalog Portal**. Pastikan
scheduler berjalan (`sigap:pantau-rujukan` pukul 08.00 hari kerja, `sigap:cek-portal` setiap jam) dan server
boleh membuka koneksi HTTPS keluar ke `*.transmigrasi.go.id` dan `sp4n.lapor.go.id` untuk cek tautan.
Portal yang tidak dapat diakses otomatis tidak ditawarkan; warga diteruskan ke petugas.

### Menguji kualitas

`php artisan sigap:uji-asisten` menjalankan ±40 pertanyaan bergaya warga (`database/data/uji-asisten.php`)
terhadap artikel terbit dan model yang dikonfigurasi, tanpa menyimpan percakapan. Hasilnya: ketepatan
pencarian sumber, ketepatan klasifikasi (informasi/aduan/pribadi/lainnya), jumlah jawaban tanpa sumber
(ditolak sistem), dan waktu jawab median. Jalankan setiap kali mengganti `AI_MODEL` atau setelah menambah
banyak artikel. `--hanya-pencarian` melewati model (tanpa biaya API).

Bila warga bertanya dengan istilah yang tidak ditemukan, isi **Kata kunci tambahan** pada artikel terkait
dan periksa dengan kotak **Uji pencarian** di halaman Basis Pengetahuan.

### Mematikan / rollback

- Cepat, tanpa rilis: `AI_ENABLED=false` lalu `bash scripts/deploy.sh --no-pull`. Percakapan yang sedang
  dijawab AI akan dilayani petugas seperti live chat biasa; data (artikel, ringkasan) tetap tersimpan.
- Kode: kembali ke image sebelumnya (`bash scripts/deploy.sh --rollback`). Migrasi fitur ini hanya
  **menambah** tabel/kolom, sehingga versi lama tetap berjalan tanpa `migrate:rollback`.
