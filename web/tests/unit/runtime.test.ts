import { describe, expect, it } from 'vitest';

import { JADWAL } from '@/server/antrean';
import { kunciIdempotensi } from '@/server/idempotensi';
import { idJobOutbox } from '@/server/outbox';

// Bagian murni runtime; perilaku DB-nya di tests/unit/db/runtime.test.ts (npm run test:db).

describe('kunciIdempotensi', () => {
    it('menerima 1–255 karakter ASCII tampak, selain itu null (diproses tanpa idempotensi)', () => {
        expect(kunciIdempotensi(' 7f1c-uuid ')).toBe('7f1c-uuid');
        expect(kunciIdempotensi('a'.repeat(255))).toHaveLength(255);
        for (const salah of [null, undefined, '', '   ', 'a'.repeat(256), 'ada spasi', 'ñ']) expect(kunciIdempotensi(salah)).toBeNull();
    });
});

describe('outbox', () => {
    it('id job pg-boss = UUID tetap per baris outbox', () => {
        expect(idJobOutbox(1)).toBe('00000000-0000-4000-8000-000000000001');
        expect(idJobOutbox(2 ** 40)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});

describe('jadwal Laravel', () => {
    it('9 entri bootstrap/app.php, masing-masing cron atau setiapDetik', () => {
        expect(JADWAL).toHaveLength(9);
        for (const j of JADWAL) expect(Boolean(j.cron) !== Boolean(j.setiapDetik)).toBe(true);
        expect(JADWAL.find((j) => j.nama === 'ai-macet')?.setiapDetik).toBe(15);
    });
});
