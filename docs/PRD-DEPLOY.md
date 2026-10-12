# PRD — Deployment SIGAP dengan Docker

> **Untuk siapa dokumen ini:** pengembang dan **AI coding agent** (Cursor, Windsurf, Copilot, dll.)
> yang mengeksekusi deployment. Langkah teknis rinci ada di [`docs/DEPLOY.md`](DEPLOY.md); dokumen ini
> menetapkan **apa** yang dicapai, **urutan tahap**, **batasan keamanan**, dan **kriteria selesai**.
>
> Versi 2.0 · 12 Oktober 2026 · Pemilik: Andi
> **Keputusan: deploy memakai Docker Compose.** Instalasi native di OS (PHP/nginx/PostgreSQL di host)
> **tidak** dipakai.

---

## 0. Aturan wajib untuk AI agent (baca dulu)

1. **Pakai Docker.** Jangan memasang PHP, nginx, PostgreSQL, Node, atau Redis langsung di OS host.
   Semua berjalan dari `deploy/docker/compose.yml`.
2. **Jangan ganggu stack lain** di server (`app1-sigap`, `codeserver-nginx`, `kasm-proxy`, cloudflared, dll.):
   jangan `docker compose down`/`restart`/`rm` di luar stack `app2-sigap`, jangan `docker system prune`,
   jangan `docker volume prune`, jangan ubah port atau aturan ingress hostname lain.
3. **Jangan pernah** menulis password, token, SSH key, `APP_KEY`, `NIK_HASH_KEY`, atau isi `.env` ke repo,
   log, issue, atau chat. Repo ini **publik**. Rahasia hanya ada di `deploy/docker/.env` (mode 600) di server
   dan di brankas pemilik.
4. **Jangan** menjalankan perintah destruktif tanpa konfirmasi eksplisit pemilik: `migrate:fresh`,
   `migrate:reset`, `db:wipe`, `DROP`, `docker volume rm`, `docker compose down -v`, mengubah
   `NIK_HASH_KEY`/`APP_KEY`/`DB_PASSWORD` setelah ada data, mengubah firewall.
5. **Jangan** memublikasikan port selain `127.0.0.1:${WEB_PORT}` (Docker melewati ufw). Jangan
   `storage:link`.
6. Kerjakan **per tahap** (§5). Setiap tahap selesai → jalankan verifikasinya → laporkan ke pemilik →
   baru lanjut.
7. Kondisi server berbeda dari dokumen (port terpakai, cloudflared bukan di host, versi Docker lama, dll.)
   → **berhenti dan tanyakan**, jangan improvisasi.

---

## 1. Latar belakang

SIGAP adalah Dashboard Contact Center / sistem pengaduan Kementerian Transmigrasi: warga membuat aduan
dan melacak tiket, pegawai melapor lewat jalur internal, petugas mengelola tiket, chat langsung, SLA/EWS,
kawasan, kanal, hak akses per wilayah, dan log audit.

Kode sudah lolos audit keamanan dan pengujian lokal (Pest 209 tes, Vitest, Playwright, tsc, eslint, pint,
`npm audit` 0). Server target sudah menjalankan beberapa stack Docker dan `cloudflared`, sehingga SIGAP
dipasang sebagai **stack Docker baru** agar seragam dan terisolasi.

## 2. Tujuan & di luar cakupan

**Tujuan**

- G1. SIGAP berjalan sebagai stack Compose **`app2-sigap`** di **`https://app2.andimohamad.my.id`**.
- G2. Semua proses jalan dan pulih otomatis (`restart: unless-stopped`): web, app, queue, scheduler, reverb, db.
- G3. Aman: hanya `127.0.0.1:${WEB_PORT}` yang terbuka, akses publik lewat Cloudflare Tunnel, HTTPS + header keamanan + CSP.
- G4. Backup harian (DB + lampiran + `.env`) tersalin off-site dan **sudah diuji restore**.
- G5. Rilis dan rollback masing-masing cukup satu perintah (`scripts/deploy.sh`, `scripts/deploy.sh --rollback`).

**Di luar cakupan**

- Perbaikan bug/fitur aplikasi (§10).
- Cutover dari sistem lama `app1` (DEPLOY.md §11 — tahap terpisah setelah app2 stabil).
- Orkestrasi multi-server (Kubernetes/Swarm), registry image privat.

## 3. Gambaran sistem

```
Browser ─HTTPS/WSS─▶ Cloudflare ─Tunnel─▶ cloudflared ─http─▶ 127.0.0.1:${WEB_PORT}
   stack app2-sigap:  web (nginx) ─▶ app (php-fpm 8.4) ─▶ db (postgres:16)
                      web /app/* ─▶ reverb    ·    queue    ·    scheduler
   volume: storage (lampiran, log, sesi berkas), pgdata (database)
```

