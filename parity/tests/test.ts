import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/** Tanpa jaringan luar: semua request ke origin selain BASE_URL (mis. Google reCAPTCHA) digagalkan. */
export const test = base.extend<{ tanpaJaringanLuar: void }>({
    tanpaJaringanLuar: [
        async ({ context, baseURL }, use) => {
            const origin = new URL(baseURL!).origin;
            await context.route(
                (url) => url.origin !== origin,
                (route) => route.abort('blockedbyclient'),
            );
            await use();
        },
        { auto: true },
    ],
});
