// `router` @inertiajs/core, hanya `visit` GET tanpa data: navigasi penuh browser (halaman Next.js dirender ulang dari
// server, seperti tautan biasa). Callback kunjungan (onSuccess, onFinish, …) tidak dipanggil karena dokumen diganti;
// pemanggil yang menunggu callback harus punya batas waktu sendiri (lib/chat-transition.ts: 2,5 dtk).
// Method lain, data, dan fungsi router lain belum dipakai halaman yang sudah pindah → tidak diekspor / galat jelas.

export interface OpsiKunjungan {
    method?: string;
    data?: Record<string, unknown>;
    onBefore?: () => void;
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;
}

export const router = {
    visit(href: string | URL, opsi: OpsiKunjungan = {}): void {
        if ((opsi.method ?? 'get').toLowerCase() !== 'get' || (opsi.data && Object.keys(opsi.data).length > 0)) {
            throw new Error('router.visit: hanya GET tanpa data yang didukung lapisan kompatibilitas Inertia (src/lib/inertia)');
        }
        window.location.assign(new URL(href.toString(), window.location.href).href);
    },
};
