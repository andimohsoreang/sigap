import 'server-only';

import { createHash } from 'node:crypto';

import type Redis from 'ioredis';

import { log } from '@/server/log';
import { denganValkey } from '@/server/valkey';

import { headerGagal, headerLolos, type HeaderBatas } from './respons';

// Port middleware ThrottleRequests + Illuminate\Cache\RateLimiter (Laravel 12.69.3), jendela tetap per kunci:
// - per Limit: tooManyAttempts (hits >= maks DAN timer masih ada → tolak; timer habis → counter direset) lalu hit
//   (timer = sekarang + decay dan counter dibuat dengan TTL decay hanya bila belum ada, lalu INCR);
// - beberapa Limit diproses berurutan; Limit yang lebih dulu SUDAH di-hit walau Limit berikutnya menolak;
// - kunci limiter bernama = md5(nama . kunci Limit) (ThrottleRequests::$shouldHashKeys = true).
// Valkey: satu skrip Lua atomik untuk semua Limit. Valkey mati → memori proses (§9.4), angka sama per instance.

export interface Limit {
    /** Nilai `->by(...)` Laravel. */
    kunci: string;
    maks: number;
    detik: number;
}

export interface HasilBatas {
    lolos: boolean;
    /** Header yang dipasang Laravel: saat lolos di respons, saat ditolak di respons 429. */
    header: HeaderBatas;
    /** Detik sampai boleh mencoba lagi (hanya saat ditolak). */
    retryAfter?: number;
    sumber: 'valkey' | 'memori';
}

/** Hasil mentah per Limit yang diproses: jumlah hit dan detik epoch berakhirnya jendela (timer). */
type Langkah = { hits: number; timer: number };
type Mentah = { gagal: number; langkah: Langkah[] };

const SKRIP = `
local now = tonumber(ARGV[1])
local out = {}
for i = 1, #KEYS / 2 do
  local k, t = KEYS[2 * i - 1], KEYS[2 * i]
  local maks, decay = tonumber(ARGV[2 * i]), tonumber(ARGV[2 * i + 1])
  local hits = tonumber(redis.call('GET', k) or '0')
  if hits >= maks then
    local timer = redis.call('GET', t)
    if timer then
      out[#out + 1] = hits
      out[#out + 1] = tonumber(timer)
      return {i, out}
    end
    redis.call('DEL', k)
  end
  redis.call('SET', t, now + decay, 'EX', decay, 'NX')
  redis.call('SET', k, 0, 'EX', decay, 'NX')
  out[#out + 1] = redis.call('INCR', k)
  out[#out + 1] = tonumber(redis.call('GET', t) or (now + decay))
end
return {0, out}
`;

const BATAS_KUNCI_MEMORI = 50_000;
const JEDA_SETELAH_GAGAL_MS = 5_000;

type EntriMemori = { hits: number; habis: number; timer: number };

/** Cadangan per-instance: logika sama dengan skrip Lua, kedaluwarsa = TTL Valkey. */
export class MemoriBatas {
    private peta = new Map<string, EntriMemori>();

    jalankan(entri: { kunci: string; maks: number; detik: number }[], now: number): Mentah {
        const langkah: Langkah[] = [];
        for (const [i, { kunci, maks, detik }] of entri.entries()) {
            let e = this.ambil(kunci, now);
            if (e && e.hits >= maks) {
                if (e.timer > now) return { gagal: i + 1, langkah: [...langkah, { hits: e.hits, timer: e.timer }] };
                e = undefined;
            }
            if (!e) {
                this.rapikan(now);
                e = { hits: 0, habis: now + detik, timer: now + detik };
                this.peta.set(kunci, e);
            }
            e.hits++;
            langkah.push({ hits: e.hits, timer: e.timer });
        }
        return { gagal: 0, langkah };
    }

    private ambil(kunci: string, now: number) {
        const e = this.peta.get(kunci);
        if (e && e.habis <= now) this.peta.delete(kunci);
        return e && e.habis > now ? e : undefined;
    }

    // shortcut: saat penuh, entri tertua dibuang (kuotanya ikut reset); cukup selama Valkey mati sebentar.
    private rapikan(now: number) {
        if (this.peta.size < BATAS_KUNCI_MEMORI) return;
        for (const [k, e] of this.peta) if (e.habis <= now) this.peta.delete(k);
        if (this.peta.size >= BATAS_KUNCI_MEMORI) this.peta.delete(this.peta.keys().next().value!);
    }
}

