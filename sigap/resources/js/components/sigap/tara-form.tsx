import { usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, FileText, LoaderCircle, Paperclip, Upload, X } from 'lucide-react';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

/**
 * Unsur formulir & kartu bergaya TARA untuk halaman publik (formulir
 * pengaduan, formulir internal, rujukan, portal warga). Warna memakai
 * var(--tcd-…, warna-terang) agar ikut mode gelap & kontras tinggi.
 */

export const inputClass =
    'h-12 w-full rounded-xl border border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-surface,#fff)] px-4 text-[15px] text-[var(--tcd-text,#0f2233)] transition-colors outline-none placeholder:text-[var(--tcd-text-3,#647280)] focus:border-[var(--tcd-link,var(--t-navy))] focus:ring-4 focus:ring-[#003d68]/10 aria-[invalid=true]:border-[var(--tcd-danger,#b42318)] disabled:cursor-not-allowed disabled:bg-[var(--tcd-muted,#f6f8fa)] disabled:text-[var(--tcd-text-2,#4a5868)]';

export const textareaClass = cn(inputClass, 'h-auto min-h-[150px] resize-y py-3 leading-relaxed');

export const triggerClass =
    'h-12 rounded-xl border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-surface,#fff)] px-4 text-[15px] text-[var(--tcd-text,#0f2233)] focus:ring-4 focus:ring-[#003d68]/10 focus:ring-offset-0 aria-[invalid=true]:border-[var(--tcd-danger,#b42318)] data-[placeholder]:text-[var(--tcd-text-3,#647280)]';

/** Tombol utama (navy, membulat). */
export const primaryButtonClass =
    'transi-lift font-heading flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-[var(--t-deep)] px-8 text-[16px] font-bold text-white hover:bg-[var(--tcd-primary,var(--t-navy))] disabled:cursor-not-allowed disabled:opacity-60';

/** Tombol garis (sekunder). */
export const outlineButtonClass =
    'flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-surface,#fff)] px-6 text-[15px] font-semibold text-[var(--tcd-link,var(--t-navy))] transition-colors hover:bg-[var(--tcd-muted,#f1f4f7)] disabled:cursor-not-allowed disabled:opacity-60';

/** Kartu konten standar halaman TARA. */
export const cardClass = 'rounded-[24px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)]';

/** Atribut aksesibilitas kolom: tautkan galat (dan petunjuk) ke kolomnya. */
export function fieldA11y(id: string, error?: string, hasHint = false) {
    const describedBy = [error ? `${id}-error` : null, hasHint ? `${id}-hint` : null].filter(Boolean).join(' ');
    return { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy || undefined };
}

export function Req() {
    return (
        <span className="text-[var(--tcd-danger,#b42318)]" aria-hidden="true">
            *
        </span>
    );
}

export function ErrorText({ id, children }: { id: string; children: ReactNode }) {
    return (
        <p id={id} className="mt-1 flex items-start gap-1.5 text-sm font-medium text-[var(--tcd-danger,#b42318)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {children}
        </p>
    );
}

/** Kartu bagian formulir bernomor. */
export function FormSection({ step, title, desc, children }: { step: number; title: string; desc: string; children: ReactNode }) {
    const headingId = `bagian-${step}`;

    return (
        <section aria-labelledby={headingId} className={cn(cardClass, 'flex flex-col gap-5 p-6 shadow-[0_10px_30px_rgba(2,43,74,0.04)] sm:p-8')}>
            <header className="flex items-start gap-4">
                <span
                    className="font-heading flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tcd-primary,var(--t-deep))] text-[15px] font-bold text-white"
                    aria-hidden="true"
                >
                    {step}
                </span>
                <div className="min-w-0">
                    <h2 id={headingId} className="font-heading text-xl leading-tight font-bold text-[var(--tcd-heading,var(--t-deep))]">
                        {title}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--tcd-text-2,#4a5868)]">{desc}</p>
                </div>
            </header>
            {children}
        </section>
    );
}

