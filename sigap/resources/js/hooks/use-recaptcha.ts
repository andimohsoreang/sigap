import { getRecaptchaToken, loadRecaptcha, type RecaptchaAction } from '@/lib/recaptcha';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

export const RECAPTCHA_LOAD_ERROR = 'Verifikasi reCAPTCHA gagal dimuat. Periksa koneksi lalu coba lagi.';

/**
 * Hook reCAPTCHA v3: memuat skrip Google saat komponen tampil (hanya bila
 * site key diisi) dan menyediakan `withToken(kirim)` yang mengambil token
 * tepat sebelum submit (token v3 hanya berlaku 2 menit). Bila reCAPTCHA
 * nonaktif (lokal), `kirim('')` langsung dipanggil tanpa token.
 */
export function useRecaptcha(action: RecaptchaAction) {
    const { recaptcha } = usePage<SharedData>().props;
    const siteKey = recaptcha?.site_key ?? null;
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (siteKey) {
            // Dimuat lebih awal agar submit tidak menunggu unduhan skrip.
            loadRecaptcha(siteKey).catch(() => undefined);
        }
    }, [siteKey]);

    const withToken = useCallback(
        async (send: (token: string) => void) => {
            setError(null);
            setVerifying(true);

            let token: string | null;
            try {
                token = await getRecaptchaToken(siteKey, action);
            } catch {
                setError(RECAPTCHA_LOAD_ERROR);
                return;
            } finally {
                setVerifying(false);
            }

            send(token ?? '');
        },
        [siteKey, action],
    );

    return { enabled: Boolean(siteKey), verifying, error, withToken };
}
