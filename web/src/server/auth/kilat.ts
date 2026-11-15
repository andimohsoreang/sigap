// Data flash sesi, semantik Illuminate\Session\Store (flash, ageFlashData, reflash). Fungsi murni atas objek data sesi.
//
// Laravel menua-kan flash di AKHIR setiap permintaan; di sini dilakukan di AWAL setiap permintaan (proxy.ts) sebelum
// rute membaca. Hasilnya sama: nilai yang di-flash pada permintaan N terbaca di N+1 lalu hilang di N+2.

export type DataSesi = Record<string, unknown>;

type DaftarKilat = { new: string[]; old: string[] };

function daftar(data: DataSesi): DaftarKilat {
    const f = data._flash as Partial<DaftarKilat> | undefined;
    const bersih = (x: unknown) => (Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : []);
    return { new: bersih(f?.new), old: bersih(f?.old) };
}

/** `$session->flash($kunci, $nilai)`: tersedia untuk permintaan berikutnya saja. */
export function kilatkan(data: DataSesi, kunci: string, nilai: unknown): void {
    const f = daftar(data);
    data[kunci] = nilai;
    data._flash = { new: [...new Set([...f.new, kunci])], old: f.old.filter((k) => k !== kunci) };
}

/**
 * ageFlashData: hapus kunci `old`, `new` menjadi `old`. `_flash` yang kosong dibuang (Laravel menyimpan
 * `{new: [], old: []}`; tidak terlihat), jadi sesi tanpa flash tidak ditulis ulang. True bila data berubah.
 */
export function umurkanKilat(data: DataSesi): boolean {
    const f = daftar(data);
    if (f.new.length === 0 && f.old.length === 0) {
        if (!('_flash' in data)) return false;
        delete data._flash;
        return true;
    }
    for (const k of f.old) delete data[k];
    if (f.new.length === 0) delete data._flash;
    else data._flash = { new: [], old: f.new };
    return true;
}

/** `$session->reflash()`: pertahankan flash satu permintaan lagi. False (tanpa perubahan) bila tidak ada flash lama. */
export function reflash(data: DataSesi): boolean {
    const f = daftar(data);
    if (f.old.length === 0) return false;
    data._flash = { new: [...new Set([...f.new, ...f.old])], old: [] };
    return true;
}

/** `$session->pull($kunci, $bawaan)`. */
export function tarik<T>(data: DataSesi, kunci: string, bawaan: T): unknown {
    if (!(kunci in data)) return bawaan;
    const nilai = data[kunci];
    delete data[kunci];
    return nilai;
}
