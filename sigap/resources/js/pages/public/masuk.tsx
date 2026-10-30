import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { LoaderCircle, Lock, LogIn, User } from 'lucide-react';
import { type FormEvent } from 'react';

export default function Masuk({ status, canResetPassword }: { status?: string | null; canResetPassword?: boolean }) {
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
        <PublicLayout title="Masuk">
            <Head title="Masuk — Contact Center" />

            <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
                <Card className="border-gray-100 shadow-lg">
                    <CardContent className="p-8">
                        <div className="mb-6 text-center">
                            <h1 className="text-primary text-2xl font-bold">Masuk ke Contact Center</h1>
                            <p className="mt-1 text-sm text-gray-500">Untuk warga (NIK) maupun petugas/admin (username)</p>
                        </div>

                        {status && (
                            <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{status}</p>
                        )}

                        <form onSubmit={submit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="identifier">NIK / Username</Label>
                                <div className="relative">
                                    <User className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="identifier"
                                        value={data.identifier}
                                        onChange={(e) => setData('identifier', e.target.value)}
                                        autoComplete="username"
                                        className="pl-9"
                                        required
                                    />
                                </div>
                                {errors.identifier && <p className="text-destructive text-sm">{errors.identifier}</p>}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Kata Sandi</Label>
                                    {canResetPassword && (
                                        <Link href="/lupa-sandi" className="text-brand-light text-xs font-semibold hover:underline">
                                            Lupa kata sandi?
                                        </Link>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="password"
                                        type="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        autoComplete="current-password"
                                        className="pl-9"
                                        required
                                    />
                                </div>
                                {errors.password && <p className="text-destructive text-sm">{errors.password}</p>}
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox id="remember" checked={data.remember} onCheckedChange={(v) => setData('remember', Boolean(v))} />
                                <Label htmlFor="remember" className="text-sm font-normal text-gray-600">
                                    Ingat saya
                                </Label>
                            </div>

                            <Button type="submit" disabled={processing} className="w-full">
                                {processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                                Masuk
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500">
                            Warga belum punya akun?{' '}
                            <Link href="/daftar" className="text-brand-light font-bold hover:underline">
                                Daftar di sini
                            </Link>
                        </p>

                        <p className="mt-2 text-center text-sm text-gray-500">
                            Anda tetap bisa{' '}
                            <Link href="/katalog" className="text-brand-light font-bold hover:underline">
                                mengajukan pengaduan tanpa login
                            </Link>
                            .
                        </p>
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}
