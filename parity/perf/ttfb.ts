// Beban ringan LOKAL (indikatif; angka gerbang p95 < 300 ms diambil dari stack uji): TTFB per halaman S1 dengan
// KLIEN permintaan bersamaan selama DETIK detik per halaman, tanpa cookie (setiap permintaan = kunjungan pertama,
// sesi baru — sama untuk Laravel & Next.js). TTFB = mulai permintaan → header respons diterima.
//   BASE_URL=http://127.0.0.1:3124 node perf/ttfb.ts      (KLIEN=10 DETIK=30 PEMANASAN=3)
import http from 'node:http';

import { S1_PAGES } from '../tests/s1.ts';

const base = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3124');
const KLIEN = Number(process.env.KLIEN ?? 10);
const DETIK = Number(process.env.DETIK ?? 30);
const PEMANASAN = Number(process.env.PEMANASAN ?? 3);
const agent = new http.Agent({ keepAlive: true, maxSockets: KLIEN });

/** Satu GET: TTFB (ms) atau galat (status ≠ 200 / jaringan). Body dibaca habis agar koneksi bisa dipakai ulang. */
function ambil(path: string): Promise<number | string> {
    return new Promise((selesai) => {
        const t0 = performance.now();
        const req = http.get(new URL(path, base), { agent }, (res) => {
            const ttfb = performance.now() - t0;
            res.resume();
            res.on('end', () => selesai(res.statusCode === 200 ? ttfb : `status ${res.statusCode}`));
            res.on('error', (e) => selesai(e.message));
        });
        req.on('error', (e) => selesai(e.message));
    });
}

/** KLIEN pekerja berulang selama `detik`; mengembalikan semua TTFB & galat. */
async function beban(path: string, detik: number) {
    const akhir = performance.now() + detik * 1000;
    const ttfb: number[] = [];
    const galat: string[] = [];
    await Promise.all(
        Array.from({ length: KLIEN }, async () => {
            while (performance.now() < akhir) {
                const r = await ambil(path);
                if (typeof r === 'number') ttfb.push(r);
                else galat.push(r);
            }
        }),
    );
    return { ttfb, galat };
}

/** Persentil nearest-rank. */
const persentil = (urut: number[], p: number) => urut[Math.min(urut.length - 1, Math.ceil((p / 100) * urut.length) - 1)];

console.log(`target ${base.origin}, ${KLIEN} klien, ${DETIK} dtk/halaman (pemanasan ${PEMANASAN} dtk)`);
console.log('halaman              n      req/dtk  p50 ms  p95 ms  p99 ms  maks ms  galat');
for (const { path } of S1_PAGES) {
    await beban(path, PEMANASAN);
    const { ttfb, galat } = await beban(path, DETIK);
    const urut = ttfb.sort((a, b) => a - b);
    const f = (v: number | undefined) => (v === undefined ? '-' : v.toFixed(1)).padStart(7);
    console.log(
        `${path.padEnd(20)} ${String(urut.length).padStart(6)} ${(urut.length / DETIK).toFixed(1).padStart(8)} ${f(persentil(urut, 50))} ${f(persentil(urut, 95))} ${f(persentil(urut, 99))} ${f(urut.at(-1))}   ${galat.length}${galat.length ? ` (${[...new Set(galat)].slice(0, 3).join(', ')})` : ''}`,
    );
}
agent.destroy();