/** Kartu konten dengan judul ber-ikon (rujukan, portal warga). */
export function TaraCard({
    icon: Icon,
    title,
    action,
    className,
    children,
}: {
    icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
    title?: ReactNode;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cn(cardClass, 'p-6 sm:p-7', className)}>
            {(title || action) && (
                <div className="mb-4 flex items-center justify-between gap-3">
                    {title && (
                        <h2 className="font-heading flex items-center gap-2.5 text-lg leading-tight font-bold text-[var(--tcd-heading,var(--t-deep))]">
                            {Icon && <Icon className="h-5 w-5 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />}
                            {title}
                        </h2>
                    )}
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

export function Field({
    label,
    htmlFor,
    required,
    error,
    hint,
    children,
}: {
    label: string;
    htmlFor: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor={htmlFor} className="text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                {label} {required && <Req />}
            </label>
            {children}
            {hint && (
                <p id={`${htmlFor}-hint`} className="text-[13px] text-[var(--tcd-text-2,#4a5868)]">
                    {hint}
                </p>
            )}
            {error && <ErrorText id={`${htmlFor}-error`}>{error}</ErrorText>}
        </div>
    );
}

export function RequiredNote({ id = 'keterangan-wajib' }: { id?: string }) {
    return (
        <p id={id} className="text-sm text-[var(--tcd-text-2,#4a5868)]">
            Kolom bertanda <Req /> wajib diisi.
        </p>
    );
}

/** Ringkasan galat di atas formulir; tiap butir menaut ke kolomnya. */
export function ErrorSummary({ errors, order }: { errors: Partial<Record<string, string>>; order: [string, string][] }) {
    const list = order.filter(([key]) => errors[key]);
    if (list.length === 0) return null;

    return (
        <div
            id="ringkasan-galat"
            tabIndex={-1}
            role="alert"
            className="rounded-[20px] border border-[var(--tcd-danger-border,#f5c2bd)] bg-[var(--tcd-danger-soft,#fdecea)] p-5 text-[var(--tcd-danger,#b42318)] outline-none focus-visible:ring-4 focus-visible:ring-[#b42318]/20"
        >
            <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                Periksa kembali {list.length} isian berikut:
            </p>
            <ul className="mt-2 ml-7 list-disc space-y-1 text-sm">
                {list.map(([key, label]) => (
                    <li key={key}>
                        <a href={`#${key}`} className="underline underline-offset-2">
                            {label}
                        </a>
                        : {errors[key]}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export const MAX_FILE_MB = 5;

/** Pemilih lampiran (JPG/PNG/PDF, maks. 5 MB) yang bisa difokus papan ketik. */
export function AttachmentPicker({
    id = 'attachment',
    label,
    file,
    error,
    progress,
    onPick,
}: {
    id?: string;
    label: ReactNode;
    file: File | null;
    error?: string;
    progress?: number | null;
    onPick: (file: File | null) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <span id={`${id}-label`} className="text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                {label}
            </span>
            {file ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-muted,#f6f8fa)] p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--tcd-info-soft,#e6f0f8)] text-[var(--tcd-link,var(--t-navy))]">
                        {file.type === 'application/pdf' ? (
                            <FileText className="h-5 w-5" aria-hidden="true" />
                        ) : (
                            <Paperclip className="h-5 w-5" aria-hidden="true" />
                        )}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">{file.name}</span>
                        <span className="block text-xs text-[var(--tcd-text-2,#4a5868)]">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                            {progress != null && ` · Mengunggah ${progress}%`}
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => onPick(null)}
                        aria-label={`Hapus lampiran ${file.name}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--tcd-text-2,#4a5868)] hover:bg-[var(--tcd-muted-2,#e8edf2)] hover:text-[var(--tcd-danger,#b42318)]"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
            ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[var(--tcd-border-strong,#cfd7df)] bg-[var(--tcd-muted,#f8fafb)] px-6 py-8 text-center transition-colors focus-within:border-[var(--tcd-link,var(--t-navy))] focus-within:ring-4 focus-within:ring-[#003d68]/10 hover:border-[var(--tcd-link,var(--t-navy))]">
                    <Upload className="mb-1 h-6 w-6 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                    <span className="text-[15px] font-semibold text-[var(--tcd-heading,var(--t-deep))]">Pilih foto atau dokumen</span>
                    <span className="text-[13px] text-[var(--tcd-text-2,#4a5868)]">JPG, PNG, atau PDF · maks. {MAX_FILE_MB} MB</span>
                    <input
                        id={id}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="sr-only"
                        aria-labelledby={`${id}-label`}
                        {...fieldA11y(id, error)}
                        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                    />
                </label>
            )}
            {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
        </div>
    );
}

/** Batas ukuran lampiran; mengembalikan pesan galat atau null. */
export function attachmentError(file: File | null): string | null {
    return file && file.size > MAX_FILE_MB * 1024 * 1024 ? `Ukuran berkas melebihi ${MAX_FILE_MB} MB. Pilih berkas yang lebih kecil.` : null;
}

export function SubmitButton({
    busy,
    disabled,
    icon: Icon,
    children,
}: {
    busy: boolean;
    disabled?: boolean;
    icon: ComponentType<{ className?: string }>;
    children: ReactNode;
}) {
    return (
        <button type="submit" disabled={busy || disabled} className={primaryButtonClass}>
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
            {busy ? 'Mengirim…' : children}
        </button>
    );
}

/** Pesan sesi (flash) — pengganti notifikasi PublicLayout lama. */
/** Pesan flash (sukses/galat) dari server. `wrapperClassName` membungkusnya hanya bila ada pesan. */
export function FlashNotice({ className, wrapperClassName }: { className?: string; wrapperClassName?: string }) {
    const { flash } = usePage<SharedData>().props;
    const message = flash?.success ?? flash?.error ?? null;
    const isError = !flash?.success && Boolean(flash?.error);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        setOpen(true);
    }, [flash?.success, flash?.error]);

    if (!message || !open) return null;

    const notice = (
        <div
            role={isError ? 'alert' : 'status'}
            className={cn(
                'flex items-start gap-3 rounded-[20px] border p-4 text-[15px]',
                isError
                    ? 'border-[var(--tcd-danger-border,#f5c2bd)] bg-[var(--tcd-danger-soft,#fdecea)] text-[var(--tcd-danger,#b42318)]'
                    : 'border-[var(--tcd-success-border,#a7e3c7)] bg-[var(--tcd-success-soft,#ecfaf3)] text-[var(--tcd-success,#0f6b48)]',
                className,
            )}
        >
            {isError ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1">{message}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Tutup notifikasi" className="rounded-lg p-0.5 hover:opacity-80">
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );

    return wrapperClassName ? <div className={wrapperClassName}>{notice}</div> : notice;
}
