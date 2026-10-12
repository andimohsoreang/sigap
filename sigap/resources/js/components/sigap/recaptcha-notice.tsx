import { ShieldCheck } from 'lucide-react';

/**
 * Pemberitahuan standar reCAPTCHA v3. Badge Google disembunyikan lewat CSS
 * (.grecaptcha-badge) sehingga teks atribusi ini WAJIB tampil sesuai
 * ketentuan Google. Saat reCAPTCHA nonaktif (lokal) hanya pesan galat yang tampil.
 */
export function RecaptchaNotice({ enabled, error }: { enabled: boolean; error?: string | null }) {
    return (
        <div className="space-y-1">
            {enabled && (
                <p className="flex items-start gap-2 text-xs text-gray-500">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                        Situs ini dilindungi oleh reCAPTCHA dan berlaku{' '}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                            Kebijakan Privasi
                        </a>{' '}
                        serta{' '}
                        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">
                            Persyaratan Layanan
                        </a>{' '}
                        Google.
                    </span>
                </p>
            )}
            {error && (
                <p role="alert" className="text-xs font-semibold text-rose-500">
                    {error}
                </p>
            )}
        </div>
    );
}
