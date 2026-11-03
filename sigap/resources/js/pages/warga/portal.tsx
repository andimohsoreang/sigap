import { Link, router, useForm } from '@inertiajs/react';
import { Clock, Download, FilePlus2, FileText, LogOut, Phone, Save, Search, Trash2, UserRound } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { cardClass, Field, fieldA11y, FlashNotice, inputClass, outlineButtonClass, SubmitButton } from '@/components/sigap/tara-form';
import TaraPage from '@/components/sigap/tara-shell';
import { cn } from '@/lib/utils';

interface Profile {
    nama: string;
    /** Sudah tersamar dari server (A-21) — hanya untuk tampilan. */
    nik: string | null;
    nik_masked: string | null;
    email: string | null;
    telp: string | null;
    inisial: string;
}

interface TicketRow {
    nomor: string;
    /** Kode akses pelacakan (perlu dibagikan bila melacak tanpa login untuk nomor format lama). */
    kode_akses?: string | null;
    tanggal: string | null;
    judul: string;
    status: string;
    status_label: string;
    kategori: string | null;
    kawasan: string | null;
    jenis: string;
    jumlah_tanggapan: number;
}

interface Props {
    profile: Profile;
    tickets: TicketRow[];
}

/** Sama dengan halaman Lacak Tiket. */
const STATUS_STYLE: Record<string, string> = {
    baru: 'bg-[var(--tcd-info-soft,#e8f1fa)] text-[var(--tcd-info,#0b5fa5)]',
    verifikasi: 'bg-[var(--tcd-info-soft,#e8f0f7)] text-[var(--tcd-link,#003d68)]',
    diproses: 'bg-[var(--tcd-warning-soft,#fdf3e1)] text-[var(--tcd-warning,#9a5b00)]',
    selesai: 'bg-[var(--tcd-success-soft,#e7f4ef)] text-[var(--tcd-success,#0d7a5f)]',
    ditolak: 'bg-[var(--tcd-danger-soft,#fdecea)] text-[var(--tcd-danger,#b42318)]',
};

const iconButton =
    'flex h-10 w-10 items-center justify-center rounded-xl text-[var(--tcd-link,var(--t-navy))] transition-colors hover:bg-[var(--tcd-muted,#f1f4f7)]';

