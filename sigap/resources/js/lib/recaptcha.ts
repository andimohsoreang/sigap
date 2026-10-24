/**
 * reCAPTCHA v3 (SEC-10).
 *
 * Skrip Google hanya dimuat bila site key diisi (prop bersama
 * `recaptcha.site_key`). Tanpa key (lingkungan lokal) formulir tetap terkirim
 * tanpa token dan backend melewati verifikasi.
 */

interface Grecaptcha {
    ready(cb: () => void): void;
    execute(siteKey: string, options: { action: string }): Promise<string>;
}

declare global {
    interface Window {
        grecaptcha?: Grecaptcha;
    }
}

const SCRIPT_ID = 'sigap-recaptcha-v3';
let loading: Promise<Grecaptcha> | null = null;

/** Aksi yang diharapkan backend (App\Services\RecaptchaService::ACTION_*). */
export type RecaptchaAction = 'pengaduan' | 'pengaduan_internal' | 'survei' | 'chat' | 'daftar' | 'lupa_sandi';

export function recaptchaScriptUrl(siteKey: string): string {
    return `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
}

/** Muat api.js sekali saja; promise dibagi oleh semua pemanggil. */
export function loadRecaptcha(siteKey: string): Promise<Grecaptcha> {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('reCAPTCHA hanya tersedia di browser.'));
    }

    if (window.grecaptcha?.execute) {
        return Promise.resolve(window.grecaptcha);
    }

    if (loading) return loading;

    loading = new Promise<Grecaptcha>((resolve, reject) => {
        const done = () => {
            const g = window.grecaptcha;
            if (g) g.ready(() => resolve(g));
            else reject(new Error('reCAPTCHA gagal dimuat.'));
        };

        const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
        const script = existing ?? document.createElement('script');

        script.addEventListener('load', done, { once: true });
        script.addEventListener(
            'error',
            () => {
                loading = null;
                reject(new Error('reCAPTCHA gagal dimuat.'));
            },
            { once: true },
        );

        if (!existing) {
            script.id = SCRIPT_ID;
            script.src = recaptchaScriptUrl(siteKey);
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
    });

    return loading;
}

/**
 * Ambil token untuk satu aksi. Mengembalikan `null` bila key kosong
 * (lokal) sehingga pemanggil cukup mengirim formulir tanpa token.
 */
export async function getRecaptchaToken(siteKey: string | null | undefined, action: RecaptchaAction): Promise<string | null> {
    if (!siteKey) return null;

    const grecaptcha = await loadRecaptcha(siteKey);

    return grecaptcha.execute(siteKey, { action });
}

/** Hanya untuk pengujian unit. */
export function resetRecaptchaForTests(): void {
    loading = null;
    document.getElementById(SCRIPT_ID)?.remove();
    delete window.grecaptcha;
}
