import { reverbClientOptions } from '@/lib/reverb';
import { describe, expect, it } from 'vitest';

describe('reverbClientOptions', () => {
    it('mengembalikan null bila key kosong (realtime dilewati tanpa crash)', () => {
        expect(reverbClientOptions({})).toBeNull();
        expect(reverbClientOptions({ VITE_REVERB_APP_KEY: '  ', VITE_REVERB_HOST: 'localhost' })).toBeNull();
    });

    it('produksi https → wss port 443', () => {
        const opts = reverbClientOptions({
            VITE_REVERB_APP_KEY: 'abc',
            VITE_REVERB_HOST: 'app1.andimohamad.my.id',
            VITE_REVERB_PORT: '443',
            VITE_REVERB_SCHEME: 'https',
        });

        expect(opts).toMatchObject({ wsHost: 'app1.andimohamad.my.id', wssPort: 443, forceTLS: true, enabledTransports: ['wss'] });
    });

    it('lokal http → ws port 8080', () => {
        const opts = reverbClientOptions({
            VITE_REVERB_APP_KEY: 'abc',
            VITE_REVERB_HOST: 'localhost',
            VITE_REVERB_PORT: '8080',
            VITE_REVERB_SCHEME: 'http',
        });

        expect(opts).toMatchObject({ wsHost: 'localhost', wsPort: 8080, forceTLS: false, enabledTransports: ['ws'] });
    });

    it('port kosong/tidak valid memakai default skema', () => {
        expect(reverbClientOptions({ VITE_REVERB_APP_KEY: 'k', VITE_REVERB_HOST: 'h', VITE_REVERB_PORT: 'abc' })?.wssPort).toBe(443);
        expect(reverbClientOptions({ VITE_REVERB_APP_KEY: 'k', VITE_REVERB_HOST: 'h', VITE_REVERB_SCHEME: 'http' })?.wsPort).toBe(80);
    });

    it('host kosong memakai host halaman', () => {
        expect(reverbClientOptions({ VITE_REVERB_APP_KEY: 'k' }, 'contoh.test')?.wsHost).toBe('contoh.test');
    });
});
