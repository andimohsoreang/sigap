import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Program5T from '@/components/sigap/program-5t';

describe('Program 5T di beranda', () => {
    it('menampilkan lima program dan membuka uraian resmi di modal', () => {
        render(<Program5T />);

        const cards = screen.getAllByRole('button', { name: /Lihat program|Trans/ });
        expect(cards).toHaveLength(5);

        fireEvent.click(screen.getByRole('button', { name: /Trans Tuntas/ }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByRole('heading', { name: 'Trans Tuntas' })).toBeInTheDocument();
        expect(within(dialog).getByText(/program penyelesaian menyeluruh atas persoalan lahan/)).toBeInTheDocument();
        expect(within(dialog).getAllByRole('link', { name: /Situs resmi|Program Unggulan/ })[0]).toHaveAttribute(
            'href',
            'https://www.transmigrasi.go.id/programunggulan/#transtuntas',
        );
    });

    it('tombol sebelumnya/berikutnya berputar di antara lima program', () => {
        render(<Program5T />);
        fireEvent.click(screen.getByRole('button', { name: /Trans Gotong Royong/ }));

        fireEvent.click(screen.getByRole('button', { name: /Program berikutnya/ }));
        expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Trans Tuntas' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Program sebelumnya/ }));
        expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Trans Gotong Royong' })).toBeInTheDocument();
    });
});
