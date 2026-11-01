import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ColumnChart, GaugeChart, PieChart, StackedBarChart } from '@/components/sigap/charts';

const series = [
    { key: 'baru', label: 'Menunggu', color: 'red' },
    { key: 'selesai', label: 'Selesai', color: 'green' },
];

describe('Grafik Matriks Rekapitulasi', () => {
    it('pie menghitung persentase dan melewati irisan kosong', () => {
        render(
            <PieChart
                label="Kanal"
                slices={[
                    { key: 'web', label: 'Formulir web', value: 3, color: 'navy' },
                    { key: 'chat', label: 'Chat', value: 1, color: 'gold' },
                    { key: 'surat', label: 'Surat', value: 0, color: 'gray' },
                ]}
            />,
        );

        expect(screen.getByRole('img', { name: 'Kanal: Formulir web 3 (75%), Chat 1 (25%)' })).toBeInTheDocument();
        // Legenda tetap mencantumkan semua kanal, termasuk yang 0.
        expect(screen.getByText('Surat')).toBeInTheDocument();
    });

    it('pie kosong menampilkan pesan, bukan grafik', () => {
        render(<PieChart label="Kanal" slices={[{ key: 'web', label: 'Formulir web', value: 0, color: 'navy' }]} />);
        expect(screen.getByText('Belum ada data.')).toBeInTheDocument();
    });

    it('batang bertumpuk: seri bisa disembunyikan lewat legenda', () => {
        render(
            <StackedBarChart
                label="Status per provinsi"
                series={series}
                rows={[{ key: 'jambi', label: 'Jambi', values: { baru: 2, selesai: 3 }, href: '/admin/tiket?provinsi=Jambi' }]}
            />,
        );

        expect(screen.getByRole('link', { name: 'Jambi' })).toHaveAttribute('href', '/admin/tiket?provinsi=Jambi');
        expect(screen.getByText('5')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Menunggu' }));
        expect(screen.getByRole('button', { name: 'Menunggu' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Jambi: Selesai 3' })).toBeInTheDocument();
    });

    it('kolom menampilkan rincian seri saat disorot', () => {
        render(<ColumnChart label="SLA per dampak" series={series} groups={[{ key: 'kritis', label: 'Kritis', values: { baru: 1, selesai: 2 } }]} />);

        expect(screen.queryByText('Selesai: 2')).not.toBeInTheDocument();
        // Angka total di atas kolom (bukan label sumbu Y "3") berada di dalam elemen kolom yang memicu tooltip.
        const total = screen.getAllByText('3').find((el) => el.className.includes('font-semibold')) as HTMLElement;
        fireEvent.mouseEnter(total.parentElement as HTMLElement);
        expect(screen.getByText('Selesai: 2')).toBeInTheDocument();
        expect(screen.getByText('Menunggu: 1')).toBeInTheDocument();
    });

    it('gauge tanpa nilai menampilkan tanda kosong', () => {
        render(<GaugeChart value={null} display="—" label="SLA terpenuhi" caption="Belum ada tiket selesai" />);
        expect(screen.getByRole('img', { name: 'SLA terpenuhi: —' })).toBeInTheDocument();
    });
});
