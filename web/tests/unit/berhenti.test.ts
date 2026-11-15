import { describe, expect, it, vi } from 'vitest';

import { berhentiAnggun } from '@/server/berhenti';

import { serverUji } from './server-uji';

describe('berhentiAnggun', () => {
    it('menutup koneksi keep-alive yang menganggur setelah close() agar tidak menunggu keepAliveTimeout', async () => {
        const srv = await serverUji((_req, res) => setTimeout(() => res.end('ok'), 200));
        // fetch memakai keep-alive: koneksi tetap terbuka setelah respons, tapi masih sibuk saat close() dipanggil.
        const berjalan = fetch(`${srv.url}/lambat`).then((r) => r.status);
        await vi.waitFor(() => expect(srv.permintaan).toHaveLength(1));
        const keluar = vi.fn();

        berhentiAnggun(5000, keluar)();
        const mulai = Date.now();
        await srv.tutup(); // seperti server.close() pada cleanup Next.js

        expect(await berjalan).toBe(200);
        expect(Date.now() - mulai).toBeLessThan(1000);
        expect(keluar).not.toHaveBeenCalled();
    });

    it('keluar 1 bila belum selesai sebelum batas', async () => {
        const keluar = vi.fn();
        berhentiAnggun(100, keluar)();
        await vi.waitFor(() => expect(keluar).toHaveBeenCalledWith(1));
        expect(keluar).toHaveBeenCalledTimes(1);
    });
});
