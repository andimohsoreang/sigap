import 'server-only';

import type { RuteZiggy, ZiggyConfig } from '@/lib/ziggy';
import { adalahAdmin, type Pengguna } from '@/server/auth/peran';

// `@routes($ziggyGroups)` di app.blade.php (A-14): hanya grup rute peran pengguna yang dikirim ke browser, supaya
// struktur panel admin & portal warga tidak bocor ke tamu. Daftar dari scripts/rute-ziggy.mjs (Laravel asli).
import rute from './ziggy-rute.json';

const GRUP = rute as Record<'public' | 'warga' | 'admin', Record<string, RuteZiggy>>;

/** Ziggy::__construct($group, url('/')): url = origin aplikasi, port dari URL itu (null bila bawaan skema). */
export function ziggyUntuk(pengguna: Pick<Pengguna, 'role'> | null, asal: string): ZiggyConfig {
    const grup = pengguna && adalahAdmin(pengguna) ? GRUP.admin : pengguna?.role === 'warga' ? GRUP.warga : null;
    const u = new URL(asal);
    return { url: u.origin, port: u.port ? Number(u.port) : null, defaults: {}, routes: { ...GRUP.public, ...grup } };
}
