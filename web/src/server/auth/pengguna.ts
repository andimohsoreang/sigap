import 'server-only';

import { eq } from 'drizzle-orm';

import { db, type Db } from '@/server/db/client';
import { users } from '@/server/db/schema';

import type { Pengguna } from './peran';

// Kolom `nik` (terenkripsi) sengaja TIDAK dibaca: Eloquent mendekripsi cast secara malas, jadi NIK yang tak terbaca
// tidak menggagalkan login Laravel — begitu pula di sini.
export const kolomPengguna = {
    id: users.id,
    name: users.name,
    username: users.username,
    role: users.role,
    isActive: users.isActive,
    password: users.password,
    emailVerifiedAt: users.emailVerifiedAt,
    registeredBy: users.registeredBy,
    regionId: users.regionId,
    rememberToken: users.rememberToken,
};

/** EloquentUserProvider::retrieveById. */
export async function ambilPengguna(id: number, d: Db = db): Promise<Pengguna | null> {
    const [p] = await d.select(kolomPengguna).from(users).where(eq(users.id, id));
    return p ?? null;
}
