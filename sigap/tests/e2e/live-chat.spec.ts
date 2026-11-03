import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function credentials() {
    const file = path.resolve(__dirname, '../../storage/app/e2e/credentials.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as { username: string; password: string };
}

test.describe('Live chat: identitas tamu & badge belum dibaca', () => {
    test('tamu isi nama → kirim pesan → admin lihat badge merah → buka → badge hilang → balas', async ({ browser }) => {
        // --- Tamu (konteks browser sendiri) ---
        const guestCtx = await browser.newContext();
        const guest = await guestCtx.newPage();
        // Beranda & formulir pengaduan kini bertema TARA; widget live chat lama ada di halaman ber-tata letak publik (mis. Daftar).
        await guest.goto('/daftar');
        await guest.getByRole('button', { name: /buka live chat/i }).click();

        const dialog = guest.getByRole('dialog', { name: 'Live chat Contact Center' });
        await expect(dialog.getByLabel(/^Nama/)).toBeVisible();
        await expect(dialog.getByLabel('Ketik pesan')).toHaveCount(0);

        await dialog.getByLabel(/^Nama/).fill('Budi Tamu Ujicoba');
        await dialog.getByRole('button', { name: 'Mulai chat' }).click();
        // Widget kini dibuka TARA; nama tamu dipakai di sapaan.
        await expect(dialog.getByText(/Halo, Budi Tamu Ujicoba!/)).toBeVisible();

        await dialog.getByLabel('Ketik pesan').fill('Kapan sertifikat lahan saya terbit?');
        await dialog.getByRole('button', { name: 'Kirim pesan' }).click();
        const bubble = dialog.getByText('Kapan sertifikat lahan saya terbit?');
        await expect(bubble).toBeVisible();
        // Pesan sendiri tampil di sisi kanan (baris justify-end).
        await expect(bubble.locator('xpath=ancestor::div[contains(@class,"justify-end")][1]')).toHaveCount(1);
        // Pesan sampai ke petugas setelah tamu meminta dialihkan.
        await dialog.getByRole('button', { name: 'Bicara dengan petugas' }).click();
        await guest.screenshot({ path: 'test-results/chat-tamu.png' });

        // --- Admin ---
        const adminCtx = await browser.newContext();
        const admin = await adminCtx.newPage();
        const creds = credentials();
        await admin.goto('/masuk');
        await admin.getByLabel('NIK / Username').fill(creds.username);
        await admin.getByLabel('Kata Sandi').fill(creds.password);
        await admin.getByRole('button', { name: 'Masuk' }).click();
        await admin.waitForURL(/\/admin/);

        // Badge di menu Pesan Masuk (label bersama "N perlu ditindaklanjuti" juga dipakai Rujukan).
        const chatMenu = admin.getByRole('navigation', { name: 'Menu admin' }).getByRole('link', { name: /Pesan Masuk/ });
        const badge = chatMenu.getByLabel(/perlu ditindaklanjuti/);
        await expect(badge).toBeVisible();
        await admin.screenshot({ path: 'test-results/chat-admin-badge.png' });

        await chatMenu.click();
        await admin.waitForURL(/\/admin\/chat/);
        await expect(admin.getByRole('heading', { name: /Budi Tamu Ujicoba/ }).first()).toBeVisible();
        await expect(admin.getByText(/Tamu · nama diisi sendiri/)).toBeVisible();
        await expect(badge).toHaveCount(0);
        await admin.screenshot({ path: 'test-results/chat-admin-dibaca.png' });

        await admin.getByLabel('Balasan untuk warga').fill('Halo Budi, sedang kami cek.');
        await admin.getByLabel('Balasan untuk warga').press('Enter');
        await expect(admin.getByText('Halo Budi, sedang kami cek.')).toBeVisible();

        // Tamu menerima balasan lewat polling (tanpa WebSocket), di sisi kiri.
        const reply = dialog.getByText('Halo Budi, sedang kami cek.');
        await expect(reply).toBeVisible({ timeout: 15_000 });
        await expect(reply.locator('xpath=ancestor::div[contains(@class,"justify-end")][1]')).toHaveCount(0);
        await guest.screenshot({ path: 'test-results/chat-tamu-balasan.png' });

        await guestCtx.close();
        await adminCtx.close();
    });
});
