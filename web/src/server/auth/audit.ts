import 'server-only';

import { db, type Db } from '@/server/db/client';
import { activityLogs } from '@/server/db/schema';
import { log } from '@/server/log';

import type { Pengguna } from './peran';

// Port AuditService::safe (sigap/app/Services/AuditService.php) untuk aksi auth. Gagal mencatat tidak pernah
// menggagalkan alur utama. Slice lain yang butuh audit memakai fungsi ini juga.

export interface CatatanAudit {
    aksi: string;
    /** Auth::user() saat dicatat (null sebelum login). */
    pelaku: Pick<Pengguna, 'id' | 'username' | 'name'> | null;
    /** Subjek model User (subject_type App\Models\User). */
    subjekPengguna?: Pick<Pengguna, 'id'> | null;
    deskripsi: string;
    properti?: Record<string, unknown>;
    ip: string;
    userAgent: string | null;
}

/** substr($ua, 0, 255) per byte, seperti PHP; sisa karakter terpotong dibuang. */
function potongUa(ua: string | null): string | null {
    if (!ua) return null;
    const s = Buffer.from(ua, 'utf8').subarray(0, 255).toString('utf8').replace(/�+$/, '');
    return s === '' ? null : s;
}

export async function catatAudit(c: CatatanAudit, d: Db = db): Promise<void> {
    try {
        await d.insert(activityLogs).values({
            userId: c.pelaku?.id ?? null,
            username: c.pelaku ? (c.pelaku.username ?? c.pelaku.name) : null,
            action: c.aksi,
            subjectType: c.subjekPengguna ? 'App\\Models\\User' : null,
            subjectId: c.subjekPengguna ? String(c.subjekPengguna.id) : null,
            description: c.deskripsi,
            // `$properties ?: null`; JSON.stringify ≠ json_encode byte per byte (escape "/" & Unicode), nilainya sama.
            properties: c.properti && Object.keys(c.properti).length > 0 ? c.properti : null,
            ipAddress: c.ip,
            userAgent: potongUa(c.userAgent),
        });
    } catch (err) {
        log.warn({ err, aksi: c.aksi }, 'Audit log gagal');
    }
}