const memori = new MemoriBatas();
let lewatiValkeySampai = 0;

/** Kunci penyimpanan untuk limiter bernama; `nama` null = throttle tanpa nama (`throttle:6,1`), kunci apa adanya. */
export function kunciPenyimpanan(nama: string | null, kunci: string): string {
    return nama === null
        ? kunci
        : createHash('md5')
              .update(nama + kunci)
              .digest('hex');
}

type DenganSkrip = Redis & { batas(numKeys: number, ...keysDanArgs: (string | number)[]): Promise<[number, number[]]> };
const sudahDidefinisikan = new WeakSet<Redis>();

/**
 * EVALSHA (hanya hash 40 byte per permintaan, bukan teks skrip). Bila Valkey menjawab NOSCRIPT (restart, SCRIPT
 * FLUSH, failover), ioredis otomatis mengulang dengan EVAL yang sekaligus memuat ulang skrip.
 */
function denganSkrip(r: Redis): DenganSkrip {
    if (!sudahDidefinisikan.has(r)) {
        r.defineCommand('batas', { lua: SKRIP });
        sudahDidefinisikan.add(r);
    }
    return r as DenganSkrip;
}

async function jalankanValkey(entri: { kunci: string; maks: number; detik: number }[], now: number): Promise<Mentah> {
    const keys = entri.flatMap(({ kunci }) => [`batas:${kunci}`, `batas:${kunci}:timer`]);
    const args = [now, ...entri.flatMap(({ maks, detik }) => [maks, detik])];
    const [gagal, datar] = await denganValkey((r) => denganSkrip(r).batas(keys.length, ...keys, ...args));
    const langkah: Langkah[] = [];
    for (let i = 0; i < datar.length; i += 2) langkah.push({ hits: datar[i], timer: datar[i + 1] });
    return { gagal, langkah };
}

/**
 * Cek & catat percobaan untuk satu limiter (padanan middleware `throttle:<nama>`). Tidak pernah melempar karena
 * Valkey: galat apa pun → cadangan memori, dan Valkey dilewati 5 dtk agar request tidak tertahan timeout berulang.
 */
export async function cobaBatas(nama: string | null, limits: Limit[], now = Math.floor(Date.now() / 1000)): Promise<HasilBatas> {
    const entri = limits.map((l) => ({ kunci: kunciPenyimpanan(nama, l.kunci), maks: l.maks, detik: l.detik }));
    let mentah: Mentah | undefined;
    let sumber: HasilBatas['sumber'] = 'valkey';
    if (Date.now() >= lewatiValkeySampai) {
        try {
            mentah = await jalankanValkey(entri, now);
        } catch (err) {
            lewatiValkeySampai = Date.now() + JEDA_SETELAH_GAGAL_MS;
            log.warn({ err }, 'rate limit memakai memori proses (Valkey tidak tersedia)');
        }
    }
    if (!mentah) {
        sumber = 'memori';
        mentah = memori.jalankan(entri, now);
    }
    return rangkum(limits, mentah, now, sumber);
}

function rangkum(limits: Limit[], { gagal, langkah }: Mentah, now: number, sumber: HasilBatas['sumber']): HasilBatas {
    if (gagal > 0) {
        const retryAfter = Math.max(0, langkah[gagal - 1].timer - now);
        return { lolos: false, header: headerGagal(limits[gagal - 1].maks, retryAfter, now), retryAfter, sumber };
    }
    // ThrottleRequests::addHeaders: header Limit berikutnya hanya menimpa bila sisanya lebih kecil.
    let header: HeaderBatas | undefined;
    let sisaTerkecil = Infinity;
    for (const [i, { hits }] of langkah.entries()) {
        const sisa = Math.max(0, limits[i].maks - hits);
        if (sisa < sisaTerkecil) {
            sisaTerkecil = sisa;
            header = headerLolos(limits[i].maks, sisa);
        }
    }
    return { lolos: true, header: header ?? {}, sumber };
}

/** Hanya untuk test: pulihkan pemutus Valkey. */
export function resetPemutusValkey() {
    lewatiValkeySampai = 0;
}
