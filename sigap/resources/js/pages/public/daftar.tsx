import { Link, useForm } from '@inertiajs/react';
import { FolderOpen, LoaderCircle, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { type FormEvent } from 'react';

import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import TaraAuthShell, {
    AuthField,
    AuthFooter,
    AuthHeading,
    AuthPanel,
    authA11y,
    authInputClass,
    authLinkClass,
    authPrimaryButtonClass,
} from '@/components/sigap/tara-auth-shell';
import { useRecaptcha } from '@/hooks/use-recaptcha';

const BENEFITS = [
    { icon: FolderOpen, text: 'Semua pengaduan Anda tersimpan di Portal Warga' },
    { icon: Mail, text: 'Kabar perkembangan pengaduan dikirim lewat email' },
    { icon: ShieldCheck, text: 'NIK dipakai untuk masuk dan disimpan terenkripsi' },
];

export default function Daftar() {
    const { data, setData, post, transform, processing, errors, reset } = useForm({
        nik: '',
        nama: '',
        email: '',
        telepon: '',
        password: '',
        password_confirmation: '',
        setuju: false as boolean,
        recaptcha_token: '',
    });
    const recaptcha = useRecaptcha('daftar');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void recaptcha.withToken((token) => {
            transform((form) => ({ ...form, recaptcha_token: token }));
            post('/daftar', { onFinish: () => reset('password', 'password_confirmation') });
        });
    };
    const busy = processing || recaptcha.verifying;

    return (
        <TaraAuthShell
            title="Daftar Akun Warga"
            panel={
                <AuthPanel
                    eyebrow="Akun Warga"
                    heading="Satu akun untuk semua pengaduan Anda."
                    text="Dengan akun, semua pengaduan Anda tersimpan di Portal Warga dan Anda menerima kabar perkembangannya lewat email."
                    items={BENEFITS}
                    note={
                        <>
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            Data pribadi Anda dilindungi sesuai UU Pelindungan Data Pribadi.
                        </>
                    }
                    pose="menyambut"
                />
            }
        >
            <AuthHeading title="Daftar Akun Warga">Isi data di bawah. Kolom bertanda * wajib diisi.</AuthHeading>

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                <AuthField
                    id="nik"
                    label="NIK (KTP)"
                    required
                    error={errors.nik}
                    hint="16 digit angka. NIK dipakai untuk masuk dan disimpan terenkripsi."
                >
                    <input
                        id="nik"
                        inputMode="numeric"
                        maxLength={16}
                        value={data.nik}
                        onChange={(e) => setData('nik', e.target.value.replace(/\D/g, ''))}
                        autoComplete="username"
                        className={`${authInputClass} font-mono tracking-wider`}
                        required
                        {...authA11y('nik', errors.nik, true)}
                    />
                </AuthField>

                <AuthField id="nama" label="Nama Lengkap" required error={errors.nama}>
                    <input
                        id="nama"
                        value={data.nama}
                        onChange={(e) => setData('nama', e.target.value)}
                        autoComplete="name"
                        className={authInputClass}
                        required
                        {...authA11y('nama', errors.nama)}
                    />
                </AuthField>

                <div className="grid gap-5 sm:grid-cols-2">
                    <AuthField id="email" label="Email" required error={errors.email} hint="Kami kirim tautan verifikasi ke email ini.">
                        <input
                            id="email"
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            autoComplete="email"
                            placeholder="nama@contoh.com"
                            className={authInputClass}
                            required
                            {...authA11y('email', errors.email, true)}
                        />
                    </AuthField>

                    <AuthField id="telepon" label="No. Telepon / WA" error={errors.telepon}>
                        <input
                            id="telepon"
                            type="tel"
                            placeholder="08xx-xxxx-xxxx"
                            value={data.telepon}
                            onChange={(e) => setData('telepon', e.target.value)}
                            autoComplete="tel"
                            className={authInputClass}
                            {...authA11y('telepon', errors.telepon)}
                        />
                    </AuthField>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <AuthField id="password" label="Kata Sandi" required error={errors.password} hint="Minimal 8 karakter, berisi huruf dan angka.">
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

                    <AuthField id="password_confirmation" label="Ulangi Kata Sandi" required error={errors.password_confirmation}>
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
                </div>

                <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? errors.recaptcha_token} />

                <div>
                    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[var(--tcd-text-2,#4a5868)]">
                        <input
                            type="checkbox"
                            aria-label="Setuju syarat dan kebijakan privasi"
                            checked={data.setuju}
                            onChange={(e) => setData('setuju', e.target.checked)}
                            className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-[var(--t-navy)]"
                            {...authA11y('setuju', errors.setuju)}
                        />
                        <span>
                            Saya menyetujui{' '}
                            <Link href="/syarat-ketentuan" className={authLinkClass}>
                                Syarat &amp; Ketentuan
                            </Link>{' '}
                            serta{' '}
                            <Link href="/kebijakan-privasi" className={authLinkClass}>
                                Kebijakan Privasi
                            </Link>{' '}
                            Contact Center.
                        </span>
                    </label>
                    {errors.setuju && (
                        <p id="setuju-error" className="mt-1 text-sm font-medium text-[var(--tcd-danger,#b42318)]">
                            {errors.setuju}
                        </p>
                    )}
                </div>

                <button type="submit" disabled={busy || !data.setuju} className={`${authPrimaryButtonClass} mt-1`}>
                    {busy ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                        <UserPlus className="h-5 w-5" aria-hidden="true" />
                    )}
                    Daftar
                </button>
            </form>

            <AuthFooter>
                <p>
                    Sudah punya akun?{' '}
                    <Link href="/masuk" className={authLinkClass}>
                        Masuk
                    </Link>
                </p>
            </AuthFooter>
        </TaraAuthShell>
    );
}
