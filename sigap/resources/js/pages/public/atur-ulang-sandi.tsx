import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { type FormEvent } from 'react';

export default function AturUlangSandi({ token, email }: { token: string; email: string }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/atur-ulang-sandi', { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <PublicLayout title="Atur Ulang Kata Sandi">
            <Head title="Atur Ulang Kata Sandi — SIGAP" />

            <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
                <Card className="border-gray-100 shadow-lg">
                    <CardContent className="p-8">
                        <div className="mb-6 text-center">
                            <h1 className="text-primary text-2xl font-bold">Buat Kata Sandi Baru</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Setelah disimpan, semua perangkat lain yang masuk dengan akun ini akan dikeluarkan.
                            </p>
                        </div>

                        <form onSubmit={submit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email akun</Label>
                                <Input id="email" type="email" value={data.email} readOnly className="bg-gray-50" />
                                {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Kata Sandi Baru</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                                {errors.password ? (
                                    <p className="text-destructive text-sm">{errors.password}</p>
                                ) : (
                                    <p className="text-xs text-gray-500">Minimal 8 karakter, berisi huruf dan angka.</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation">Ulangi Kata Sandi Baru</Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            <Button type="submit" disabled={processing} className="w-full">
                                {processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                                Simpan kata sandi
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500">
                            Tautan kedaluwarsa?{' '}
                            <Link href="/lupa-sandi" className="text-brand-light font-bold hover:underline">
                                Minta tautan baru
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}
