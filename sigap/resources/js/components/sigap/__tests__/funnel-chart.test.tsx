import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FunnelChart } from '@/components/sigap/charts';

const stages = [
    { key: 'tara', label: 'Selesai oleh TARA', value: 6, color: 'green' },
    { key: 'petugas', label: 'Ditangani petugas', value: 3, color: 'blue' },
    { key: 'tanpa', label: 'Tanpa jawaban', value: 1, color: 'gray' },
];

describe('Corong layanan', () => {
    it('membagi semua percakapan lalu merinci segmen petugas', () => {
        const { container } = render(
            <FunnelChart
                total={10}
                totalLabel="Semua percakapan"
                stages={stages}
                drill={{
                    from: 'petugas',
                    label: 'Hasil petugas',
                    segments: [
                        { key: 'tiket', label: 'Jadi tiket', value: 2, color: 'navy' },
                        { key: 'berjalan', label: 'Masih ditangani', value: 1, color: 'orange' },
                        { key: 'lainnya', label: 'Lainnya', value: 0, color: 'gray' },
                    ],
                }}
            />,
        );

        expect(
            screen.getByRole('img', { name: 'Semua percakapan: Selesai oleh TARA 6 (60%), Ditangani petugas 3 (30%), Tanpa jawaban 1 (10%)' }),
        ).toBeInTheDocument();
        // Segmen kosong tidak digambar, tetapi tetap di legenda.
        expect(screen.getByRole('img', { name: 'Hasil petugas: Jadi tiket 2 (67%), Masih ditangani 1 (33%)' })).toBeInTheDocument();
        expect(screen.getByText('Lainnya')).toBeInTheDocument();
        // Penghubung berangkat dari posisi segmen "Ditangani petugas" (60%–90%).
        expect(container.querySelector('polygon')?.getAttribute('points')).toBe('60,0 90,0 100,24 0,24');
    });

    it('tanpa percakapan menampilkan pesan kosong', () => {
        render(
            <FunnelChart
                total={0}
                totalLabel="Semua percakapan"
                stages={stages.map((s) => ({ ...s, value: 0 }))}
                drill={{ from: 'petugas', label: 'Hasil', segments: [] }}
            />,
        );

        expect(screen.getByText('Belum ada data pada periode ini.')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('rincian disembunyikan bila tidak ada yang ditangani petugas', () => {
        const { container } = render(
            <FunnelChart
                total={2}
                totalLabel="Semua percakapan"
                stages={[{ key: 'tara', label: 'Selesai oleh TARA', value: 2, color: 'green' }]}
                drill={{ from: 'petugas', label: 'Hasil petugas', segments: [{ key: 'tiket', label: 'Jadi tiket', value: 0, color: 'navy' }] }}
            />,
        );

        expect(screen.queryByText('Hasil petugas')).not.toBeInTheDocument();
        expect(container.querySelector('polygon')).toBeNull();
    });
});