export default function WargaPortal({ profile, tickets }: Props) {
    const [filter, setFilter] = useState('');
    const filteredTickets = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return tickets;
        return tickets.filter(
            (t) =>
                t.nomor.toLowerCase().includes(q) ||
                t.judul.toLowerCase().includes(q) ||
                t.status_label.toLowerCase().includes(q) ||
                (t.kategori ?? '').toLowerCase().includes(q),
        );
    }, [filter, tickets]);

    return (
        <TaraPage
            flash={false}
            title="Portal Warga"
            breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Portal Warga' }]}
            eyebrow="Portal Warga"
            heading={profile.nama}
            subtitle={
                <span className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
                    <span className="inline-flex items-center gap-2">
                        <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" /> NIK:{' '}
                        <span className="font-mono">{profile.nik_masked ?? '-'}</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {profile.telp ?? 'Belum diisi'}
                    </span>
                </span>
            }
            heroChildren={
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/pengaduan/baru"
                        className="transi-lift font-heading flex h-12 items-center gap-2 rounded-full bg-[var(--t-deep)] px-6 font-bold text-white hover:bg-[var(--tcd-primary,var(--t-navy))]"
                    >
                        <FilePlus2 className="h-5 w-5" aria-hidden="true" /> Buat pengaduan
                    </Link>
                    <button type="button" className={outlineButtonClass} onClick={() => router.post('/keluar')}>
                        <LogOut className="h-4 w-4" aria-hidden="true" /> Keluar
                    </button>
                </div>
            }
            pose="menyapa"
            poseAlt="TARA menyapa Anda"
            compact
        >
            <div className="mx-auto flex max-w-[1312px] flex-col gap-6 px-4 py-10 sm:px-6 lg:px-16 lg:py-14">
                <FlashNotice />

                <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
                    {/* PENGATURAN AKUN */}
                    <AkunForm profile={profile} />

                    {/* RIWAYAT TIKET */}
                    <section aria-labelledby="riwayat-tiket" className={cn(cardClass, 'w-full min-w-0 overflow-hidden lg:w-2/3')}>
                        <div className="flex flex-col gap-4 border-b border-[var(--tcd-border,#e6ebf0)] p-6 sm:flex-row sm:items-center sm:justify-between">
                            <h2
                                id="riwayat-tiket"
                                className="font-heading flex items-center gap-2.5 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]"
                            >
                                <Clock className="h-5 w-5 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" /> Riwayat Tiket Pengaduan
                            </h2>
                            <div className="relative sm:w-[320px]">
                                <label htmlFor="cari-tiket" className="sr-only">
                                    Cari tiket
                                </label>
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--tcd-text-3,#647280)]"
                                    aria-hidden="true"
                                />
                                <input
                                    id="cari-tiket"
                                    type="search"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder="Cari nomor tiket, judul, atau status..."
                                    className={cn(inputClass, 'h-11 pl-10')}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel riwayat tiket">
                            <table className="w-full min-w-[560px] text-left text-sm">
                                <thead className="bg-[var(--tcd-muted,#f6f8fa)] text-xs font-semibold tracking-wide text-[var(--tcd-text-2,#4a5868)] uppercase">
                                    <tr>
                                        <th scope="col" className="py-3 pr-3 pl-6">
                                            Tiket
                                        </th>
                                        <th scope="col" className="px-3 py-3">
                                            Judul Laporan
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-center">
                                            Status
                                        </th>
                                        <th scope="col" className="py-3 pr-6 pl-3 text-center">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tcd-border,#e6ebf0)] text-[var(--tcd-text,#0f2233)]">
                                    {filteredTickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-[15px] text-[var(--tcd-text-2,#4a5868)]">
                                                {tickets.length === 0 ? (
                                                    <>
                                                        Belum ada riwayat tiket.{' '}
                                                        <Link
                                                            href="/pengaduan/baru"
                                                            className="font-semibold text-[var(--tcd-link,var(--t-navy))] hover:underline"
                                                        >
                                                            Buat pengaduan pertama Anda.
                                                        </Link>
                                                    </>
                                                ) : (
                                                    'Tidak ada tiket yang cocok dengan pencarian.'
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTickets.map((t) => (
                                            <tr key={t.nomor} className="transition-colors hover:bg-[var(--tcd-muted,#f8fafb)]">
                                                <td className="py-4 pr-3 pl-6 whitespace-nowrap">
                                                    <Link
                                                        href={`/lacak/${t.nomor}`}
                                                        className="font-mono font-semibold text-[var(--tcd-link,var(--t-navy))] hover:underline"
                                                    >
                                                        #{t.nomor}
                                                    </Link>
                                                    <span className="block text-xs text-[var(--tcd-text-2,#4a5868)]">{formatDate(t.tanggal)}</span>
                                                    {t.kode_akses && (
                                                        <span className="block font-mono text-[11px] text-[var(--tcd-text-2,#4a5868)]">
                                                            Kode akses: {t.kode_akses}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="max-w-[280px] px-3 py-4">
                                                    <span className="block truncate font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                                                        {t.judul}
                                                    </span>
                                                    <span className="block truncate text-xs text-[var(--tcd-text-2,#4a5868)]">
                                                        {t.kategori ?? 'Umum'}
                                                        {t.kawasan ? ` • ${t.kawasan}` : ''} • {t.jenis}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 text-center whitespace-nowrap">
                                                    <span
                                                        className={cn(
                                                            'inline-block rounded-full px-3 py-1 text-xs font-bold',
                                                            STATUS_STYLE[t.status] ??
                                                                'bg-[var(--tcd-muted,#f1f4f7)] text-[var(--tcd-text-2,#4a5868)]',
                                                        )}
                                                    >
                                                        {t.status_label}
                                                    </span>
                                                </td>
                                                <td className="py-4 pr-6 pl-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Link
                                                            href={`/lacak/${t.nomor}`}
                                                            className={iconButton}
                                                            title="Lacak tiket"
                                                            aria-label={`Lacak tiket ${t.nomor}`}
                                                        >
                                                            <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
                                                        </Link>
                                                        <a
                                                            href={`/portal-warga/tiket/${t.nomor}/lampiran`}
                                                            className={iconButton}
                                                            title="Unduh lampiran"
                                                            aria-label={`Unduh lampiran tiket ${t.nomor}`}
                                                        >
                                                            <Download className="h-[18px] w-[18px]" aria-hidden="true" />
                                                        </a>
                                                        {t.status === 'baru' && <HapusTombol nomor={t.nomor} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col gap-1 border-t border-[var(--tcd-border,#e6ebf0)] px-6 py-4 text-[13px] text-[var(--tcd-text-2,#4a5868)] sm:flex-row sm:items-center sm:justify-between">
                            <span role="status">
                                Menampilkan {filteredTickets.length} dari {tickets.length} tiket
                            </span>
                            <span>Halaman ini menampilkan seluruh riwayat Anda.</span>
                        </div>
                    </section>
                </div>
            </div>
        </TaraPage>
    );
}

function AkunForm({ profile }: { profile: Profile }) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        email: profile.email ?? '',
        telp: profile.telp ?? '',
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        patch('/portal-warga/profil', {
            preserveScroll: true,
            onSuccess: () => reset('current_password', 'password', 'password_confirmation'),
            onError: () => reset('current_password', 'password', 'password_confirmation'),
        });
    };

    return (
        <section aria-labelledby="pengaturan-akun" className={cn(cardClass, 'w-full p-6 sm:p-7 lg:w-1/3')}>
            <h2 id="pengaturan-akun" className="font-heading flex items-center gap-2.5 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">
                <UserRound className="h-5 w-5 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" /> Pengaturan Akun
            </h2>
            <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
                <Field label="NIK" htmlFor="nik" hint="NIK tidak dapat diubah.">
                    {/* NIK hanya ditampilkan tersamar dan tidak dapat diubah (A-21). */}
                    <input
                        id="nik"
                        value={profile.nik_masked ?? '-'}
                        readOnly
                        disabled
                        aria-readonly
                        aria-describedby="nik-hint"
                        className={cn(inputClass, 'font-mono')}
                    />
                </Field>
                <Field label="Alamat Email" htmlFor="email" error={errors.email}>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className={inputClass}
                        {...fieldA11y('email', errors.email)}
                    />
                </Field>
                <Field label="No. Telp / WhatsApp" htmlFor="telp" error={errors.telp}>
                    <input
                        id="telp"
                        type="tel"
                        autoComplete="tel"
                        value={data.telp}
                        onChange={(e) => setData('telp', e.target.value)}
                        className={inputClass}
                        {...fieldA11y('telp', errors.telp)}
                    />
                </Field>

                <div className="flex flex-col gap-5 border-t border-[var(--tcd-border,#e6ebf0)] pt-5">
                    <p className="text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">Ganti kata sandi</p>
                    <Field label="Kata Sandi Saat Ini" htmlFor="current_password" error={errors.current_password}>
                        <input
                            id="current_password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="Wajib diisi jika mengganti kata sandi"
                            value={data.current_password}
                            onChange={(e) => setData('current_password', e.target.value)}
                            className={inputClass}
                            {...fieldA11y('current_password', errors.current_password)}
                        />
                    </Field>
                    <Field label="Kata Sandi Baru" htmlFor="password" error={errors.password} hint="Minimal 8 karakter, berisi huruf dan angka.">
                        <input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Kosongkan jika tidak diubah"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            className={inputClass}
                            {...fieldA11y('password', errors.password, true)}
                        />
                    </Field>
                    <Field label="Konfirmasi Kata Sandi" htmlFor="password_confirmation" error={errors.password_confirmation}>
                        <input
                            id="password_confirmation"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Ulangi kata sandi baru"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            className={inputClass}
                            {...fieldA11y('password_confirmation', errors.password_confirmation)}
                        />
                    </Field>
                </div>

                <SubmitButton busy={processing} icon={Save}>
                    Simpan Perubahan
                </SubmitButton>
            </form>
        </section>
    );
}

function HapusTombol({ nomor }: { nomor: string }) {
    const [confirming, setConfirming] = useState(false);

    if (!confirming) {
        return (
            <button
                type="button"
                title="Hapus tiket"
                aria-label={`Hapus tiket ${nomor}`}
                onClick={() => setConfirming(true)}
                className={cn(iconButton, 'text-[var(--tcd-danger,#b42318)]')}
            >
                <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
        );
    }

    return (
        <span className="flex items-center gap-2 text-xs" role="group" aria-label={`Konfirmasi hapus tiket ${nomor}`}>
            <button
                type="button"
                className="rounded-lg px-2 py-1.5 font-bold text-[var(--tcd-danger,#b42318)] hover:bg-[var(--tcd-danger-soft,#fdecea)]"
                onClick={() => router.delete(`/portal-warga/tiket/${nomor}`, { preserveScroll: true })}
            >
                Hapus
            </button>
            <button
                type="button"
                className="rounded-lg px-2 py-1.5 text-[var(--tcd-text-2,#4a5868)] hover:bg-[var(--tcd-muted,#f1f4f7)]"
                onClick={() => setConfirming(false)}
            >
                Batal
            </button>
        </span>
    );
}

function formatDate(value: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
