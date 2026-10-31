import { usePage } from '@inertiajs/react';
import {
    Accessibility,
    Contrast,
    Keyboard,
    Link2,
    type LucideIcon,
    Monitor,
    Moon,
    Palette,
    PauseCircle,
    RotateCcw,
    Sun,
    Type,
    X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { type A11yPrefs, DEFAULT_A11Y, resetA11y, setA11y, setTheme, type ThemeChoice, usePreferences } from '@/lib/preferences';
import { cn } from '@/lib/utils';

/** Tombol ☀️/🌙 di header: beralih terang ↔ gelap ("Ikuti sistem" ada di panel aksesibilitas). */
export function ThemeToggle({ className, tone = 'tara' }: { className?: string; tone?: 'tara' | 'admin' }) {
    const { dark } = usePreferences();

    return (
        <button
            type="button"
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            aria-pressed={dark}
            aria-label="Mode gelap"
            title={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            className={cn(
                'flex shrink-0 items-center justify-center transition-colors',
                tone === 'admin'
                    ? 'h-9 w-9 rounded-lg text-[var(--adm-text-3)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)]'
                    : 'h-10 w-10 rounded-full border border-[var(--tcd-border-strong,#d5dee6)] text-[var(--tcd-link,var(--t-navy))] hover:bg-[var(--tcd-muted,#f2f5f8)]',
                className,
            )}
        >
            {dark ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
        </button>
    );
}

/** Baris "Mode gelap" di menu ponsel (tombol ☀️/🌙 header disembunyikan di layar kecil). */
export function ThemeMenuRow() {
    const { dark } = usePreferences();

    return (
        <button
            type="button"
            role="switch"
            aria-checked={dark}
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            className="flex items-center justify-between rounded-lg px-3 py-3 text-left text-base text-[var(--tcd-text,#22313f)] hover:bg-[var(--tcd-muted,#f2f5f8)]"
        >
            <span className="flex items-center gap-2.5">
                {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
                Mode gelap
            </span>
            <span
                aria-hidden="true"
                className={cn(
                    'relative h-6 w-10 shrink-0 rounded-full transition-colors',
                    dark ? 'bg-[var(--tcd-primary,var(--t-navy))]' : 'bg-[var(--tcd-border-strong,#cdd6df)]',
                )}
            >
                <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-[left]', dark ? 'left-5' : 'left-1')} />
            </span>
        </button>
    );
}

const OPEN_EVENT = 'cc-open-a11y';

/** Buka panel aksesibilitas dari tempat lain (mis. menu ponsel). */
export function openAccessibilityMenu(): void {
    window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Baris "Aksesibilitas" di menu ponsel. */
export function AccessibilityMenuRow({ onOpen }: { onOpen?: () => void }) {
    return (
        <button
            type="button"
            onClick={() => {
                onOpen?.();
                openAccessibilityMenu();
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-left text-base text-[var(--tcd-text,#22313f)] hover:bg-[var(--tcd-muted,#f2f5f8)]"
        >
            <Accessibility className="h-5 w-5" aria-hidden="true" /> Aksesibilitas
        </button>
    );
}

const TOGGLES: { key: Exclude<keyof A11yPrefs, 'text'>; label: string; hint: string; icon: LucideIcon }[] = [
    { key: 'contrast', label: 'Kontras tinggi', hint: 'Hitam, putih, dan kuning', icon: Contrast },
    { key: 'links', label: 'Sorot tautan & tombol', hint: 'Garis bawah dan bingkai', icon: Link2 },
    { key: 'dyslexia', label: 'Huruf mudah dibaca', hint: 'Ramah disleksia, jarak lebih lega', icon: Type },
    { key: 'motion', label: 'Hentikan animasi', hint: 'Tanpa gerakan dan efek', icon: PauseCircle },
    { key: 'focus', label: 'Penanda fokus tebal', hint: 'Untuk navigasi keyboard', icon: Keyboard },
    { key: 'gray', label: 'Mode abu-abu', hint: 'Tampilan tanpa warna', icon: Palette },
];

const TEXT_SIZES: { value: A11yPrefs['text']; label: string; name: string }[] = [
    { value: 0, label: 'A', name: 'Ukuran teks normal' },
    { value: 1, label: 'A+', name: 'Ukuran teks 115%' },
    { value: 2, label: 'A++', name: 'Ukuran teks 130%' },
];

const THEMES: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Terang', icon: Sun },
    { value: 'dark', label: 'Gelap', icon: Moon },
    { value: 'system', label: 'Ikuti sistem', icon: Monitor },
];

/**
 * Tombol ♿ melayang di tepi kiri + panel pengaturan aksesibilitas (halaman
 * publik TARA). Pengaturan tersimpan di browser pengunjung.
 */
export function AccessibilityMenu() {
    const { theme, a11y } = usePreferences();
    const [open, setOpen] = useState(false);
    // Di halaman Chat versi ponsel tombol melayang menutupi kolom ketik: buka lewat menu ☰.
    const onChatPage = usePage().url.startsWith('/chat');
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const active = (Object.keys(DEFAULT_A11Y) as (keyof A11yPrefs)[]).filter((k) => a11y[k] !== DEFAULT_A11Y[k]).length;

    useEffect(() => {
        const show = () => setOpen(true);
        window.addEventListener(OPEN_EVENT, show);
        return () => window.removeEventListener(OPEN_EVENT, show);
    }, []);

    useEffect(() => {
        if (!open) return;
        panelRef.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        const onPointer = (e: PointerEvent) => {
            const t = e.target as Node;
            if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [open]);

    // Portal ke <body>: header memakai backdrop-blur yang mengunci elemen fixed di dalamnya.
    if (typeof document === 'undefined') return null;

    return createPortal(
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="panel-aksesibilitas"
                title="Aksesibilitas"
                className={cn(
                    // Ponsel: tombol bulat kiri bawah (TARA di kanan bawah); layar lebar: tab di tepi kiri.
                    'a11y-panel fixed bottom-4 left-3 z-[95] h-12 w-12 items-center justify-center rounded-full bg-[var(--tcd-primary,var(--t-navy))] text-white shadow-[0_8px_24px_rgba(2,43,74,0.28)] transition-[width,background-color] hover:bg-[var(--tcd-primary-hover,#00508a)] sm:top-[38%] sm:bottom-auto sm:left-0 sm:w-11 sm:rounded-none sm:rounded-r-2xl sm:hover:w-12',
                    onChatPage ? 'hidden sm:flex' : 'flex',
                )}
            >
                <Accessibility className="h-6 w-6" aria-hidden="true" />
                {/* Nama tombol dari isinya: "Aksesibilitas 2 pengaturan aktif" (angka lencana ikut terbaca). */}
                <span className="sr-only">Aksesibilitas </span>
                {active > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--t-gold)] px-1 text-[11px] font-bold text-[var(--t-deep)]">
                        {active}
                        <span className="sr-only"> pengaturan aktif</span>
                    </span>
                )}
            </button>

            {open && (
                <div
                    ref={panelRef}
                    id="panel-aksesibilitas"
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby={titleId}
                    className="a11y-panel fixed top-1/2 left-3 z-[96] flex max-h-[calc(100dvh-24px)] w-[min(340px,calc(100vw-24px))] -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-[var(--tcd-border,#e8edf2)] bg-[var(--tcd-surface,#fff)] text-[var(--tcd-text,#0f2233)] shadow-[0_24px_60px_-20px_rgba(2,43,74,0.45)] sm:left-14"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--tcd-border,#e8edf2)] px-5 py-4">
                        <h2 id={titleId} className="font-heading flex items-center gap-2 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">
                            <Accessibility className="h-5 w-5 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" /> Aksesibilitas
                        </h2>
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                buttonRef.current?.focus();
                            }}
                            aria-label="Tutup panel aksesibilitas"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--tcd-text-2,#4a5868)] hover:bg-[var(--tcd-muted,#f2f5f8)]"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5">
                        <fieldset>
                            <legend className="mb-2 text-xs font-semibold tracking-[0.1em] text-[var(--tcd-text-3,#667382)] uppercase">
                                Ukuran teks
                            </legend>
                            <div className="grid grid-cols-3 gap-2">
                                {TEXT_SIZES.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setA11y({ text: t.value })}
                                        aria-pressed={a11y.text === t.value}
                                        aria-label={t.name}
                                        className={cn(
                                            'font-heading h-11 rounded-xl border font-bold transition-colors',
                                            t.value === 0 ? 'text-sm' : t.value === 1 ? 'text-base' : 'text-lg',
                                            a11y.text === t.value
                                                ? 'border-[var(--tcd-primary,var(--t-navy))] bg-[var(--tcd-primary,var(--t-navy))] text-white'
                                                : 'border-[var(--tcd-border-strong,#d5dee6)] text-[var(--tcd-text,#0f2233)] hover:bg-[var(--tcd-muted,#f2f5f8)]',
                                        )}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset>
                            <legend className="mb-2 text-xs font-semibold tracking-[0.1em] text-[var(--tcd-text-3,#667382)] uppercase">Tema</legend>
                            <div className="grid grid-cols-3 gap-2">
                                {THEMES.map(({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setTheme(value)}
                                        aria-pressed={theme === value}
                                        className={cn(
                                            'flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors',
                                            theme === value
                                                ? 'border-[var(--tcd-primary,var(--t-navy))] bg-[var(--tcd-primary,var(--t-navy))] text-white'
                                                : 'border-[var(--tcd-border-strong,#d5dee6)] text-[var(--tcd-text,#0f2233)] hover:bg-[var(--tcd-muted,#f2f5f8)]',
                                        )}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <ul className="flex flex-col gap-2">
                            {TOGGLES.map(({ key, label, hint, icon: Icon }) => (
                                <li key={key}>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={a11y[key]}
                                        onClick={() => setA11y({ [key]: !a11y[key] })}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                                            a11y[key]
                                                ? 'border-[var(--tcd-primary,var(--t-navy))] bg-[var(--tcd-info-soft,#e8f0f7)]'
                                                : 'border-[var(--tcd-border,#e8edf2)] hover:bg-[var(--tcd-muted,#f2f5f8)]',
                                        )}
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--tcd-muted,#f2f5f8)] text-[var(--tcd-link,var(--t-navy))]">
                                            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-[var(--tcd-text,#0f2233)]">{label}</span>
                                            <span className="block text-xs text-[var(--tcd-text-3,#667382)]">{hint}</span>
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'relative h-6 w-10 shrink-0 rounded-full transition-colors',
                                                a11y[key] ? 'bg-[var(--tcd-primary,var(--t-navy))]' : 'bg-[var(--tcd-border-strong,#cdd6df)]',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-[left]',
                                                    a11y[key] ? 'left-5' : 'left-1',
                                                )}
                                            />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="border-t border-[var(--tcd-border,#e8edf2)] px-5 py-3.5">
                        <button
                            type="button"
                            onClick={() => {
                                resetA11y();
                                setTheme('light');
                            }}
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--tcd-border-strong,#d5dee6)] text-sm font-semibold text-[var(--tcd-text,#0f2233)] hover:bg-[var(--tcd-muted,#f2f5f8)]"
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Atur ulang semua
                        </button>
                    </div>
                </div>
            )}
        </>,
        document.body,
    );
}
