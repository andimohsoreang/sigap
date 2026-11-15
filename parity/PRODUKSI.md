# Konfigurasi produksi yang dicerminkan suite paritas

Sumber: dicek orkestrator langsung di server app2 (termasuk `curl` ke situs dan `psql`), **13 Nov 2026**.
Nilai dipakai di `env/laravel.env`; yang berbeda di target lokal ditandai dan tidak mengubah tampilan S1.

| Kunci | Produksi | Target paritas lokal | Dampak yang diuji |
|---|---|---|---|
| `APP_NAME` / `VITE_APP_NAME` | `Contact Center` | sama | judul tab |
| `APP_ENV` | production | sama (hanya `sigap:e2e-setup` memakai `local`) | CSP ketat (nonce, tanpa `unsafe-inline`) |
| `APP_DEBUG` | false | sama | halaman galat |
| `APP_LOCALE` | `id` | sama | `<html lang="id">` |
| `APP_TIMEZONE` | `Asia/Jakarta` (default PHP juga) | sama | SLA, nomor tiket; fixture dipaksa zona ini |
| `SESSION_DRIVER` | database | sama | |
| `SESSION_LIFETIME` | 120 | sama | cookie `max-age=7200` |
| `SESSION_ENCRYPT` | true | sama | |
| `SESSION_COOKIE` | `sigap_session` | sama | nama & atribut cookie |
| `SESSION_SECURE_COOKIE` | true (HTTPS) | **false** (http lokal) | atribut `secure` tidak diuji |
| `CACHE_STORE` | database | sama | |
| `QUEUE_CONNECTION` | database | sama | |
| `BROADCAST_CONNECTION` | reverb | **log** | tidak dipakai halaman S1 |
| `REVERB_APP_KEY` / `VITE_REVERB_*` | terisi | **kosong**, host `localhost:8080` | CSP `connect-src` = `'self' ws://localhost:8080` (produksi: host Reverb produksi) |
| `RECAPTCHA_SITE_KEY` | terisi | `paritas-dummy-site-key` (palsu, bukan rahasia) | CSP & prop reCAPTCHA; request Google diblokir & dicatat, badge di-mask |
| `RECAPTCHA_SECRET_KEY` | terisi | **kosong**, verify URL ke port tertutup | belum ada form di S1 |
| `AI_ENABLED` | true | sama | prop `assistant.enabled` |
| `AI_DRIVER` | `openai` | **fake** (tanpa jaringan) | jawaban TARA (belum di S1) |
| `DB_CONNECTION` | pgsql | pgsql | |
| `APP_KEY`, `NIK_HASH_KEY` | rahasia | acak per run | — |

## PostgreSQL

| Hal | Produksi | Lokal (`cc_paritas` @ 127.0.0.1:5432, pemilik `cc_migrate`) |
|---|---|---|
| Versi / image | `postgres:16-alpine` (musl) | PostgreSQL 16 |
| Database | `sigap`, `datcollate`/`datctype` = `en_US.utf8` → di musl urut per **byte** (`Cipta,Zona,apel,bantuan,eka,Éka`) | `LC_COLLATE 'C'`, `LC_CTYPE 'en_US.UTF-8'` → urutan sama (diverifikasi) |
| `TimeZone` server | UTC | UTC |
| `max_connections` | 100 | bawaan lokal |

Akibatnya `ORDER BY` teks (mis. kategori, kanal, provinsi) di Next.js harus memakai urutan byte yang sama, bukan
collation ICU/glibc. Fixture `cc:ekspor-fixture` memakai skema sementara `cc_fixture` di database yang sama.

Belum dicek di server (nilai `.env.example` dipakai): `APP_FALLBACK_LOCALE`, `LOG_*`, `AI_SERVICE_*`.
