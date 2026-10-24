import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import type { SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle, MailCheck, RefreshCw } from 'lucide-react';
import { type FormEvent, useState } from 'react';

interface Props {
    email: string | null;
    hasEmail: boolean;
}

export default function VerifikasiEmail({ email, hasEmail }: Props) {
    const { flash } = usePage<SharedData>().props;
    const [changing, setChanging] = useState(!hasEmail);
    const resend = useForm({});
    const change = useForm({ email: '' });

    const submitResend = (e: FormEvent) => {
        e.preventDefault();
        resend.post('/verifikasi-email/kirim-ulang', { preserveScroll: true });
    };

    const submitChange = (e: FormEvent) => {
        e.preventDefault();
        change.post('/verifikasi-email/ganti', {
            preserveScroll: true,
            onSuccess: () => {
                change.reset();
                setChanging(false);
            },
        });
    };

    return (
        <PublicLayout title="Verifikasi Email">
            <Head title="Verifikasi Email — SIGAP" />

            <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
                <Card className="border-gray-100 shadow-lg">
                    <CardContent className="p-8">
                        <div className="mb-6 text-center">
                            <MailCheck className="text-brand-light mx-auto mb-3 h-10 w-10" />
                            <h1 className="text-primary text-2xl font-bold">Periksa email Anda</h1>
                            <p className="mt-2 text-sm text-gray-600">
                                {hasEmail ? (
                                    <>
                                        Kami sudah mengirim tautan verifikasi ke <strong>{email}</strong>. Klik tautan itu untuk membuka Portal Warga.
                                        Tautan berlaku 60 menit.
                                    </>
                                ) : (
                                    'Akun Anda belum memiliki email. Isi email di bawah untuk menerima tautan verifikasi.'
                                )}
                            </p>
                        </div>

                        {flash?.status && (
                            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                {flash.status}
                            </p>
                        )}

                        {hasEmail && (
                            <form onSubmit={submitResend}>
                                <Button type="submit" variant="outline" disabled={resend.processing} className="w-full">
                                    {resend.processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    Kirim ulang tautan
                                </Button>
                            </form>
                        )}

                        {changing ? (
                            <form onSubmit={submitChange} className="mt-6 space-y-3 border-t border-gray-100 pt-6">
                                <Label htmlFor="email">{hasEmail ? 'Email yang benar' : 'Email'}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={change.data.email}
                                    onChange={(e) => change.setData('email', e.target.value)}
                                    autoComplete="email"
                                    required
                                />
                                {change.errors.email && <p className="text-destructive text-sm">{change.errors.email}</p>}
                                <Button type="submit" disabled={change.processing} className="w-full">
                                    {change.processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                    Simpan &amp; kirim tautan
                                </Button>
                            </form>
                        ) : (
                            <p className="mt-6 text-center text-sm text-gray-500">
                                Salah menulis email?{' '}
                                <button type="button" onClick={() => setChanging(true)} className="text-brand-light font-bold hover:underline">
                                    Ganti email
                                </button>
                            </p>
                        )}

                        <p className="mt-6 text-center text-xs text-gray-500">
                            Tidak menerima email? Periksa folder Spam atau Promosi.{' '}
                            <button type="button" onClick={() => router.post('/keluar')} className="font-semibold hover:underline">
                                Keluar
                            </button>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}
