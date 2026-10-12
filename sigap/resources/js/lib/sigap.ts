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
    baru: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    verifikasi: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    diproses: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    selesai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ditolak: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export const PRIORITY_LABELS: Record<string, string> = {
    umum: 'Umum',
    prioritas: 'Prioritas',
    darurat: 'Darurat',
};

export const PRIORITY_CLASSES: Record<string, string> = {
    umum: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    prioritas: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    darurat: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
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

export { cn };