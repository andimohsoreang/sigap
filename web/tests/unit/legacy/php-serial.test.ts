import { describe, expect, it } from 'vitest';

import { DesimalPhp, GalatSerial, keJson, serialize, unserialize, type JenisGalatSerial } from '@/server/legacy/php-serial';

import { fixture, type FixtureSerial } from './fixture';

const f = fixture<FixtureSerial>('serial.json');

function galat(fn: () => unknown): JenisGalatSerial | null {
    try {
        fn();
        return null;
    } catch (e) {
        if (e instanceof GalatSerial) return e.jenis;
        throw e;
    }
}

describe('php-serial: vektor serialize() PHP', () => {
    it.each(f.kasus)('$label: unserialize lalu serialize identik byte', ({ serial, json }) => {
        const nilai = unserialize(serial);
        expect(serialize(nilai)).toBe(serial);
        if (json !== null) expect(keJson(nilai)).toEqual(json);
    });

    it('int di luar 2^53 ditolak, bukan dibulatkan', () => {
        expect(galat(() => unserialize(f.int_di_luar_batas_js))).toBe('tidak-didukung');
        expect(galat(() => serialize(2 ** 60))).toBe('tidak-didukung');
    });
});

describe('php-serial: serialize dari nilai TS', () => {
    it('kunci string int kanonik menjadi int seperti PHP', () => {
        expect(
            serialize(
                new Map<number | string, string>([
                    ['5', 'a'],
                    ['05', 'b'],
                    ['-3', 'c'],
                    ['-0', 'd'],
                ]),
            ),
        ).toBe('a:4:{i:5;s:1:"a";s:2:"05";s:1:"b";i:-3;s:1:"c";s:2:"-0";s:1:"d";}');
    });

    it('number bukan bulat menjadi float, DesimalPhp tetap float', () => {
        expect(serialize(0.1)).toBe('d:0.1;');
        expect(serialize(new DesimalPhp(2))).toBe('d:2;');
        expect(serialize(1e-5)).toBe('d:1.0E-5;');
        expect(serialize(2)).toBe('i:2;');
    });

    it('panjang string dalam byte UTF-8', () => {
        expect(serialize('ñ🙂')).toBe('s:6:"ñ🙂";');
        expect(unserialize('s:6:"ñ🙂";')).toBe('ñ🙂');
    });
});

describe('php-serial: negatif', () => {
    it.each([
        ['objek O:', 'O:8:"stdClass":0:{}'],
        ['objek dalam array', 'a:1:{s:1:"x";O:8:"stdClass":0:{}}'],
        ['objek C:', 'C:11:"ArrayObject":21:{x:i:0;a:0:{};m:a:0:{}}'],
        ['referensi R:', 'a:2:{i:0;i:1;i:1;R:2;}'],
        ['referensi r:', 'a:2:{i:0;i:1;i:1;r:2;}'],
        ['enum E:', 'E:11:"Suit:Hearts";'],
        ['string S:', 'S:1:"\\61";'],
        ['string bukan UTF-8', Buffer.concat([Buffer.from('s:1:"'), Buffer.from([0xff]), Buffer.from('";')])],
    ])('%s ditolak sebagai tidak-didukung', (_, input) => {
        expect(galat(() => unserialize(input))).toBe('tidak-didukung');
    });

    it.each([
        ['terpotong', 'a:1:{s:1:"a";'],
        ['panjang string salah', 's:5:"abc";'],
        ['panjang string melewati akhir', 's:99:"abc";'],
        ['data sisa', 'i:1;x'],
        ['jumlah elemen mustahil', 'a:99999999:{}'],
        ['jumlah elemen kurang', 'a:2:{i:0;i:1;}'],
        ['kunci float', 'a:1:{d:1.5;i:1;}'],
        ['bool tidak sah', 'b:2;'],
        ['int tidak sah', 'i:1.5;'],
        ['kosong', ''],
        ['tipe tidak dikenal', 'x:1;'],
    ])('%s ditolak sebagai rusak', (_, input) => {
        expect(galat(() => unserialize(input))).toBe('rusak');
    });

    it('ukuran dan kedalaman dibatasi', () => {
        expect(galat(() => unserialize(`s:${2 * 1024 * 1024}:"${'a'.repeat(2 * 1024 * 1024)}";`))).toBe('batas');
        const dalam = 'a:1:{i:0;'.repeat(40) + 'N;' + '}'.repeat(40);
        expect(galat(() => unserialize(dalam))).toBe('batas');
        expect(galat(() => unserialize(dalam, { byte: 1024, kedalaman: 64 }))).toBeNull();
    });
});
