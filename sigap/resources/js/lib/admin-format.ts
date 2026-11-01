/**
 * Format tanggal panel admin ("—" bila kosong). Dipisah dari halaman agar
 * halaman Inertia tidak saling mengimpor: modul halaman yang juga diimpor
 * statis kehilangan entri sendiri di manifest Vite (`@vite` gagal memuatnya).
 */
export function formatDate(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const DAY = 86_400_000;

/** Tenggat SLA relatif ("Lewat 3 hari" / "Sisa 5 jam"); hanya untuk tiket yang masih berjalan. */
export function slaDeadline(iso: string | null, open: boolean): { text: string; tone: 'late' | 'soon' | 'ok' | 'none' } {
    if (!iso || !open) return { text: '—', tone: 'none' };
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    const span = abs >= DAY ? `${Math.round(abs / DAY)} hari` : `${Math.max(1, Math.round(abs / 3_600_000))} jam`;
    if (diff < 0) return { text: `Lewat ${span}`, tone: 'late' };
    return { text: `Sisa ${span}`, tone: diff < 2 * DAY ? 'soon' : 'ok' };
}

/** Status tiket yang masih berjalan (tenggat SLA masih berlaku). */
export const OPEN_STATUSES = ['baru', 'verifikasi', 'diproses'];

/** Label sumber laporan Input Manual (StoreInputManualRequest). */
export const SOURCE_LABEL: Record<string, string> = {
    tatap_muka: 'Datang langsung',
    call_center: 'Telepon call center',
    surat: 'Surat / pos',
    live_chat: 'Live chat Contact Center',
    instagram: 'Instagram',
    x: 'X / Twitter',
    facebook: 'Facebook',
    tiktok: 'TikTok',
};
