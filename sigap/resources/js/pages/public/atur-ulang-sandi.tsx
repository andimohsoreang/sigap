import { Link, useForm } from '@inertiajs/react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { type FormEvent } from 'react';

import TaraAuthShell, {
    AuthField,
    AuthFooter,
    AuthHeading,
    authA11y,
    authInputClass,
    authLinkClass,
    authPrimaryButtonClass,
} from '@/components/sigap/tara-auth-shell';

export default function AturUlangSandi({ token, email }: { token: string; email: string }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/atur-ulang-sandi', { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <TaraAuthShell title="Atur Ulang Kata Sandi">
            <AuthHeading icon={LockKeyhole} title="Buat Kata Sandi Baru">
                Setelah disimpan, semua perangkat lain yang masuk dengan akun ini akan dikeluarkan.
            </AuthHeading>

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                <AuthField id="email" label="Email akun" error={errors.email}>
                    <input id="email" type="email" value={data.email} readOnly className={authInputClass} {...authA11y('email', errors.email)} />
                </AuthField>

                <AuthField id="password" label="Kata Sandi Baru" error={errors.password} hint="Minimal 8 karakter, berisi huruf dan angka.">
                    <input
                        id="password"
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        autoComplete="new-password"
                        className={authInputClass}
                        required
                        {...authA11y('password', errors.password, true)}
                    />
                </AuthField>

                <AuthField id="password_confirmation" label="Ulangi Kata Sandi Baru" error={errors.password_confirmation}>
                    <input
                        id="password_confirmation"
                        type="password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        autoComplete="new-password"
                        className={authInputClass}
                        required
                        {...authA11y('password_confirmation', errors.password_confirmation)}
                    />
                </AuthField>

                <button type="submit" disabled={processing} className={`${authPrimaryButtonClass} mt-1`}>
                    {processing ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                        <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                    )}
                    Simpan kata sandi
                </button>
            </form>

            <AuthFooter>
                <p>
                    Tautan kedaluwarsa?{' '}
                    <Link href="/lupa-sandi" className={authLinkClass}>
                        Minta tautan baru
                    </Link>
                </p>
            </AuthFooter>
        </TaraAuthShell>
    );
}
