import { readFileSync } from 'node:fs';

import { AUTH, CREDENTIALS } from './s1';
import { test as setup } from './test';

/**
 * Masuk sebagai akun uji dari `sigap:e2e-setup` (kata sandi acak per run, dibaca dari berkas kredensial
 * target Laravel) lalu simpan storageState untuk varian visual login.
 */
const creds = JSON.parse(readFileSync(CREDENTIALS, 'utf8')) as { username: string; password: string; warga_nik: string; warga_password: string };

const ACCOUNTS = [
    { name: 'warga', id: creds.warga_nik, password: creds.warga_password },
    { name: 'admin', id: creds.username, password: creds.password },
] as const;

for (const a of ACCOUNTS) {
    setup(`masuk ${a.name}`, async ({ page }) => {
        await page.goto('/masuk');
        await page.locator('#identifier').fill(a.id);
        await page.locator('#password').fill(a.password);
        await page.locator('button[type="submit"]').click();
        await page.waitForURL((url) => url.pathname !== '/masuk');
        await page.context().storageState({ path: AUTH[a.name] });
    });
}
