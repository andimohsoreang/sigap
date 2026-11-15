import 'server-only';

// serialize()/unserialize() PHP minimal untuk payload sesi Laravel: null, bool, int, float, string, array.
// Objek (O:, C:), referensi (R:, r:), enum (E:) dan tipe lain DITOLAK: tidak ada permukaan gadget.

/** Float PHP (`d:`), dibedakan dari int (`i:`) agar serialize ulang identik byte. */
export class DesimalPhp {
    constructor(readonly nilai: number) {}
}

/** Array PHP: urutan dijaga, kunci int (number) atau string. */
export type ArrayPhp = Map<number | string, NilaiPhp>;
export type NilaiPhp = null | boolean | number | string | DesimalPhp | ArrayPhp;

export type JenisGalatSerial = 'rusak' | 'tidak-didukung' | 'batas';

export class GalatSerial extends Error {
    override name = 'GalatSerial';
    constructor(
        readonly jenis: JenisGalatSerial,
        pesan: string,
    ) {
        super(pesan);
    }
}

export const BATAS_SERIAL = { byte: 1024 * 1024, kedalaman: 32 };

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Kunci string berbentuk int kanonik ("5", "-3", bukan "05"/"-0") menjadi int, seperti hash table PHP. */
export function kunciPhp(kunci: number | string): number | string {
    if (typeof kunci === 'number') return kunci;
    if (!/^(0|-?[1-9]\d*)$/.test(kunci)) return kunci;
    const n = Number(kunci);
    // shortcut: int 64-bit di luar 2^53 tetap string (PHP menjadikannya int); belum pernah ada di sesi aplikasi.
    return Number.isSafeInteger(n) ? n : kunci;
}

export function unserialize(input: Buffer | string, batas = BATAS_SERIAL): NilaiPhp {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    if (buf.length > batas.byte) throw new GalatSerial('batas', `Data serial melebihi ${batas.byte} byte`);
    let pos = 0;

    const rusak = (pesan: string): never => {
        throw new GalatSerial('rusak', `${pesan} pada posisi ${pos}`);
    };
    const harap = (c: string) => {
        if (buf[pos] !== c.charCodeAt(0)) rusak(`Diharapkan '${c}'`);
        pos++;
    };
    const sampai = (akhir: string): string => {
        const i = buf.indexOf(akhir, pos);
        if (i < 0) rusak(`'${akhir}' tidak ditemukan`);
        const s = buf.toString('latin1', pos, i);
        pos = i + 1;
        return s;
    };
    const bacaInt = (akhir: string): number => {
        const s = sampai(akhir);
        if (!/^[+-]?\d+$/.test(s)) rusak('Int tidak sah');
        const n = Number(s);
        if (!Number.isSafeInteger(n)) throw new GalatSerial('tidak-didukung', `Int di luar batas aman JavaScript: ${s}`);
        return n;
    };
    const bacaString = (): string => {
        harap(':');
        const panjang = bacaInt(':');
        harap('"');
        if (panjang < 0 || pos + panjang + 2 > buf.length) rusak('Panjang string tidak sah');
        let s = '';
        try {
            s = utf8.decode(buf.subarray(pos, pos + panjang));
        } catch {
            throw new GalatSerial('tidak-didukung', 'String bukan UTF-8');
        }
        pos += panjang;
        harap('"');
        harap(';');
        return s;
    };

    const bacaKunci = (): number | string => {
        const t = String.fromCharCode(buf[pos++] ?? 0);
        if (t === 's') return kunciPhp(bacaString());
        if (t !== 'i') {
            pos--;
            rusak('Kunci array harus int atau string');
        }
        harap(':');
        return bacaInt(';');
    };

    const nilai = (kedalaman: number): NilaiPhp => {
        const tipe = String.fromCharCode(buf[pos++] ?? 0);
        switch (tipe) {
            case 'N':
                harap(';');
                return null;
            case 'b': {
                harap(':');
                const s = sampai(';');
                if (s !== '0' && s !== '1') rusak('Bool tidak sah');
                return s === '1';
            }
            case 'i':
                harap(':');
                return bacaInt(';');
            case 'd': {
                harap(':');
                const s = sampai(';');
                if (s === 'INF') return new DesimalPhp(Infinity);
                if (s === '-INF') return new DesimalPhp(-Infinity);
                if (s === 'NAN') return new DesimalPhp(NaN);
                if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) rusak('Float tidak sah');
                return new DesimalPhp(Number(s));
            }
            case 's':
                return bacaString();
            case 'a': {
                if (kedalaman >= batas.kedalaman) throw new GalatSerial('batas', `Array lebih dalam dari ${batas.kedalaman} tingkat`);
                harap(':');
                const jumlah = bacaInt(':');
                // Setiap elemen minimal 4 byte ("N;N;"), jadi jumlah lebih besar pasti data rusak.
                if (jumlah < 0 || jumlah * 4 > buf.length - pos) rusak('Jumlah elemen tidak sah');
                harap('{');
                const arr: ArrayPhp = new Map();
                for (let i = 0; i < jumlah; i++) {
                    const kunci = bacaKunci();
                    // Kunci ganda: nilai ditimpa di posisi lama, seperti unserialize PHP.
                    arr.set(kunci, nilai(kedalaman + 1));
                }
                harap('}');
                return arr;
            }
            case 'O':
            case 'C':
            case 'R':
            case 'r':
            case 'E':
            case 'S':
                throw new GalatSerial('tidak-didukung', `Tipe serial PHP '${tipe}' ditolak`);
            default:
                pos--;
                return rusak('Tipe serial tidak dikenal');
        }
    };

    const hasil = nilai(0);
    if (pos !== buf.length) rusak('Ada data sisa');
    return hasil;
}

