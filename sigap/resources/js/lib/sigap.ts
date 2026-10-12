import { cn } from '@/lib/utils';

/** Label & warna status tiket (paritas tampilan lama). */
export const STATUS_LABELS: Record<string, string> = {
    baru: 'Menunggu',
    verifikasi: 'Diverifikasi',
    diproses: 'Diproses',
    selesai: 'Selesai',
    ditolak: 'Ditolak',
};

export const STATUS_CLASSES: Record<string, string> = {
    baru: 'bg-amber-100 text-amber-700',
    verifikasi: 'bg-sky-100 text-sky-700',
    diproses: 'bg-blue-100 text-blue-700',
    selesai: 'bg-emerald-100 text-emerald-700',
    ditolak: 'bg-rose-100 text-rose-700',
};

export const PRIORITY_LABELS: Record<string, string> = {
    umum: 'Umum',
    prioritas: 'Prioritas',
    darurat: 'Darurat',
};

export const PRIORITY_CLASSES: Record<string, string> = {
    umum: 'bg-slate-100 text-slate-700',
    prioritas: 'bg-amber-100 text-amber-700',
    darurat: 'bg-red-100 text-red-700',
};

export const IMPACT_LABELS: Record<string, string> = {
    rendah: 'Rendah',
    sedang: 'Sedang',
    tinggi: 'Tinggi',
    kritis: 'Kritis',
};

export function statusLabel(status?: string | null): string {
    return status ? (STATUS_LABELS[status] ?? status) : '-';
}

export function statusClass(status?: string | null): string {
    return status ? (STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-700') : 'bg-gray-100 text-gray-700';
}

export function formatDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Nomor tiket. Format baru `TKT-YYMMDD-XXXXXX` (6 karakter dari alfabet tanpa
 * huruf/angka ambigu: 0/O, 1/I/L), format lama `TKT-<angka>` tetap berlaku.
 * Tidak peka huruf besar/kecil — input dinormalisasi ke huruf besar.
 */
export const TICKET_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TICKET_NO_PATTERN = /^TKT-(?:\d{6}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}|\d{1,10})$/i;
export const TICKET_NO_EXAMPLE = 'TKT-261012-7KQ4MZ';

export function normalizeTicketNo(value?: string | null): string {
    return (value ?? '').trim().toUpperCase();
}

/** Format lama `TKT-<n>`: tamu wajib menyertakan kode akses saat melacak. */
export const LEGACY_TICKET_NO_PATTERN = /^TKT-\d{1,10}$/i;

export function isLegacyTicketNo(value?: string | null): boolean {
    return LEGACY_TICKET_NO_PATTERN.test(normalizeTicketNo(value));
}

export function isValidTicketNo(value?: string | null): boolean {
    return TICKET_NO_PATTERN.test(normalizeTicketNo(value));
}

export { cn };
