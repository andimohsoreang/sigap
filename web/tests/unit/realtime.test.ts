import { createHmac } from 'node:crypto';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { serverUji } from './server-uji';

const diterima: { url: string; body: string }[] = [];
let status = 200;
const server = await serverUji((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
        diterima.push({ url: req.url!, body });
        res.writeHead(status, { 'Content-Type': 'application/json' }).end('{}');
    });
});
const port = new URL(server.url).port;
vi.stubEnv('REALTIME_APP_ID', 'cc-uji');
vi.stubEnv('REALTIME_APP_KEY', '278d425bdf160c739803');
vi.stubEnv('REALTIME_APP_SECRET', '7ad3773142a6692b25b8');
vi.stubEnv('REALTIME_HOST', '127.0.0.1');
vi.stubEnv('REALTIME_PORT', port);
const { tandaTanganKanal, terbitkan, urlBertandaTangan } = await import('@/server/realtime/penerbit');
const { bolehKanal, KANAL, siaran } = await import('@/server/realtime/kanal');
const { opsiRealtime } = await import('@/lib/realtime');
afterAll(async () => {
    await server.tutup();
    vi.unstubAllEnvs();
});

const KUNCI = { key: '278d425bdf160c739803', secret: '7ad3773142a6692b25b8' };

describe('tanda tangan Pusher (vektor dokumentasi Pusher HTTP API & channel auth)', () => {
    it('auth_signature & body_md5', () => {
        const body = '{"name":"foo","channels":["project-3"],"data":"{\\"some\\":\\"data\\"}"}';
        expect(urlBertandaTangan('POST', '/apps/3/events', body, KUNCI, 1353088179)).toBe(
            '/apps/3/events?auth_key=278d425bdf160c739803&auth_timestamp=1353088179&auth_version=1.0&body_md5=ec365a775a4cd0599faeb73354201b6f' +
                '&auth_signature=da454824c97ba181a32ccc17a72625ba02771f50b50e1e7430e47a1f3f457e6c',
        );
    });

    it('izin kanal privat', () => {
        expect(tandaTanganKanal('1234.1234', 'private-foobar')).toEqual({
            auth: '278d425bdf160c739803:58df8b0c36d6982b82c3ecf6b4662e34fe8c25bba48f5369f135bf843651c3a4',
        });
        expect(() => tandaTanganKanal('1234.1234:private-lain', 'private-foobar')).toThrow(/socket_id/);
    });
});

describe('terbitkan', () => {
    it('POST /apps/{id}/events bertanda tangan; data = string JSON', async () => {
        diterima.length = 0;
        await terbitkan(siaran.chatUnreadChanged(12, 4));
        expect(diterima).toHaveLength(1);
        const u = new URL(diterima[0].url, 'http://x');
        expect(u.pathname).toBe('/apps/cc-uji/events');
        expect(JSON.parse(diterima[0].body)).toEqual({
            name: 'chat.unread',
            channels: ['private-admin.chat'],
            data: '{"conversation_id":12,"total":4}',
        });
        // Server memverifikasi dengan cara yang sama.
        const param = [...u.searchParams].filter(([k]) => k !== 'auth_signature').sort(([a], [b]) => a.localeCompare(b));
        const tanda = createHmac('sha256', KUNCI.secret)
            .update(`POST\n${u.pathname}\n${param.map(([k, v]) => `${k}=${v}`).join('&')}`)
            .digest('hex');
        expect(u.searchParams.get('auth_signature')).toBe(tanda);
    });

    it('kanal dipecah per 100; tanpa kanal tidak mengirim apa pun', async () => {
        diterima.length = 0;
        const ids = Array.from({ length: 250 }, (_, i) => i + 1);
        await terbitkan(
            siaran.ticketChanged({ event: 'created', nomor: 'T', judul: 'J', status: null, impact: null, is_internal: false, created_at: null }, [
                ...ids,
                1,
            ]),
        );
        expect(diterima.map((d) => JSON.parse(d.body).channels.length)).toEqual([100, 100, 50]);
        diterima.length = 0;
        await terbitkan(
            siaran.ticketChanged({ event: 'x', nomor: 'T', judul: 'J', status: null, impact: null, is_internal: false, created_at: null }, []),
        );
        expect(diterima).toEqual([]);
    });

    it('galat server & payload terlalu besar dilempar (dispatcher outbox mencoba lagi)', async () => {
        status = 500;
        await expect(terbitkan(siaran.chatUnreadChanged(1, 1))).rejects.toThrow(/500/);
        status = 200;
        const besar = siaran.notificationBroadcast(1, { body: 'x'.repeat(101 * 1024) });
        await expect(terbitkan(besar)).rejects.toThrow(/melebihi/);
    });
});

describe('registry kanal & event Laravel', () => {
    it('nama kanal & event', () => {
        expect(
            siaran.chatMessageSent({ id: 1, conversation_id: 9, body: 'hai', sender_type: 'user', mine: true, penulis: 'Anda', pada: null }),
        ).toMatchObject({
            event: 'chat.message',
            kanal: ['private-chat.9'],
        });
        expect(
            siaran.ticketChanged(
                { event: 'status', nomor: 'T', judul: 'J', status: 'baru', impact: null, is_internal: true, created_at: null },
                [3, 1, 3],
            ).kanal,
        ).toEqual(['private-user.3', 'private-user.1']);
        expect(siaran.notificationBroadcast(5, { title: null as unknown as string })).toEqual({
            event: 'notification.incoming',
            kanal: ['private-user.5'],
            data: { event: 'notifikasi', title: 'Contact Center — Notifikasi', body: '', meta: [], cta_url: null },
        });
    });

    it('aturan izin channels.php', async () => {
        const pemilik = vi.fn(async (c: number, u: number) => c === 9 && u === 2);
        const warga = { id: 2, admin: false };
        const admin = { id: 1, admin: true };
        expect(await bolehKanal(KANAL.chat(9), warga, pemilik)).toBe(true);
        expect(await bolehKanal(KANAL.chat(8), warga, pemilik)).toBe(false);
        expect(await bolehKanal(KANAL.chat(8), admin, pemilik)).toBe(true);
        expect(await bolehKanal(KANAL.adminChat(), warga, pemilik)).toBe(false);
        expect(await bolehKanal(KANAL.adminChat(), admin, pemilik)).toBe(true);
        expect(await bolehKanal(KANAL.user(2), warga, pemilik)).toBe(true);
        expect(await bolehKanal(KANAL.user(1), warga, pemilik)).toBe(false);
        expect(await bolehKanal(KANAL.user(2), null, pemilik)).toBe(false);
        expect(await bolehKanal('private-chat.9x', admin, pemilik)).toBe(false);
        expect(await bolehKanal('private-lain', admin, pemilik)).toBe(false);
    });
});

describe('opsi pusher-js browser', () => {
    it('same-origin /_realtime, TLS, hanya kunci publik; kunci kosong → null', () => {
        expect(opsiRealtime(' kunci ', 'cc-uji.contoh.test')).toEqual({
            key: 'kunci',
            options: {
                cluster: '',
                wsHost: 'cc-uji.contoh.test',
                wsPath: '/_realtime',
                forceTLS: true,
                enabledTransports: ['ws', 'wss'],
                channelAuthorization: { endpoint: '/broadcasting/auth', transport: 'ajax' },
            },
        });
        expect(opsiRealtime('', 'h')).toBeNull();
        expect(opsiRealtime(undefined, 'h')).toBeNull();
    });
});
