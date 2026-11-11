import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tangkapan layar untuk halaman Panduan (resources/js/pages/public/panduan.tsx).
 * Jalankan: npx playwright test -c playwright.panduan.config.ts
 * Nama berkas di sini harus sama dengan yang dirujuk panduan.tsx.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../public/images/panduan');

function credentials() {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../storage/app/e2e/credentials.json'), 'utf-8')) as {
        username: string;
        password: string;
        warga_nik: string;
        warga_password: string;
        survei_tiket: string;
    };
}

async function settle(page: Page) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
}

/** Tangkapan selebar viewport (1440×900). */
async function shot(page: Page, name: string) {
    await settle(page);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
}

/**
 * Tangkapan satu elemen (kartu/panel): elemen digulir tepat di bawah header
 * yang lengket, lalu dipotong dari viewport dengan sedikit ruang di sekelilingnya.
 */
async function shotOf(page: Page, target: Locator, name: string, top = 96) {
    await target.scrollIntoViewIfNeeded();
    await target.evaluate((node, off) => window.scrollBy(0, node.getBoundingClientRect().top - off), top);
    await settle(page);
    const box = await target.boundingBox();
    const view = page.viewportSize();
    if (!box || !view) throw new Error(`Elemen untuk ${name} tidak terlihat`);
    if (box.height + 32 > view.height - top) {
        // Elemen lebih tinggi dari layar: header lengket dilepas sementara agar tidak menutupi bagian atasnya.
        const unstick = (on: boolean) =>
            page.evaluate((off) => {
                document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
                    const pos = getComputedStyle(el).position;
                    if (off && (pos === 'sticky' || pos === 'fixed')) el.dataset.panduanPos = pos;
                    if (el.dataset.panduanPos) el.style.position = off ? 'static' : '';
                    if (!off) delete el.dataset.panduanPos;
                });
            }, on);
        await unstick(true);
        await target.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
        await unstick(false);
        return;
    }
    const pad = 16;
    const x = Math.max(box.x - pad, 0);
    const y = Math.max(box.y - pad, 0);
    await page.screenshot({
        path: `${OUT}/${name}.jpg`,
        type: 'jpeg',
        quality: 82,
        clip: { x, y, width: Math.min(box.width + pad * 2, view.width - x), height: Math.min(box.height + pad * 2, view.height - y) },
    });
}

/** Gulir sampai teks judul berada dekat atas layar, lalu tangkap viewport. */
async function shotAt(page: Page, heading: string | RegExp, name: string, offset = 88) {
    const el = page.getByText(heading).first();
    await el.scrollIntoViewIfNeeded();
    await el.evaluate((node, off) => window.scrollBy(0, node.getBoundingClientRect().top - off), offset);
    await shot(page, name);
}

/** Kartu terdalam yang memuat judul tersebut. */
const card = (page: Page, title: string) =>
    page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: title, exact: true }), visible: true })
        .last();

async function login(page: Page, id: string, password: string, url: RegExp) {
    await page.goto('/masuk');
    await page.getByLabel('NIK / Username').fill(id);
    await page.getByLabel('Kata Sandi').fill(password);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await page.waitForURL(url);
}

