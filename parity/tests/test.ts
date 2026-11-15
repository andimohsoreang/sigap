import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * Tanpa jaringan luar: request ke origin selain BASE_URL dan semua WebSocket digagalkan. Fixture `diblokir`
 * berisi origin + path tiap yang diblokir (unik, urutan kejadian) untuk dibandingkan per halaman.
 */
export const test = base.extend<{ diblokir: string[] }>({
    diblokir: [
        async ({ context, baseURL }, use) => {
            const origin = new URL(baseURL!).origin;
            const blocked: string[] = [];
            await context.route(
                (url) => url.origin !== origin,
                (route) => {
                    const url = new URL(route.request().url());
                    const key = url.origin + url.pathname;
                    if (!blocked.includes(key)) blocked.push(key);
                    return route.abort('blockedbyclient');
                },
            );
            // WebSocket (mis. Reverb) tidak lewat context.route: catat juga lalu tutup.
            await context.routeWebSocket(
                () => true,
                (ws) => {
                    const url = new URL(ws.url());
                    const key = url.origin + url.pathname;
                    if (!blocked.includes(key)) blocked.push(key);
                    ws.close();
                },
            );
            await use(blocked);
        },
        { auto: true },
    ],
});
