import { request } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import { berhentiAnggun } from '@/server/berhenti';

import { serverUji } from './server-uji';

const ambil = (url: string) =>
    new Promise<number>((ok, gagal) =>
        request(url, (res) => res.resume().on('end', () => ok(res.statusCode ?? 0)))
            .on('error', gagal)
            .end(),
    );

describe('berhentiAnggun', () => {
    it('menolak koneksi baru, menuntaskan request berjalan, lalu keluar 0', async () => {
        const srv = await serverUji((_req, res) => setTimeout(() => res.end('ok'), 300));
        const keluar = vi.fn();
        const berjalan = ambil(`${srv.url}/lambat`);
        await vi.waitFor(() => expect(srv.permintaan).toHaveLength(1));

        berhentiAnggun(5000, keluar)();

        await expect(ambil(`${srv.url}/baru`)).rejects.toMatchObject({ code: 'ECONNREFUSED' });
        expect(keluar).not.toHaveBeenCalled();
        expect(await berjalan).toBe(200);
        await vi.waitFor(() => expect(keluar).toHaveBeenCalledWith(0));
    });

    it('keluar 1 bila request tidak selesai sebelum batas', async () => {
        const srv = await serverUji(() => {});
        const keluar = vi.fn();
        ambil(`${srv.url}/macet`).catch(() => {});
        await vi.waitFor(() => expect(srv.permintaan).toHaveLength(1));

        berhentiAnggun(100, keluar)();

        await vi.waitFor(() => expect(keluar).toHaveBeenCalledWith(1));
        expect(keluar).toHaveBeenCalledTimes(1);
    });
});
