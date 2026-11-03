import { Head, usePage } from '@inertiajs/react';
import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { TARA_FONTS_HREF, TaraFooter, TaraLauncher, TaraPoseImage, type TaraPose } from '@/components/sigap/tara-shell';
import TransiHeader from '@/components/sigap/transi-header';
import { goToChat } from '@/lib/chat-transition';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

/**
 * Bingkai halaman akun bergaya TARA (daftar, lupa/atur ulang sandi, aktivasi,
 * verifikasi email): header, latar krem, kartu formulir, footer navy. Dengan
 * `panel`, kartu dibelah dua seperti halaman Masuk (panel sapaan navy + formulir).
 */

export const authInputClass =
    'h-12 w-full rounded-xl border border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-surface,#fff)] px-4 text-[15px] text-[var(--tcd-text,#0f2233)] transition-colors outline-none placeholder:text-[var(--tcd-text-3,#647280)] focus:border-[var(--tcd-link,var(--t-navy))] focus:ring-4 focus:ring-[#003d68]/10 aria-[invalid=true]:border-[var(--tcd-danger,#b42318)] read-only:bg-[var(--tcd-muted,#f1f4f7)] read-only:text-[var(--tcd-text-2,#4a5868)]';

export const authPrimaryButtonClass =
    'transi-lift font-heading flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-[var(--t-deep)] px-6 text-[16px] font-bold text-white hover:bg-[var(--tcd-primary,var(--t-navy))] disabled:cursor-not-allowed disabled:opacity-60';

export const authSecondaryButtonClass =
    'flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-surface,#fff)] px-6 text-[15px] font-semibold text-[var(--tcd-link,var(--t-navy))] transition-colors hover:bg-[var(--tcd-muted,#f1f4f7)] disabled:opacity-60';

export const authLinkClass = 'font-semibold text-[var(--tcd-link,var(--t-navy))] underline-offset-2 hover:underline';

export default function TaraAuthShell({ title, panel, children }: { title: string; panel?: ReactNode; children: ReactNode }) {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title={`${title} — Contact Center`}>
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link rel="stylesheet" href={TARA_FONTS_HREF} head-key="transi-fonts" />
            </Head>

            <div className="transi-page min-h-screen bg-[var(--tcd-surface,#fff)] text-[var(--tcd-text,#0f2233)] antialiased">
                <a
                    href="#konten"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[110] focus:rounded-lg focus:bg-[var(--tcd-primary,var(--t-navy))] focus:px-4 focus:py-2 focus:text-white"
                >
                    Langsung ke konten utama
                </a>
                <TransiHeader loggedIn={Boolean(auth?.user)} isAdmin={Boolean(auth?.user?.is_admin)} onChat={() => goToChat()} active={null} />

                <main id="konten" className="bg-[var(--tcd-cream,#f7f3ee)] px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
                    {panel ? (
                        <div className="mx-auto grid max-w-[1080px] overflow-hidden rounded-[28px] bg-[var(--tcd-surface,#fff)] shadow-[0_24px_60px_-28px_rgba(2,43,74,0.35)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                            {panel}
                            <section className="px-7 py-9 sm:px-10 sm:py-11 lg:px-14 lg:py-14">{children}</section>
                        </div>
                    ) : (
                        <section className="mx-auto w-full max-w-[520px] rounded-[28px] bg-[var(--tcd-surface,#fff)] px-6 py-9 shadow-[0_24px_60px_-28px_rgba(2,43,74,0.35)] sm:px-10 sm:py-11">
                            {children}
                        </section>
                    )}
                </main>

                <TaraFooter />
                <TaraLauncher />
            </div>
        </>
    );
}

