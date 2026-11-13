# Konfigurasi produksi yang dicerminkan suite paritas

Sumber: dicek orkestrator langsung di server app2 (termasuk `curl` ke situs), **13 Nov 2026**.
Nilai dipakai di `env/laravel.env`; yang berbeda di target lokal ditandai dan tidak mengubah tampilan S1.

| Kunci | Produksi | Target paritas lokal | Dampak yang diuji |
|---|---|---|---|
| `APP_NAME` / `VITE_APP_NAME` | `Contact Center` | sama | judul tab |
| `APP_ENV` | production | sama (hanya `sigap:e2e-setup` memakai `local`) | CSP ketat (nonce, tanpa `unsafe-inline`) |
| `APP_DEBUG` | false | sama | halaman galat |
| `APP_LOCALE` | `id` | sama | `<html lang="id">` |
| `APP_TIMEZONE` | `Asia/Jakarta` (default PHP juga) | sama | SLA, nomor tiket; `fixtures/sla.json` → `kasus` |
| `SESSION_DRIVER` | database | sama | |
| `SESSION_ENCRYPT` | true | sama | |
| `SESSION_COOKIE` | `sigap_session` | sama | nama & atribut cookie |
| `SESSION_SECURE_COOKIE` | true (HTTPS) | **false** (http lokal) | atribut `secure` tidak diuji |
| `CACHE_STORE` | database | sama | |
| `QUEUE_CONNECTION` | database | sama | |
| `BROADCAST_CONNECTION` | reverb | **log** | tidak dipakai halaman S1 |
| `REVERB_APP_KEY` / `VITE_REVERB_*` | terisi | **kosong** | `connect-src` CSP tidak dibandingkan persis |
| `RECAPTCHA_SITE_KEY` | terisi | `paritas-dummy-site-key` (palsu, bukan rahasia) | CSP & prop reCAPTCHA; request Google diblokir, badge di-mask |
| `RECAPTCHA_SECRET_KEY` | terisi | **kosong**, verify URL ke port tertutup | belum ada form di S1 |
| `AI_ENABLED` | true | sama | prop `assistant.enabled` |
| `AI_DRIVER` | tidak dicek (model asli) | **fake** (tanpa jaringan) | jawaban TARA (belum di S1) |
| `DB_CONNECTION` | pgsql | **sqlite** | urutan baris seri bisa beda dari PostgreSQL |
| `APP_KEY`, `NIK_HASH_KEY` | rahasia | acak per run | — |

Belum dicek di server (nilai `.env.example` dipakai): `APP_FALLBACK_LOCALE`, `SESSION_LIFETIME` (test mengharapkan `Max-Age=7200` = 120 menit), `LOG_*`, `AI_SERVICE_*`.
