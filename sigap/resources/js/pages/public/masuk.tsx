import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, LoaderCircle, Lock, LogIn, MessageCircle, ShieldCheck, Ticket, User, UserRoundCog } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { TaraFonts, TaraFooter, TaraLauncher, TaraPoseImage } from '@/components/sigap/tara-shell';
import TransiHeader from '@/components/sigap/transi-header';
import { goToChat } from '@/lib/chat-transition';
import { type SharedData } from '@/types';

const BENEFITS = [
    { icon: Ticket, text: 'Pantau semua tiket dan perkembangannya di satu tempat' },
    { icon: MessageCircle, text: 'Lanjutkan percakapan dengan TARA dan petugas kapan saja' },
    { icon: UserRoundCog, text: 'Petugas dan admin: kelola pengaduan dari dasbor' },
];

const inputClass =
    'h-12 w-full rounded-xl border border-[#d9dfe6] bg-white pr-4 pl-11 text-[15px] text-[#0f2233] transition-colors outline-none placeholder:text-[#9aa5b1] focus:border-[var(--t-navy)] focus:ring-4 focus:ring-[#003d68]/10';

/** Halaman masuk bergaya TARA: panel sapaan navy + formulir (warga NIK, petugas username). */
export default function Masuk({ status, canResetPassword }: { status?: string | null; canResetPassword?: boolean }) {
    const { auth } = usePage<SharedData>().props;
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        identifier: '',
        password: '',
        remember: false as boolean,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/masuk', { onFinish: () => reset('password') });
    };

    return (
        <>
            <Head title="Masuk — Contact Center">
                <TaraFonts />
            </Head>

            <div className="transi-page min-h-screen bg-white text-[#0f2233] antialiased">
                <TransiHeader loggedIn={Boolean(auth?.user)} isAdmin={Boolean(auth?.user?.is_admin)} onChat={() => goToChat()} active={null} />

                <main id="konten" className="bg-[#f7f3ee] px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
                    <div className="mx-auto grid max-w-[1080px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-28px_rgba(2,43,74,0.35)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                        {/* Panel sapaan */}
                        <section
                            className="relative overflow-hidden px-7 pt-8 pb-0 text-white sm:px-10 sm:pt-10 lg:flex lg:flex-col lg:px-11 lg:pt-12"
                            style={{ background: 'radial-gradient(140% 80% at 15% 0%, rgba(11,90,140,0.65) 0%, rgba(2,43,74,0) 70%), var(--t-deep)' }}
                        >
                            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--t-gold)] uppercase sm:text-[13px]">
                                Akun Contact Center
                            </p>
                            <h2 className="font-heading mt-3 text-[28px] leading-[1.12] font-bold sm:text-[34px]">Selamat datang kembali.</h2>
                            <p className="mt-3 max-w-[400px] text-[15px] leading-relaxed text-[#bcd0e0]">
                                Masuk untuk melihat tiket Anda dan melanjutkan urusan bersama TARA dan petugas Kementerian Transmigrasi.
                            </p>
                            <ul className="mt-7 hidden flex-col gap-3.5 sm:flex lg:max-w-[400px]">
                                {BENEFITS.map(({ icon: Icon, text }) => (
                                    <li key={text} className="flex items-start gap-3 text-[14px] leading-snug text-[#e6eef5]">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                            <Icon className="h-4 w-4 text-[var(--t-gold)]" aria-hidden="true" />
                                        </span>
                                        <span className="pt-1.5">{text}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="relative mt-7 flex items-end justify-between gap-4 pb-8 sm:pb-0 lg:mt-auto lg:pt-6">
                                <p className="flex max-w-[230px] gap-2 text-xs leading-relaxed text-[#8fa9bf] sm:mb-8">
                                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    Data pribadi Anda dilindungi sesuai UU Pelindungan Data Pribadi.
                                </p>
                                <TaraPoseImage
                                    pose="menyapa"
                                    eager
                                    className="hidden h-[240px] w-auto shrink-0 drop-shadow-[0_18px_30px_rgba(0,10,25,0.35)] sm:block lg:-mr-2 lg:h-[330px]"
                                />
                            </div>
                        </section>

                        {/* Formulir */}
                        <section className="px-7 py-9 sm:px-10 sm:py-11 lg:px-14 lg:py-14">
                            <h1 className="font-heading text-[28px] leading-tight font-bold text-[var(--t-deep)] sm:text-[32px]">Masuk</h1>
                            <p className="mt-2 text-[15px] text-[#5b6875]">Warga dengan NIK, petugas dan admin dengan username.</p>

                            {status && (
                                <p
                                    className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                                    role="status"
                                >
                                    {status}
                                </p>
                            )}

                            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="identifier" className="text-sm font-semibold text-[var(--t-deep)]">
                                        NIK / Username
                                    </label>
                                    <div className="relative">
                                        <User
                                            className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-[#8a96a3]"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="identifier"
                                            value={data.identifier}
                                            onChange={(e) => setData('identifier', e.target.value)}
                                            autoComplete="username"
                                            placeholder="16 digit NIK atau username"
                                            className={inputClass}
                                            aria-invalid={Boolean(errors.identifier)}
                                            required
                                        />
                                    </div>
                                    {errors.identifier && <p className="text-sm text-red-600">{errors.identifier}</p>}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <label htmlFor="password" className="text-sm font-semibold text-[var(--t-deep)]">
                                            Kata Sandi
                                        </label>
                                        {canResetPassword && (
                                            <Link href="/lupa-sandi" className="text-[13px] font-semibold text-[var(--t-navy)] hover:underline">
                                                Lupa kata sandi?
                                            </Link>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Lock
                                            className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-[#8a96a3]"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            autoComplete="current-password"
                                            className={`${inputClass} pr-12`}
                                            aria-invalid={Boolean(errors.password)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#6b7785] hover:bg-[#f1f4f7] hover:text-[var(--t-deep)]"
                                            aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                                            aria-pressed={showPassword}
                                        >
                                            {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                                        </button>
                                    </div>
                                    {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
                                </div>

                                <label htmlFor="remember" className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-[#4a5868]">
                                    <input
                                        id="remember"
                                        type="checkbox"
                                        checked={data.remember}
                                        onChange={(e) => setData('remember', e.target.checked)}
                                        className="h-[18px] w-[18px] rounded border-[#c5cdd6] accent-[var(--t-navy)]"
                                    />
                                    Ingat saya
                                </label>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="transi-lift font-heading mt-1 flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-[var(--t-deep)] text-[16px] font-bold text-white hover:bg-[var(--t-navy)] disabled:opacity-70"
                                >
                                    {processing ? (
                                        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <LogIn className="h-5 w-5" aria-hidden="true" />
                                    )}
                                    Masuk
                                </button>
                            </form>

                            <div className="mt-8 flex flex-col gap-3 border-t border-[#eceff3] pt-6 text-sm text-[#5b6875]">
                                <p>
                                    Warga belum punya akun?{' '}
                                    <Link href="/daftar" className="font-semibold text-[var(--t-navy)] hover:underline">
                                        Daftar di sini
                                    </Link>
                                </p>
                                <p>
                                    Tidak perlu akun untuk bertanya atau melapor.{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => goToChat({ source: e.currentTarget })}
                                        className="font-semibold text-[var(--t-navy)] hover:underline"
                                    >
                                        Chat dengan TARA
                                    </button>{' '}
                                    atau{' '}
                                    <Link href="/katalog" className="font-semibold text-[var(--t-navy)] hover:underline">
                                        ajukan pengaduan tanpa masuk
                                    </Link>
                                    .
                                </p>
                            </div>
                        </section>
                    </div>
                </main>

                <TaraFooter />
                <TaraLauncher />
            </div>
        </>
    );
}
