import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Clock, Download, FileText, LoaderCircle, LogOut, Phone, Save, Search, Trash2, UserRound } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

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

const STATUS_STYLE: Record<string, string> = {
    baru: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    verifikasi: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    diproses: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    selesai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    ditolak: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

export default function WargaPortal({ profile, tickets }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

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
        <PublicLayout title="Portal Warga">
            <Head title="Portal Warga — SIGAP" />

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <p className="mb-6 text-sm text-gray-400">
                    <Link href="/" className="hover:text-brand-light">
                        Beranda
                    </Link>{' '}
                    &gt; <span className="text-gray-700 dark:text-gray-300">Portal Warga</span>
                </p>

                {(flash?.success || flash?.error) && (
                    <div className="dark:bg-dark-card mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                        {flash.success ?? flash.error}
                    </div>
                )}

                {/* BANNER IDENTITAS */}
                <div className="bg-brand-light mb-6 flex flex-col items-center gap-6 rounded-2xl p-6 text-white shadow-sm transition-colors md:flex-row md:p-8">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-white/50 bg-white/20 text-3xl font-bold shadow-inner backdrop-blur-sm">
                        {profile.inisial}
                    </div>
                    <div className="flex-grow text-center md:text-left">
                        <h2 className="mb-1 text-2xl font-bold">{profile.nama}</h2>
                        <p className="text-brand-soft/90 flex flex-col items-center gap-1 text-sm md:flex-row md:gap-3">
                            <span className="inline-flex items-center gap-1.5">
                                <UserRound className="h-3.5 w-3.5" /> NIK: {profile.nik_masked ?? '-'}
                            </span>
                            <span className="hidden md:inline">|</span>
                            <span className="inline-flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" /> {profile.telp ?? 'Belum diisi'}
                            </span>
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="shrink-0 border-white/50 bg-white/20 text-white hover:bg-white/30 hover:text-white"
                        onClick={() => router.post('/keluar')}
                    >
                        <LogOut className="h-4 w-4" /> Keluar
                    </Button>
                </div>

                <div className="mb-8 flex flex-col gap-6 lg:flex-row">
                    {/* PENGATURAN AKUN */}
                    <AkunForm profile={profile} />

                    {/* RIWAYAT TIKET */}
                    <Card className="dark:bg-dark-card w-full border-gray-100 transition-colors lg:w-2/3 dark:border-gray-700">
                        <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                            <CardTitle className="flex items-center gap-2 text-lg text-gray-800 dark:text-white">
                                <Clock className="text-brand-light h-5 w-5" /> Riwayat Tiket Pengaduan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="border-b border-gray-100 p-4 dark:border-gray-700">
                                <div className="relative">
                                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        placeholder="Cari nomor tiket, judul, atau status..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
                                    <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-600 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                        <tr>
                                            <th scope="col" className="px-5 py-3">
                                                ID Tiket
                                            </th>
                                            <th scope="col" className="px-5 py-3">
                                                Tanggal
                                            </th>
                                            <th scope="col" className="px-5 py-3">
                                                Judul Laporan
                                            </th>
                                            <th scope="col" className="px-5 py-3 text-center">
                                                Status
                                            </th>
                                            <th scope="col" className="px-5 py-3 text-center">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-700 dark:text-gray-300">
                                        {filteredTickets.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                                                    {tickets.length === 0
                                                        ? 'Belum ada riwayat tiket. Buat pengaduan pertama Anda.'
                                                        : 'Tidak ada tiket yang cocok dengan pencarian.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTickets.map((t) => (
                                                <tr key={t.nomor} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <td className="text-brand-light px-5 py-3 font-semibold">
                                                        #{t.nomor}
                                                        {t.kode_akses && (
                                                            <span className="block font-mono text-[10px] font-normal text-gray-400">
                                                                Kode akses: {t.kode_akses}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3">{formatDate(t.tanggal)}</td>
                                                    <td className="max-w-[260px] truncate px-5 py-3">
                                                        <span className="font-medium text-gray-800 dark:text-white">{t.judul}</span>
                                                        <span className="block text-xs text-gray-400">
                                                            {t.kategori ?? 'Umum'}
                                                            {t.kawasan ? ` • ${t.kawasan}` : ''} • {t.jenis}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span
                                                            className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-600'}`}
                                                        >
                                                            {t.status_label}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button asChild size="sm" variant="ghost" title="Lacak tiket">
                                                                <Link href={`/lacak/${t.nomor}`}>
                                                                    <FileText className="h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                            <Button asChild size="sm" variant="ghost" title="Unduh lampiran">
                                                                <a href={`/portal-warga/tiket/${t.nomor}/lampiran`}>
                                                                    <Download className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                            {t.status === 'baru' && <HapusTombol nomor={t.nomor} />}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-200 p-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                <span>
                                    Menampilkan {filteredTickets.length} dari {tickets.length} tiket
                                </span>
                                <span className="italic">Halaman ini menampilkan seluruh riwayat Anda.</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PublicLayout>
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
        <Card className="dark:bg-dark-card h-fit w-full border-gray-100 transition-colors lg:w-1/3 dark:border-gray-700">
            <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                <CardTitle className="flex items-center gap-2 text-lg text-gray-800 dark:text-white">
                    <UserRound className="text-brand-light h-5 w-5" /> Pengaturan Akun
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="nik" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            NIK
                        </Label>
                        {/* NIK hanya ditampilkan tersamar dan tidak dapat diubah (A-21). */}
                        <Input id="nik" value={profile.nik_masked ?? '-'} readOnly disabled aria-readonly className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Alamat Email
                        </Label>
                        <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                        {errors.email && <p className="text-xs font-semibold text-rose-500">{errors.email}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="telp" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            No. Telp / WhatsApp
                        </Label>
                        <Input id="telp" type="tel" value={data.telp} onChange={(e) => setData('telp', e.target.value)} />
                        {errors.telp && <p className="text-xs font-semibold text-rose-500">{errors.telp}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="current_password" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Kata Sandi Saat Ini
                        </Label>
                        <Input
                            id="current_password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="Wajib diisi jika mengganti kata sandi"
                            value={data.current_password}
                            onChange={(e) => setData('current_password', e.target.value)}
                        />
                        {errors.current_password && <p className="text-xs font-semibold text-rose-500">{errors.current_password}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Kata Sandi Baru
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Kosongkan jika tidak diubah"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                        />
                        <p className="text-[11px] text-gray-400">Minimal 8 karakter, berisi huruf dan angka.</p>
                        {errors.password && <p className="text-xs font-semibold text-rose-500">{errors.password}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="password_confirmation" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Konfirmasi Kata Sandi
                        </Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Ulangi kata sandi baru"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                        />
                        {errors.password_confirmation && <p className="text-xs font-semibold text-rose-500">{errors.password_confirmation}</p>}
                    </div>
                    <Button type="submit" disabled={processing} className="mt-4 w-full">
                        {processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Perubahan
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function HapusTombol({ nomor }: { nomor: string }) {
    const [confirming, setConfirming] = useState(false);

    if (!confirming) {
        return (
            <Button size="sm" variant="ghost" title="Hapus tiket" onClick={() => setConfirming(true)}>
                <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
        );
    }

    return (
        <span className="flex items-center gap-1 text-xs">
            <button
                className="font-bold text-rose-600 hover:underline"
                onClick={() => router.delete(`/portal-warga/tiket/${nomor}`, { preserveScroll: true })}
            >
                Hapus
            </button>
            <button className="text-gray-400 hover:underline" onClick={() => setConfirming(false)}>
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