| Komponen | Keterangan |
|---|---|
| Image `sigap-app` | PHP 8.4-FPM Alpine + ekstensi pdo_pgsql, intl, zip, bcmath, pcntl, opcache; kode + vendor + aset build. Dipakai service `app`, `queue`, `scheduler`, `reverb`. Berjalan sebagai `www-data`. |
| Image `sigap-web` | nginx 1.27 + `public/` (termasuk `public/build`). |
| `db` | `postgres:16-alpine`, tidak dipublikasikan ke host. |
| Driver | session, cache, queue = `database` (tanpa Redis). Broadcast = Reverb. |
| Health check | `GET /up` (200) dan `GET /api/v1/health` (cek DB). |

**Berkas deploy di repo** (sudah ada, gunakan apa adanya; ubah hanya bila perlu dan laporkan):

```
deploy/docker/Dockerfile          multi-stage: composer → vite build → app / web
deploy/docker/compose.yml         stack: web, app, queue, scheduler, reverb, db
deploy/docker/.env.example        templat .env (salin ke deploy/docker/.env)
deploy/docker/nginx.conf          real IP dari CF-Connecting-IP, proksi WebSocket, header keamanan
deploy/docker/php.ini, php-fpm.conf, entrypoint.sh, security-headers.conf
scripts/deploy.sh                 --pertama | (rilis) | --no-pull | --rollback
scripts/backup.sh                 backup harian ke deploy/docker/backups/
.dockerignore                     mengecualikan .env, vendor, node_modules, backups
```

> Berkas Docker ini **belum pernah di-build di server**. Tahap 2 adalah build & uji pertama; bila ada
> error build, perbaiki di repo (commit + push), bukan di server secara manual.

## 4. Kebutuhan

### 4.1 Fungsional

| ID | Kebutuhan | Referensi |
|---|---|---|
| D-01 | Docker Engine 24+ & Compose v2 tersedia; user deploy di grup `docker` | DEPLOY §1 |
| D-02 | Port `WEB_PORT` (default 8092) bebas di host; tidak bentrok dengan stack lain | DEPLOY §1 |
| D-03 | Repo di-clone ke `/opt/app2-sigap` | DEPLOY §2 |
| D-04 | `deploy/docker/.env` lengkap (daftar kunci §6), mode 600 | DEPLOY §3 |
| D-05 | Instalasi pertama via `bash scripts/deploy.sh --pertama --no-pull`: build, migrate + seed master, buat super_admin | DEPLOY §4 |
| D-06 | Hostname `app2.andimohamad.my.id` ditambahkan ke ingress cloudflared yang sudah ada → `http://127.0.0.1:${WEB_PORT}` (atau `http://app2-sigap-web-1:80` bila cloudflared berupa container) | DEPLOY §5 |
| D-07 | Cloudflare: WebSockets On, Always Use HTTPS On | DEPLOY §5 |
| D-08 | Backup harian terjadwal (`scripts/backup.sh` via cron 02:00) + salinan off-site + uji restore | DEPLOY §7 |
| D-09 | Rilis berikutnya & rollback sudah dicoba sekali | DEPLOY §8 |

### 4.2 Non-fungsional & keamanan

| ID | Kebutuhan |
|---|---|
| N-01 | `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=warning` |
| N-02 | `SESSION_SECURE_COOKIE=true`, `SESSION_ENCRYPT=true`; IP asli via nginx `real_ip` (CF-Connecting-IP), `TRUSTED_PROXIES=127.0.0.1` |
| N-03 | `NIK_HASH_KEY` dibuat sekali, di brankas, tidak pernah diubah tanpa `sigap:rehash-nik` |
| N-04 | `APP_KEY` di brankas dan ikut backup (tanpanya NIK terenkripsi tak terbaca) |
| N-05 | Tidak ada akun bawaan/demo; super_admin dibuat via `php artisan sigap:admin` |
| N-06 | Port terpublikasi hanya `127.0.0.1:${WEB_PORT}`; `db` dan `reverb` hanya di jaringan internal |
| N-07 | Header: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy (nginx) + CSP nonce (Laravel) |
| N-08 | Container aplikasi berjalan non-root (`www-data`); log container dirotasi (5 × 10 MB) |
| N-09 | Rilis tanpa downtime berarti (container diganti setelah image baru siap); rilis < 10 menit |

## 5. Tahapan

### Tahap 0 — Akses & persiapan (pemilik)

- SSH ke server memakai **key**; login password dimatikan; password lama yang pernah tersebar sudah diganti.
- Siapkan: akun SMTP, kunci reCAPTCHA v3, lokasi backup off-site, akses ke konfigurasi cloudflared.
- **Selesai bila:** pemilik bisa SSH dan `docker ps` berjalan tanpa sudo.

