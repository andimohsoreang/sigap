import { Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, MessageCircleWarning, UserRoundCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import TaraAuthShell, {
    AuthField,
    AuthHeading,
    AuthNotice,
    authA11y,
    authInputClass,
    authLinkClass,
    authPrimaryButtonClass,
} from '@/components/sigap/tara-auth-shell';

interface Akun {
    nama: string;
    nik: string | null;
    berlaku_sampai: string;
}

/**
 * Warga yang didaftarkan petugas dari chat membuat kata sandinya sendiri.
 * Teks dibuat besar & singkat karena banyak pengguna baru pertama kali
 * memakai layanan daring.
 */
export default function AktivasiAkun({
    token,
    jenis = 'aktivasi',
    akun,
}: {
    token: string | null;
    /** aktivasi = akun baru dari petugas; pemulihan = lupa kata sandi. */
    jenis?: 'aktivasi' | 'pemulihan';
    akun: Akun | null;
}) {
    const recovery = jenis === 'pemulihan';
    const title = recovery ? 'Buat Kata Sandi Baru' : 'Aktifkan Akun';
    const [visible, setVisible] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({ password: '', password_confirmation: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(`/aktivasi/${token}`, { onFinish: () => reset('password', 'password_confirmation') });
    };

    const largeInput = `${authInputClass} text-base`;

    return (
        <TaraAuthShell title={title}>
            {!token || !akun ? (
                <>
                    <AuthHeading icon={MessageCircleWarning} tone="warning" title="Tautan tidak berlaku" large>
                        Tautan ini sudah dipakai atau sudah lewat batas waktunya. Tulis pesan di chat Contact Center dan minta petugas mengirim tautan
                        baru.
                    </AuthHeading>
                    <p className="mt-6 text-center text-base text-[var(--tcd-text-2,#4a5868)]">
                        Sudah pernah membuat kata sandi?{' '}
                        <Link href="/masuk" className={authLinkClass}>
                            Masuk di sini
                        </Link>
                    </p>
                </>
            ) : (
                <>
                    <AuthHeading icon={UserRoundCheck} title={recovery ? 'Buat Kata Sandi Baru' : 'Buat Kata Sandi'} large>
                        Akun atas nama <b className="text-[var(--tcd-heading,var(--t-deep))]">{akun.nama}</b>
                        {akun.nik && (
                            <>
                                {' '}
                                (NIK <span className="font-mono">{akun.nik}</span>)
                            </>
                        )}{' '}
                        {recovery
                            ? 'sudah dicocokkan petugas. Buat kata sandi baru; kata sandi lama tidak berlaku lagi.'
                            : 'sudah dibuat petugas. Tinggal buat kata sandi Anda.'}
                    </AuthHeading>

                    <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                        <AuthField
                            id="password"
                            label="Kata sandi"
                            error={errors.password}
                            hint="Paling sedikit 8 huruf, dan harus ada angkanya."
                            large
                        >
                            <div className="relative">
                                <input
                                    id="password"
                                    type={visible ? 'text' : 'password'}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="new-password"
                                    className={`${largeInput} pr-12`}
                                    required
                                    {...authA11y('password', errors.password, true)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setVisible((v) => !v)}
                                    aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                                    aria-pressed={visible}
                                    className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--tcd-text-3,#6b7785)] hover:bg-[var(--tcd-muted,#f1f4f7)] hover:text-[var(--tcd-heading,var(--t-deep))]"
                                >
                                    {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </AuthField>

                        <AuthField id="password_confirmation" label="Ketik ulang kata sandi" error={errors.password_confirmation} large>
                            <input
                                id="password_confirmation"
                                type={visible ? 'text' : 'password'}
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                autoComplete="new-password"
                                className={largeInput}
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
                            Simpan dan masuk
                        </button>
                    </form>

                    <div className="mt-6">
                        <AuthNotice>
                            Catat kata sandi ini di tempat aman. Lain kali, masuk dengan <b>NIK</b> dan <b>kata sandi</b> ini. Petugas tidak akan
                            pernah menanyakan kata sandi Anda.
                        </AuthNotice>
                    </div>
                </>
            )}
        </TaraAuthShell>
    );
}
