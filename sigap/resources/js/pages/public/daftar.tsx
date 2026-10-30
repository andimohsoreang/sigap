import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { type FormEvent, type ReactNode } from 'react';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            {children}
            {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
            {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
    );
}

export default function Daftar() {
    const { data, setData, post, transform, processing, errors, reset } = useForm({
        nik: '',
        nama: '',
        email: '',
        telepon: '',
        password: '',
        password_confirmation: '',
        setuju: false as boolean,
        recaptcha_token: '',
    });
    const recaptcha = useRecaptcha('daftar');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void recaptcha.withToken((token) => {
            transform((form) => ({ ...form, recaptcha_token: token }));
            post('/daftar', { onFinish: () => reset('password', 'password_confirmation') });
        });
    };
    const busy = processing || recaptcha.verifying;

    return (
        <PublicLayout title="Daftar Akun Warga">
            <Head title="Daftar Akun Warga — Contact Center" />

            <div className="mx-auto flex max-w-lg flex-col px-4 py-12 sm:px-6">
                <Card className="border-gray-100 shadow-lg">
                    <CardContent className="p-8">
                        <div className="mb-6 text-center">
                            <h1 className="text-primary text-2xl font-bold">Daftar Akun Warga</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Dengan akun, semua pengaduan Anda tersimpan di Portal Warga dan Anda menerima kabar perkembangannya lewat email.
                            </p>
                        </div>

                        <form onSubmit={submit} className="space-y-5">
                            <Field
                                id="nik"
                                label="NIK (KTP) *"
                                error={errors.nik}
                                hint="16 digit angka. NIK dipakai untuk masuk dan disimpan terenkripsi."
                            >
                                <Input
                                    id="nik"
                                    inputMode="numeric"
                                    maxLength={16}
                                    value={data.nik}
                                    onChange={(e) => setData('nik', e.target.value.replace(/\D/g, ''))}
                                    autoComplete="username"
                                    required
                                />
                            </Field>

                            <Field id="nama" label="Nama Lengkap *" error={errors.nama}>
                                <Input id="nama" value={data.nama} onChange={(e) => setData('nama', e.target.value)} autoComplete="name" required />
                            </Field>

                            <Field id="email" label="Email *" error={errors.email} hint="Kami kirim tautan verifikasi ke email ini.">
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </Field>

                            <Field id="telepon" label="No. Telepon / WA" error={errors.telepon}>
                                <Input
                                    id="telepon"
                                    type="tel"
                                    placeholder="08xx-xxxx-xxxx"
                                    value={data.telepon}
                                    onChange={(e) => setData('telepon', e.target.value)}
                                    autoComplete="tel"
                                />
                            </Field>

                            <Field id="password" label="Kata Sandi *" error={errors.password} hint="Minimal 8 karakter, berisi huruf dan angka.">
                                <Input
                                    id="password"
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </Field>

                            <Field id="password_confirmation" label="Ulangi Kata Sandi *" error={errors.password_confirmation}>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </Field>

                            <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? errors.recaptcha_token} />

                            <div>
                                <label className="flex items-start gap-3 text-sm text-gray-600">
                                    <Checkbox
                                        aria-label="Setuju syarat dan kebijakan privasi"
                                        checked={data.setuju}
                                        onCheckedChange={(v) => setData('setuju', Boolean(v))}
                                        className="mt-0.5"
                                    />
                                    <span>
                                        Saya menyetujui{' '}
                                        <Link href="/syarat-ketentuan" className="text-brand-light font-bold hover:underline">
                                            Syarat &amp; Ketentuan
                                        </Link>{' '}
                                        serta{' '}
                                        <Link href="/kebijakan-privasi" className="text-brand-light font-bold hover:underline">
                                            Kebijakan Privasi
                                        </Link>{' '}
                                        Contact Center.
                                    </span>
                                </label>
                                {errors.setuju && <p className="text-destructive mt-1 text-sm">{errors.setuju}</p>}
                            </div>

                            <Button type="submit" disabled={busy || !data.setuju} className="w-full">
                                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                Daftar
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500">
                            Sudah punya akun?{' '}
                            <Link href="/masuk" className="text-brand-light font-bold hover:underline">
                                Masuk
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}