### Tahap 1 — Survei server (baca saja, tanpa mengubah apa pun)

```bash
docker version --format '{{.Server.Version}}'; docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
docker network ls
sudo ss -tlnp | grep -E ':8092\b' || echo "8092 bebas"
systemctl status cloudflared --no-pager 2>/dev/null | head -5; docker ps --filter name=cloudflared
df -h / ; free -h
```

- **Laporkan ke pemilik:** versi Docker, daftar stack & port terpakai, cara cloudflared berjalan (host /
  container / dashboard), port yang dipilih untuk `WEB_PORT`, ruang disk.
- **Selesai bila:** pemilik menyetujui `WEB_PORT` dan cara routing cloudflared.

### Tahap 2 — Build & jalankan stack (belum publik)

- D-03, D-04, D-05.
- **Verifikasi:**
  ```bash
  cd /opt/app2-sigap/deploy/docker
  docker compose ps                                   # web, app(healthy), queue, scheduler, reverb, db(healthy)
  curl -sI http://127.0.0.1:${WEB_PORT:-8092}/up | head -1          # 200
  curl -s  http://127.0.0.1:${WEB_PORT:-8092}/api/v1/health         # "database":"ok"
  docker compose exec app php artisan about --only=environment
  docker compose ps --format '{{.Name}} {{.Ports}}'   # hanya web: 127.0.0.1:<port>->80
  ```

### Tahap 3 — Publikasi lewat Cloudflare Tunnel

- D-06, D-07.
- **Verifikasi:**
  ```bash
  curl -sI https://app2.andimohamad.my.id/up | head -1                      # 200
  curl -sI http://app2.andimohamad.my.id/ | grep -i location                # → https://
  curl -sI https://app2.andimohamad.my.id/ | grep -iE 'strict-transport|content-security|x-content-type'
  curl -sI https://app2.andimohamad.my.id/.env | head -1                    # 403
  ```
  Uji manual: aduan warga → tiket `TKT-YYMMDD-XXXXXX` → lacak → login admin → ubah status → chat
  warga ↔ petugas realtime (WS `wss://app2.andimohamad.my.id/app/...` status 101) → surel terkirim.
  Stack lain (`app1`, dll.) tetap bisa diakses seperti sebelumnya.

### Tahap 4 — Operasional

- D-08 backup harian + off-site + uji restore (DEPLOY §7).
- D-09 latihan rilis (`bash scripts/deploy.sh`) dan rollback (`bash scripts/deploy.sh --rollback`).
- **Selesai bila:** ada bukti restore berhasil (jumlah baris `tickets` sama) dan rollback sudah dicoba.

## 6. Variabel `deploy/docker/.env`

Nilai **tidak** ditulis di sini. Templat lengkap & komentar: `deploy/docker/.env.example`; cara membuat
nilai acak: DEPLOY.md §3.

| Kelompok | Kunci | Catatan |
|---|---|---|
| Compose | `COMPOSE_PROJECT_NAME=app2-sigap` `WEB_PORT` `SIGAP_TAG` | |
| Aplikasi | `APP_NAME` `APP_ENV` `APP_KEY` `APP_PREVIOUS_KEYS` `APP_DEBUG` `APP_TIMEZONE` `APP_URL` `APP_LOCALE` | `APP_URL=https://app2.andimohamad.my.id` |
| Privasi NIK | `NIK_HASH_KEY` | wajib, terpisah dari `APP_KEY`, jangan diubah |
| Proksi | `TRUSTED_PROXIES=127.0.0.1` | IP asli dipulihkan nginx |
| Log | `LOG_CHANNEL=stack` `LOG_STACK=daily,stderr` `LOG_LEVEL=warning` `LOG_DAILY_DAYS=14` | |
| Database | `DB_CONNECTION=pgsql` `DB_HOST=db` `DB_PORT=5432` `DB_DATABASE` `DB_USERNAME` `DB_PASSWORD` `DB_SSLMODE=disable` | password dipakai saat volume pertama dibuat |
| Session/cache/queue | `SESSION_DRIVER=database` `CACHE_STORE=database` `QUEUE_CONNECTION=database` `SESSION_ENCRYPT=true` `SESSION_SECURE_COOKIE=true` | |
| Surel | `MAIL_MAILER` `MAIL_HOST` `MAIL_PORT` `MAIL_USERNAME` `MAIL_PASSWORD` `MAIL_ENCRYPTION` `MAIL_FROM_ADDRESS` `MAIL_FROM_NAME` | SMTP kementerian |
| Sanctum | `SANCTUM_STATEFUL_DOMAINS` `SANCTUM_EXPIRATION` | domain app2 |
| Reverb (server) | `REVERB_APP_ID` `REVERB_APP_KEY` `REVERB_APP_SECRET` `REVERB_HOST=reverb` `REVERB_PORT=8080` `REVERB_SCHEME=http` `REVERB_SERVER_HOST=0.0.0.0` `REVERB_SERVER_PORT=8080` `REVERB_ALLOWED_ORIGINS` | jaringan internal |
| Reverb (browser) | `VITE_REVERB_APP_KEY` (= `REVERB_APP_KEY`) `VITE_REVERB_HOST` `VITE_REVERB_PORT=443` `VITE_REVERB_SCHEME=https` | ditanam saat **build** → ubah = build ulang |
| reCAPTCHA | `RECAPTCHA_SITE_KEY` `RECAPTCHA_SECRET_KEY` `RECAPTCHA_MIN_SCORE` | v3 |

