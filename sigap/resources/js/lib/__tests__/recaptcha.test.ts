import { getRecaptchaToken, loadRecaptcha, recaptchaScriptUrl, resetRecaptchaForTests } from '@/lib/recaptcha';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('reCAPTCHA v3', () => {
    afterEach(() => resetRecaptchaForTests());

    it('tanpa site key: tidak memuat skrip & token null', async () => {
        await expect(getRecaptchaToken(null, 'pengaduan')).resolves.toBeNull();
        await expect(getRecaptchaToken('', 'survei')).resolves.toBeNull();
        expect(document.querySelector('script[src*="recaptcha"]')).toBeNull();
    });

    it('memuat api.js?render=<key> sekali lalu memanggil execute dengan aksi', async () => {
        const execute = vi.fn().mockResolvedValue('token-123');
        const pending = getRecaptchaToken('site-key', 'pengaduan');
        const second = loadRecaptcha('site-key');

        const scripts = document.querySelectorAll('script[src*="recaptcha"]');
        expect(scripts).toHaveLength(1);
        expect((scripts[0] as HTMLScriptElement).src).toBe(recaptchaScriptUrl('site-key'));

        window.grecaptcha = { ready: (cb) => cb(), execute };
        scripts[0].dispatchEvent(new Event('load'));

        await expect(pending).resolves.toBe('token-123');
        await second;
        expect(execute).toHaveBeenCalledWith('site-key', { action: 'pengaduan' });
    });

    it('gagal memuat skrip → promise ditolak (formulir menampilkan galat)', async () => {
        const pending = getRecaptchaToken('site-key', 'survei');
        document.querySelector('script[src*="recaptcha"]')?.dispatchEvent(new Event('error'));

        await expect(pending).rejects.toThrow('reCAPTCHA gagal dimuat.');
    });
});
