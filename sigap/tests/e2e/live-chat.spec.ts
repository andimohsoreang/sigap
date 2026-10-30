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
        await guest.goto('/');
        await guest.getByRole('button', { name: /buka live chat/i }).click();

        const dialog = guest.getByRole('dialog', { name: 'Live chat Contact Center' });
        await expect(dialog.getByLabel(/^Nama/)).toBeVisible();
        await expect(dialog.getByLabel('Ketik pesan')).toHaveCount(0);

        await dialog.getByLabel(/^Nama/).fill('Budi Tamu Ujicoba');
        await dialog.getByRole('button', { name: 'Mulai chat' }).click();
        await expect(dialog.getByText('Anda: Budi Tamu Ujicoba · Tamu')).toBeVisible();

        await dialog.getByLabel('Ketik pesan').fill('Kapan sertifikat lahan saya terbit?');
        await dialog.getByRole('button', { name: 'Kirim pesan' }).click();
        const bubble = dialog.getByText('Kapan sertifikat lahan saya terbit?');
        await expect(bubble).toBeVisible();
        // Pesan sendiri tampil di sisi kanan (baris justify-end).
        await expect(bubble.locator('xpath=ancestor::div[contains(@class,"justify-end")][1]')).toHaveCount(1);
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

        const badge = admin.getByLabel(/pesan belum dibaca/);
        await expect(badge.first()).toBeVisible();
        await admin.screenshot({ path: 'test-results/chat-admin-badge.png' });

        await admin.getByRole('link', { name: /Kotak Masuk/ }).first().click();
        await admin.waitForURL(/\/admin\/chat/);
        await expect(admin.getByRole('heading', { name: /Budi Tamu Ujicoba/ }).first()).toBeVisible();
        await expect(admin.getByText(/Tamu · nama diisi sendiri/)).toBeVisible();
        await expect(admin.getByLabel(/pesan belum dibaca/)).toHaveCount(0);
        await admin.screenshot({ path: 'test-results/chat-admin-dibaca.png' });

        await admin.getByPlaceholder('Ketik balasan Anda...').fill('Halo Budi, sedang kami cek.');
        await admin.getByPlaceholder('Ketik balasan Anda...').press('Enter');
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