## 7. Alur rilis & rollback

```bash
cd /opt/app2-sigap
bash scripts/deploy.sh             # git pull → tag :prev → build → backup DB → migrate → up --wait → cek /up
bash scripts/deploy.sh --rollback  # kembali ke image :prev
```

> Rollback image **tidak** membatalkan migrasi. Untuk rilis dengan migrasi berisiko, gunakan dump
> pra-migrasi otomatis di `deploy/docker/backups/pre-migrate-*.dump` (DEPLOY §8).

Opsional nanti: GitHub Actions yang build image dan menjalankan `deploy.sh` lewat **self-hosted runner**
di server (runner GitHub biasa tidak bisa menjangkau server di jaringan privat). Tidak dikerjakan sekarang.

## 8. Kriteria selesai (Definition of Done)

- [ ] `https://app2.andimohamad.my.id/up` → 200; HTTP dialihkan ke HTTPS.
- [ ] `docker compose ps`: 6 service running, `app` & `db` healthy, hanya `127.0.0.1:${WEB_PORT}` terpublikasi.
- [ ] Alur warga: aduan → tiket → lacak → survei.
- [ ] Alur internal (NIP) berjalan dan tampil di Tiket Internal.
- [ ] Petugas: dashboard, ubah status, tanggapan, chat realtime, input manual.
- [ ] Admin kawasan hanya melihat data kawasannya.
- [ ] Surel notifikasi terkirim (`php artisan queue:failed` kosong).
- [ ] CSP tanpa pelanggaran di Console; WebSocket status 101.
- [ ] `APP_DEBUG=false`; tidak ada akun demo; super_admin dibuat, kredensial di brankas.
- [ ] Backup harian jalan, tersalin off-site, satu kali restore teruji.
- [ ] Rilis kedua & rollback sudah dicoba.
- [ ] Stack lain di server tidak terganggu.

## 9. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Port/nama bentrok dengan stack lain | Stack lain rusak / SIGAP gagal start | Tahap 1 survei; `COMPOSE_PROJECT_NAME` unik; `WEB_PORT` dipilih bebas |
| Port terbuka ke publik (Docker melewati ufw) | DB/app bisa diakses langsung | Publikasi hanya `127.0.0.1`; cek `docker compose ps` |
| `NIK_HASH_KEY`/`APP_KEY` hilang atau berubah | Login warga gagal / NIK tak terbaca | Brankas + ikut backup |
| `VITE_*` salah saat build | Realtime mati | `deploy.sh` cek `VITE_REVERB_APP_KEY = REVERB_APP_KEY`; build ulang setelah ubah |
| `docker compose down -v` / `volume prune` | Database & lampiran hilang | Dilarang tanpa izin (aturan §0); backup harian off-site |
| Disk penuh (image lama, log, backup) | Container gagal | `deploy.sh` prune image; rotasi log; retensi backup 14 |
| Password server pernah tersebar | Server diambil alih | Ganti password, matikan login password, SSH key |
| Repo publik | Rahasia bocor bila ter-commit | `.env` di `.gitignore` & `.dockerignore`; aturan §0 |

## 10. Isu aplikasi yang diketahui (bukan blocker deploy)

- Kategori tiket internal tersimpan di judul → "Top Kategori" tampil "—".
- Daftar petugas menampilkan admin_kawasan sebagai "Admin Biasa".
- Pilihan jumlah baris per halaman di Log Aktivitas kosong.
- Label survei "sudah Anda kirim" tampil untuk semua pengunjung.
- Celah terhadap KAK: disposisi manual, edit/nonaktif admin, mode kontras tinggi, bahasa Inggris,
  ekspor Excel, filter tanggal, hari libur dalam hitungan SLA, penerbitan token API.

## 11. Referensi

- [`docs/DEPLOY.md`](DEPLOY.md) — panduan teknis Docker lengkap.
- [`docs/TECH-SPEC.md`](TECH-SPEC.md) — arsitektur & keamanan aplikasi.
- [`docs/PRD.md`](PRD.md) — kebutuhan produk.
- `deploy/docker/` dan `scripts/` — berkas deploy.
