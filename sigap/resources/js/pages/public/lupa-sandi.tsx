import { Link, useForm } from '@inertiajs/react';
import { KeyRound, LoaderCircle, MessagesSquare } from 'lucide-react';
import { type FormEvent } from 'react';

import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import TaraAuthShell, {
    AuthField,
    AuthFooter,
    AuthHeading,
    AuthStatus,
    authA11y,
    authInputClass,
    authLinkClass,
    authPrimaryButtonClass,
} from '@/components/sigap/tara-auth-shell';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { goToChat } from '@/lib/chat-transition';

export default function LupaSandi({ status }: { status?: string | null }) {
    const { data, setData, post, transform, processing, errors } = useForm({ identifier: '', recaptcha_token: '' });
    const recaptcha = useRecaptcha('lupa_sandi');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void recaptcha.withToken((token) => {
            transform((form) => ({ ...form, recaptcha_token: token }));
            post('/lupa-sandi');
        });
    };
    const busy = processing || recaptcha.verifying;

    return (
        <TaraAuthShell title="Lupa Kata Sandi">
            <AuthHeading icon={KeyRound} title="Lupa Kata Sandi">
                Isi NIK atau email akun warga Anda. Kami kirim tautan untuk membuat kata sandi baru ke email akun.
            </AuthHeading>

            {status && (
                <div className="mt-6">
                    <AuthStatus>{status}</AuthStatus>
                </div>
            )}

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                <AuthField id="identifier" label="NIK atau Email" error={errors.identifier}>
                    <input
                        id="identifier"
                        value={data.identifier}
                        onChange={(e) => setData('identifier', e.target.value)}
                        autoComplete="username"
                        className={authInputClass}
                        required
                        {...authA11y('identifier', errors.identifier)}
                    />
                </AuthField>

                <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? errors.recaptcha_token} />

                <button type="submit" disabled={busy} className={authPrimaryButtonClass}>
                    {busy ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                        <KeyRound className="h-5 w-5" aria-hidden="true" />
                    )}
                    Kirim tautan
                </button>
            </form>

            <AuthFooter>
                <p>
                    Ingat kata sandi?{' '}
                    <Link href="/masuk" className={authLinkClass}>
                        Masuk
                    </Link>
                </p>
                <div className="rounded-xl bg-[var(--tcd-muted,#f6f8fa)] px-4 py-3">
                    <p>Tidak punya email, atau emailnya sudah tidak aktif?</p>
                    <button
                        type="button"
                        onClick={(e) => goToChat({ question: 'Saya lupa kata sandi dan tidak punya email', source: e.currentTarget })}
                        className={`${authLinkClass} mt-1 flex items-center gap-1.5`}
                    >
                        <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Minta bantuan petugas lewat chat
                    </button>
                </div>
                <p className="text-xs">Petugas yang lupa kata sandi: hubungi Super Admin.</p>
            </AuthFooter>
        </TaraAuthShell>
    );
}