/** Format float serialize() PHP 8 (serialize_precision -1): digit terpendek, eksponen bila desimal < -3 atau > 17. */
function formatFloat(n: number): string {
    if (Number.isNaN(n)) return 'NAN';
    if (n === Infinity) return 'INF';
    if (n === -Infinity) return '-INF';
    if (n === 0) return Object.is(n, -0) ? '-0' : '0';
    const tanda = n < 0 ? '-' : '';
    const [mantissa, eksponen] = Math.abs(n).toExponential().split('e');
    const digit = mantissa.replace('.', '');
    const titik = Number(eksponen) + 1;
    if (titik < -3 || titik > 17) {
        const e = titik - 1;
        return `${tanda}${digit[0]}.${digit.slice(1) || '0'}E${e < 0 ? '-' : '+'}${Math.abs(e)}`;
    }
    if (titik <= 0) return `${tanda}0.${'0'.repeat(-titik)}${digit}`;
    if (digit.length <= titik) return tanda + digit + '0'.repeat(titik - digit.length);
    return `${tanda}${digit.slice(0, titik)}.${digit.slice(titik)}`;
}

function serialString(s: string): string {
    return `s:${Buffer.byteLength(s, 'utf8')}:"${s}";`;
}

export function serialize(nilai: NilaiPhp): string {
    if (nilai === null) return 'N;';
    if (typeof nilai === 'boolean') return nilai ? 'b:1;' : 'b:0;';
    if (typeof nilai === 'string') return serialString(nilai);
    if (nilai instanceof DesimalPhp) return `d:${formatFloat(nilai.nilai)};`;
    if (typeof nilai === 'number') {
        if (!Number.isInteger(nilai)) return `d:${formatFloat(nilai)};`;
        if (!Number.isSafeInteger(nilai)) throw new GalatSerial('tidak-didukung', `Int di luar batas aman JavaScript: ${nilai}`);
        return `i:${nilai};`;
    }
    let isi = '';
    for (const [k, v] of nilai) {
        const kunci = kunciPhp(k);
        isi += (typeof kunci === 'number' ? `i:${kunci};` : serialString(kunci)) + serialize(v);
    }
    return `a:${nilai.size}:{${isi}}`;
}

/** Bentuk json_encode PHP (daftar 0..n-1 → array, selain itu objek), untuk membaca & membandingkan isi. */
export function keJson(nilai: NilaiPhp): unknown {
    if (nilai instanceof DesimalPhp) return nilai.nilai;
    if (!(nilai instanceof Map)) return nilai;
    const kunci = [...nilai.keys()];
    if (kunci.every((k, i) => k === i)) return [...nilai.values()].map(keJson);
    return Object.fromEntries([...nilai].map(([k, v]) => [String(k), keJson(v)]));
}