async function choose(page: Page, combobox: string, option: string) {
    await page.getByRole('combobox', { name: combobox }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
}

test.describe.configure({ mode: 'serial' });

test('masyarakat', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });

    await page.goto('/');
    await shot(page, 'w01-beranda');
    await page.goto('/chat');
    await shot(page, 'w02-chat-tara');

    // Formulir pengaduan, per kartu.
    await page.goto('/pengaduan/baru');
    await shot(page, 'w03-form');
    await page.getByLabel('NIK (KTP)').fill('3273010101900002');
    await page.getByLabel('Nama Lengkap').fill('Yohanes Kambu');
    await page.getByLabel('Email').fill('yohanes.kambu@contoh.test');
    await page.getByLabel('No. Telepon / WA').fill('081398765432');
    await shotOf(page, card(page, 'Data pelapor'), 'w04-form-pelapor');

    await page.getByLabel('Judul Laporan').fill('Jalan lingkungan SP 9 ambles');
    await page
        .getByLabel('Uraian Laporan')
        .fill(
            'Badan jalan lingkungan di jalur 3 SP 9 ambles sepanjang 15 meter setelah hujan deras dua hari lalu. Motor dan gerobak hasil panen tidak bisa lewat.',
        );
    await choose(page, 'Kategori', 'Infrastruktur Dasar');
    await choose(page, 'Tingkat Dampak', 'Tinggi');
    await shotOf(page, card(page, 'Isi laporan'), 'w05-form-laporan');

    await choose(page, 'Provinsi', 'Papua Selatan');
    await page.getByLabel('Kabupaten / Kawasan / Desa').fill('Kab. Merauke, SP 9 Kurik');
    await shotOf(page, card(page, 'Lokasi kejadian'), 'w06-form-lokasi');

    const foto = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 640, height: 400 } });
    await page.locator('input[type="file"]').setInputFiles({ name: 'foto-jalan-ambles.png', mimeType: 'image/png', buffer: foto });
    await page.getByRole('checkbox', { name: 'Pernyataan benar' }).click();
    const kirim = page.getByRole('button', { name: /Kirim Pengaduan/i });
    await shotOf(page, card(page, 'Privasi & bukti'), 'w07-form-privasi');
    await shotOf(page, page.locator('section').filter({ has: kirim }).first(), 'w08-form-kirim');

    await kirim.click();
    await page.waitForURL(/\/lacak\/TKT-/);
    await shot(page, 'w09-tiket-terbit');

    await page.goto('/lacak');
    await shot(page, 'w10-lacak');

    const c = credentials();
    await login(page, c.warga_nik, c.warga_password, /portal-warga/);
    await shot(page, 'w15-portal-warga');
    await page.context().clearCookies();

    // Tiket selesai tanpa akun yang belum disurvei (tests/panduan/siapkan-data.php).
    await page.goto('/lacak');
    await page.getByPlaceholder('TKT-YYMMDD-XXXXXX').fill(credentials().survei_tiket);
    await page.getByRole('button', { name: 'Cari' }).click();
    await page.waitForURL(/\/lacak\/TKT-/);
    await shot(page, 'w11-lacak-detail');
    await shotAt(page, /Riwayat Penanganan/, 'w12-lacak-riwayat');

    await page.getByRole('link', { name: 'Isi Survei Kepuasan' }).click();
    await page.waitForURL(/\/survei$/);
    await shot(page, 'w13-survei');
    const aspek = page.locator('fieldset');
    const n = await aspek.count();
    for (let i = 0; i < n; i++) {
        const opsi = aspek.nth(i).locator('label');
        if ((await opsi.count()) === 4) await opsi.nth(i % 3 === 0 ? 3 : 2).click();
    }
    await shotOf(page, card(page, 'Penilaian penanganan pengaduan'), 'w13b-survei-aspek');
    await page.locator('fieldset#teratasi label').filter({ hasText: 'Sebagian teratasi' }).click();
    await page.getByText('Ajukan tinjau ulang pengaduan').click();
    await shotOf(page, card(page, 'Penilaian keseluruhan'), 'w13c-survei-keseluruhan');

    await page.goto('/katalog');
    await shot(page, 'w16-katalog');
    await page.goto('/peta');
    await shot(page, 'w17-peta');
    await page.goto('/tentang');
    await shot(page, 'w18-data');
    await page.goto('/masuk');
    await shot(page, 'w14-masuk');
    await page.goto('/daftar');
    await shot(page, 'w19-daftar');
});