/** Panel sapaan navy di sisi kiri kartu (gaya halaman Masuk). */
export function AuthPanel({
    eyebrow,
    heading,
    text,
    items,
    note,
    pose = 'menyapa',
}: {
    eyebrow: string;
    heading: string;
    text: ReactNode;
    items?: { icon: LucideIcon; text: string }[];
    note?: ReactNode;
    pose?: TaraPose;
}) {
    return (
        <section
            className="relative overflow-hidden px-7 pt-8 pb-0 text-white sm:px-10 sm:pt-10 lg:flex lg:flex-col lg:px-11 lg:pt-12"
            style={{ background: 'radial-gradient(140% 80% at 15% 0%, rgba(11,90,140,0.65) 0%, rgba(2,43,74,0) 70%), var(--t-deep)' }}
        >
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--t-gold)] uppercase sm:text-[13px]">{eyebrow}</p>
            <h2 className="font-heading mt-3 text-[28px] leading-[1.12] font-bold sm:text-[34px]">{heading}</h2>
            <p className="mt-3 max-w-[400px] text-[15px] leading-relaxed text-[#bcd0e0]">{text}</p>
            {items && (
                <ul className="mt-7 hidden flex-col gap-3.5 sm:flex lg:max-w-[400px]">
                    {items.map(({ icon: Icon, text: itemText }) => (
                        <li key={itemText} className="flex items-start gap-3 text-[14px] leading-snug text-[#e6eef5]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                <Icon className="h-4 w-4 text-[var(--t-gold)]" aria-hidden="true" />
                            </span>
                            <span className="pt-1.5">{itemText}</span>
                        </li>
                    ))}
                </ul>
            )}
            <div className="relative mt-7 flex items-end justify-between gap-4 pb-8 sm:pb-0 lg:mt-auto lg:pt-6">
                <div className="flex max-w-[230px] gap-2 text-xs leading-relaxed text-[#8fa9bf] sm:mb-8">{note}</div>
                <TaraPoseImage
                    pose={pose}
                    eager
                    className="hidden h-[240px] w-auto shrink-0 drop-shadow-[0_18px_30px_rgba(0,10,25,0.35)] sm:block lg:-mr-2 lg:h-[330px]"
                />
            </div>
        </section>
    );
}

/** Judul kartu formulir: ikon bulat, judul, dan penjelasan singkat. */
export function AuthHeading({
    icon: Icon,
    tone = 'info',
    title,
    children,
    large = false,
}: {
    icon?: LucideIcon;
    tone?: 'info' | 'warning';
    title: string;
    children?: ReactNode;
    /** Teks lebih besar (pengguna baru pertama kali memakai layanan daring). */
    large?: boolean;
}) {
    return (
        <div className={cn(Icon && 'text-center')}>
            {Icon && (
                <span
                    className={cn(
                        'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full',
                        tone === 'info'
                            ? 'bg-[var(--tcd-info-soft,#e6f0f8)] text-[var(--tcd-link,var(--t-navy))]'
                            : 'bg-[var(--tcd-warning-soft,#fdf3dc)] text-[var(--tcd-warning,#8a5a00)]',
                    )}
                >
                    <Icon className="h-7 w-7" aria-hidden="true" />
                </span>
            )}
            <h1 className="font-heading text-[28px] leading-tight font-bold text-[var(--tcd-heading,var(--t-deep))] sm:text-[32px]">{title}</h1>
            {children && (
                <div className={cn('mt-2 leading-relaxed text-[var(--tcd-text-2,#4a5868)]', large ? 'text-base sm:text-[17px]' : 'text-[15px]')}>
                    {children}
                </div>
            )}
        </div>
    );
}

/** Kolom formulir: label tertaut, petunjuk, dan galat (ditautkan lewat aria-describedby). */
export function AuthField({
    id,
    label,
    required,
    error,
    hint,
    large = false,
    children,
}: {
    id: string;
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    large?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className={cn('font-semibold text-[var(--tcd-heading,var(--t-deep))]', large ? 'text-base' : 'text-sm')}>
                {label}
                {required && (
                    <span className="text-[var(--tcd-danger,#b42318)]" aria-hidden="true">
                        {' '}
                        *
                    </span>
                )}
            </label>
            {children}
            {hint && !error && (
                <p id={`${id}-hint`} className={cn('text-[var(--tcd-text-2,#4a5868)]', large ? 'text-sm' : 'text-[13px]')}>
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className="text-sm font-medium text-[var(--tcd-danger,#b42318)]">
                    {error}
                </p>
            )}
        </div>
    );
}

/** Atribut aksesibilitas untuk input di dalam {@see AuthField}. */
export function authA11y(id: string, error?: string, hint?: boolean) {
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
}

/** Pesan berhasil (status) di dalam kartu. */
export function AuthStatus({ children }: { children: ReactNode }) {
    return (
        <p
            role="status"
            className="rounded-xl border border-[var(--tcd-success-border,oklch(0.905_0.093_164.15))] bg-[var(--tcd-success-soft,oklch(0.979_0.021_166.113))] px-4 py-3 text-sm text-[var(--tcd-success,oklch(0.432_0.095_166.913))]"
        >
            {children}
        </p>
    );
}

/** Catatan penting (kuning) di dalam kartu. */
export function AuthNotice({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-xl border border-[var(--tcd-warning-border,#f0dca8)] bg-[var(--tcd-warning-soft,#fdf6e3)] px-4 py-3 text-sm leading-relaxed text-[var(--tcd-warning,#7a4d0b)]">
            {children}
        </div>
    );
}

/** Baris tautan di bawah formulir, dipisah garis tipis. */
export function AuthFooter({ children }: { children: ReactNode }) {
    return (
        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--tcd-border,#eceff3)] pt-6 text-sm text-[var(--tcd-text-2,#5b6875)]">
            {children}
        </div>
    );
}
