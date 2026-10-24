import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, MessageCircleWarning } from 'lucide-react';
import { useState, type FormEvent } from 'react';

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

    return (
        <PublicLayout title={title}>
            <Head title={`${title} — SIGAP`} />

            <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
                <Card className="border-gray-100 shadow-lg">
                    <CardContent className="p-8">
                        {!token || !akun ? (
                            <div className="text-center">
                                <MessageCircleWarning className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden="true" />
                                <h1 className="text-primary text-2xl font-bold">Tautan tidak berlaku</h1>
                                <p className="mt-2 text-base text-gray-600">
                                    Tautan ini sudah dipakai atau sudah lewat batas waktunya. Tulis pesan di chat SIGAP dan minta petugas mengirim
                                    tautan baru.
                                </p>
                                <p className="mt-4 text-base text-gray-600">
                                    Sudah pernah membuat kata sandi?{' '}
                                    <Link href="/masuk" className="text-brand-light font-bold hover:underline">
                                        Masuk di sini
                                    </Link>
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6 text-center">
                                    <h1 className="text-primary text-2xl font-bold">{recovery ? 'Buat Kata Sandi Baru' : 'Buat Kata Sandi'}</h1>
                                    <p className="mt-2 text-base text-gray-600">
                                        Akun atas nama <b className="text-gray-900">{akun.nama}</b>
                                        {akun.nik && (
                                            <>
                                                {' '}
                                                (NIK <span className="font-mono">{akun.nik}</span>)
                                            </>
                                        )}{' '}
                                        {recovery
                                            ? 'sudah dicocokkan petugas. Buat kata sandi baru; kata sandi lama tidak berlaku lagi.'
                                            : 'sudah dibuat petugas. Tinggal buat kata sandi Anda.'}
                                    </p>
                                </div>

                                <form onSubmit={submit} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-base">
                                            Kata sandi
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={visible ? 'text' : 'password'}
                                                value={data.password}
                                                onChange={(e) => setData('password', e.target.value)}
                                                autoComplete="new-password"
                                                className="h-12 pr-12 text-base"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setVisible((v) => !v)}
                                                aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                                                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 hover:text-gray-800"
                                            >
                                                {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                        {errors.password ? (
                                            <p className="text-destructive text-sm">{errors.password}</p>
                                        ) : (
                                            <p className="text-sm text-gray-500">Paling sedikit 8 huruf, dan harus ada angkanya.</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password_confirmation" className="text-base">
                                            Ketik ulang kata sandi
                                        </Label>
                                        <Input
                                            id="password_confirmation"
                                            type={visible ? 'text' : 'password'}
                                            value={data.password_confirmation}
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            autoComplete="new-password"
                                            className="h-12 text-base"
                                            required
                                        />
                                    </div>

                                    <Button type="submit" disabled={processing} className="h-12 w-full text-base">
                                        {processing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
                                        Simpan dan masuk
                                    </Button>
                                </form>

                                <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    Catat kata sandi ini di tempat aman. Lain kali, masuk dengan <b>NIK</b> dan <b>kata sandi</b> ini. Petugas tidak
                                    akan pernah menanyakan kata sandi Anda.
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}