test('admin', async ({ page }) => {
    const c = credentials();
    await login(page, c.username, c.password, /\/admin/);

    await page.goto('/admin/matriks');
    await shot(page, 'a01-matriks');
    await shotAt(page, 'Sebaran Pengaduan per Wilayah', 'a02-matriks-peta');
    await shotAt(page, 'Corong layanan TARA', 'a03-matriks-layanan');
    await shotAt(page, /Kategori aduan/, 'a04-matriks-grafik');

    await page.goto('/admin/tiket');
    await shot(page, 'a05-tiket');
    await page.goto('/admin/tiket?status=aktif&unit=none');
    await shot(page, 'a06-tiket-belum-disposisi');

    // Tiket yang sudah didisposisi dan punya tanggapan.
    await page.goto('/admin/tiket');
    await page.getByPlaceholder(/Cari nomor/).fill('Jembatan kayu');
    await settle(page);
    await page.locator('table').getByText('Jembatan kayu penghubung').first().click();
    await page.waitForURL(/\/admin\/tiket\/TKT-/);
    await expect(page.getByRole('button', { name: 'Alihkan' }), 'tiket contoh harus sudah didisposisi').toBeVisible();
    await shot(page, 'a07-tiket-detail');
    const panel = (title: string) =>
        page
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: new RegExp(`^${title}`) }), visible: true })
            .last();
    await shotOf(page, panel('Disposisi unit'), 'a08-disposisi');
    await shotOf(page, panel('Tanggapan'), 'a09-tanggapan');
    await shotOf(page, panel('Tindak lanjut'), 'a10-tindak-lanjut');

    // Aksi nyata agar Log Aktivitas di akhir tidak hanya berisi login.
    await page.getByRole('button', { name: 'Catatan internal' }).click();
    await page.getByPlaceholder('Catatan untuk sesama petugas…').fill('Unit sudah dihubungi; menunggu jadwal perbaikan dari kontraktor.');
    await page.getByRole('button', { name: 'Simpan catatan' }).click();
    await settle(page);

    // Tiket contoh dengan skor survei rendah (sigap:data-contoh) di tab Perlu tinjau ulang.
    await page.goto('/admin/tiket?tinjau=1');
    await settle(page);
    await page.locator('table').getByText('Jaminan hidup').first().click();
    await page.waitForURL(/\/admin\/tiket\/TKT-/);
    await shot(page, 'a27-tinjau-ulang');
    await shotOf(page, panel('Survei kepuasan'), 'a28-hasil-survei');

    await page.goto('/admin/chat');
    await shot(page, 'a11-pesan-masuk');
    await page.goto('/admin/rujukan');
    await shot(page, 'a12-rujukan');
    await page.goto('/admin/input-manual');
    await shot(page, 'a13-input-manual');
    await page.goto('/admin/tiket-internal');
    await shot(page, 'a14-tiket-internal');

    await page.goto('/admin/pengetahuan');
    await shot(page, 'a15-pengetahuan');
    await page.goto('/admin/pengetahuan/dokumen');
    await shot(page, 'a16-pengetahuan-dokumen');
    await page.goto('/admin/pengetahuan/sumber');
    await shot(page, 'a17-pengetahuan-sumber');
    await page.goto('/admin/kawasan');
    await shot(page, 'a18-sebaran-wilayah');

    await page.goto('/admin/kanal');
    await shot(page, 'a19-kanal');
    await page.goto('/admin/portal');
    await shot(page, 'a20-katalog-portal');
    await page.goto('/admin/pengaturan');
    await shot(page, 'a21-pengaturan');

    await page.goto('/admin/petugas');
    await shot(page, 'a22-petugas');
    await page.goto('/admin/unit-kerja');
    await shot(page, 'a23-unit-kerja');
    await page.getByRole('button', { name: 'Unit baru' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, 'a24-unit-baru');
    await page.keyboard.press('Escape');
    await page.goto('/admin/kesehatan-ai');
    await shot(page, 'a25-kesehatan-ai');
    await page.goto('/admin/log-aktivitas');
    await shot(page, 'a26-log-aktivitas');
});
