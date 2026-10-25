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
