import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Kredensial fixture yang ditulis `php artisan sigap:e2e-setup` (storage/app/e2e). */
function credentials() {
    const file = path.resolve(__dirname, '../../storage/app/e2e/credentials.json');

    return JSON.parse(fs.readFileSync(file, 'utf-8')) as {
        username: string;
        password: string;
        warga_nik: string;
        tiket_awal: string[];
    };
}

/** Login admin lewat form /masuk. */
async function loginAsAdmin(page: Page) {
    const creds = credentials();

    await page.goto('/masuk');
    await page.getByLabel('NIK / Username').fill(creds.username);
    await page.getByLabel('Kata Sandi').fill(creds.password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/admin/);
}

test.describe('Alur utama SIGAP (TECH-SPEC §10)', () => {
    test('buat aduan publik → lacak → admin ubah status → survei', async ({ page }) => {
        // 1) Warga mengisi formulir pengaduan publik.
        await page.goto('/pengaduan/baru');
        await expect(page.getByRole('heading', { name: /lengkapi formulir aduan/i })).toBeVisible();

        await page.getByLabel('NIK (KTP)').fill('3273010101900002');
        await page.getByLabel('Nama Lengkap').fill('Pelapor E2E');
        await page.getByLabel('Judul Laporan').fill('Jalan kawasan rusak parah');
        await page.getByLabel('Uraian Laporan').fill('Badan jalan berlubang sepanjang 200 meter setelah hujan deras.');

        await page.getByRole('combobox', { name: 'Tingkat Dampak' }).click();
        await page.getByRole('option', { name: 'Tinggi' }).click();

        await page.getByRole('checkbox', { name: 'Pernyataan benar' }).click();
        await page.getByRole('button', { name: /Kirim Pengaduan/i }).click();

        // 2) Dialihkan ke halaman lacak dengan nomor tiket baru.
        await page.waitForURL(/\/lacak\/TKT-/);
        const ticketNo = page.url().split('/').pop() as string;
        expect(ticketNo).toMatch(/^TKT-/);
        await expect(page.getByText('Menunggu').first()).toBeVisible();

        // 3) Admin membuka detail tiket dan menandai selesai.
        await loginAsAdmin(page);
        await page.goto(`/admin/tiket/${ticketNo}`);
        await expect(page.getByText(ticketNo).first()).toBeVisible();

        // Transisi status mengikuti alur sah (Menunggu → Diproses → Selesai).
        for (const [status, note] of [
            ['Diproses', 'Petugas lapangan menuju lokasi.'],
            ['Selesai', 'Sudah ditangani petugas lapangan.'],
        ]) {
            await page.getByRole('combobox', { name: 'Status Baru' }).click();
            await page.getByRole('option', { name: status, exact: true }).click();
            await page.getByLabel('Catatan (opsional)').fill(note);
            const saved = page.waitForResponse((r) => r.url().includes(`/admin/tiket/${ticketNo}`) && r.request().method() === 'GET');
            await page.getByRole('button', { name: 'Simpan Status' }).click();
            await saved;
        }

        // 4) Halaman lacak publik kini menampilkan tombol survei.
        await page.goto(`/lacak/${ticketNo}`);
        await expect(page.getByText('Laporan Selesai Ditangani')).toBeVisible();

        await page.getByRole('button', { name: 'Isi Survei Kepuasan' }).click();
        await expect(page.getByRole('dialog', { name: 'Survei Kepuasan' })).toBeVisible();

        await page.getByRole('radio', { name: '5 bintang' }).click();
        await page.getByRole('button', { name: 'Kirim Penilaian' }).click();

        await expect(page.getByText(/Survei kepuasan sudah Anda kirim/i)).toBeVisible();
    });

    test('tamukan tidak bisa membuka panel admin', async ({ page }) => {
        await page.goto('/admin/tiket');
        await expect(page).toHaveURL(/\/masuk/);
    });

    test('warga melihat hanya tiketnya sendiri', async ({ page }) => {
        const creds = credentials();

        await page.goto('/masuk');
        await page.getByLabel('NIK / Username').fill(creds.warga_nik);
        await page.getByLabel('Kata Sandi').fill(creds.password);
        await page.getByRole('button', { name: 'Masuk' }).click();
        await page.waitForURL(/\/portal-warga/);

        await page.goto('/admin');
        await expect(page).toHaveURL(/\/portal-warga/);
    });
});
