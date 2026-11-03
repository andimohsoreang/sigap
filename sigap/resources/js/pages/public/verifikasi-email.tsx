import { router, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle, MailCheck, RefreshCw } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import TaraAuthShell, {
    AuthField,
    AuthFooter,
    AuthHeading,
    AuthStatus,
    authA11y,
    authInputClass,
    authLinkClass,
    authPrimaryButtonClass,
    authSecondaryButtonClass,
} from '@/components/sigap/tara-auth-shell';
import type { SharedData } from '@/types';

interface Props {
    email: string | null;
    hasEmail: boolean;
}

export default function VerifikasiEmail({ email, hasEmail }: Props) {
    const { flash } = usePage<SharedData>().props;
    const [changing, setChanging] = useState(!hasEmail);
    const resend = useForm({});
    const change = useForm({ email: '' });

    const submitResend = (e: FormEvent) => {
        e.preventDefault();
        resend.post('/verifikasi-email/kirim-ulang', { preserveScroll: true });
    };

    const submitChange = (e: FormEvent) => {
        e.preventDefault();
        change.post('/verifikasi-email/ganti', {
            preserveScroll: true,
            onSuccess: () => {
                change.reset();
                setChanging(false);
            },
        });
    };

    return (
        <TaraAuthShell title="Verifikasi Email">
            <AuthHeading icon={MailCheck} title="Periksa email Anda">
                {hasEmail ? (
                    <>
                        Kami sudah mengirim tautan verifikasi ke <strong className="text-[var(--tcd-heading,var(--t-deep))]">{email}</strong>. Klik
                        tautan itu untuk membuka Portal Warga. Tautan berlaku 60 menit.
                    </>
                ) : (
                    'Akun Anda belum memiliki email. Isi email di bawah untuk menerima tautan verifikasi.'
                )}
            </AuthHeading>

            {flash?.status && (
                <div className="mt-6">
                    <AuthStatus>{flash.status}</AuthStatus>
                </div>
            )}

            {hasEmail && (
                <form onSubmit={submitResend} className="mt-8">
                    <button type="submit" disabled={resend.processing} className={authSecondaryButtonClass}>
                        {resend.processing ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        )}
                        Kirim ulang tautan
                    </button>
                </form>
            )}

            {changing ? (
                <form onSubmit={submitChange} className="mt-6 flex flex-col gap-4 border-t border-[var(--tcd-border,#eceff3)] pt-6">
                    <AuthField id="email" label={hasEmail ? 'Email yang benar' : 'Email'} error={change.errors.email}>
                        <input
                            id="email"
                            type="email"
                            value={change.data.email}
                            onChange={(e) => change.setData('email', e.target.value)}
                            autoComplete="email"
                            placeholder="nama@contoh.com"
                            className={authInputClass}
                            required
                            {...authA11y('email', change.errors.email)}
                        />
                    </AuthField>
                    <button type="submit" disabled={change.processing} className={authPrimaryButtonClass}>
                        {change.processing && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />}
                        Simpan &amp; kirim tautan
                    </button>
                </form>
            ) : (
                <p className="mt-6 text-center text-sm text-[var(--tcd-text-2,#5b6875)]">
                    Salah menulis email?{' '}
                    <button type="button" onClick={() => setChanging(true)} className={authLinkClass}>
                        Ganti email
                    </button>
                </p>
            )}

            <AuthFooter>
                <p className="text-center text-[13px]">
                    Tidak menerima email? Periksa folder Spam atau Promosi.{' '}
                    <button type="button" onClick={() => router.post('/keluar')} className={authLinkClass}>
                        Keluar
                    </button>
                </p>
            </AuthFooter>
        </TaraAuthShell>
    );
}
