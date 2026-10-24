import { askSigap } from '@/components/sigap/live-chat-widget';
import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { KeyRound, LoaderCircle, MessagesSquare } from 'lucide-react';
import { type FormEvent } from 'react';

export default function LupaSandi({ status }: { status?: string | null }) {
    const { data, setData, post, transform, processing, errors } = useForm({ identifier: '', recaptcha_token: '' });
    const recaptcha = useRecaptcha('lupa_sandi');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void recaptcha.withToken((token) => {
            transform((form) => ({ ...form, recaptcha_token: token }));
            post('/lupa-sandi');
        });
    };
    const busy = processing || recaptcha.verifying;

    return (
        <PublicLayout title="Lupa Kata Sandi">
            <Head title="Lupa Kata Sandi — SIGAP" />

            <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
                <Card className="border-gray-100 shadow-lg">
                    <CardContent className="p-8">
                        <div className="mb-6 text-center">
                            <h1 className="text-primary text-2xl font-bold">Lupa Kata Sandi</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Isi NIK atau email akun warga Anda. Kami kirim tautan untuk membuat kata sandi baru ke email akun.
                            </p>
                        </div>

                        {status && (
                            <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{status}</p>
                        )}

                        <form onSubmit={submit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="identifier">NIK atau Email</Label>
                                <Input
                                    id="identifier"
                                    value={data.identifier}
                                    onChange={(e) => setData('identifier', e.target.value)}
                                    autoComplete="username"
                                    required
                                />
                                {errors.identifier && <p className="text-destructive text-sm">{errors.identifier}</p>}
                            </div>

                            <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? errors.recaptcha_token} />

                            <Button type="submit" disabled={busy} className="w-full">
                                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                Kirim tautan
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500">
                            Ingat kata sandi?{' '}
                            <Link href="/masuk" className="text-brand-light font-bold hover:underline">
                                Masuk
                            </Link>
                        </p>
                        <div className="mt-6 rounded-lg bg-gray-50 px-4 py-3 text-center text-sm text-gray-600">
                            Tidak punya email, atau emailnya sudah tidak aktif?
                            <button
                                type="button"
                                onClick={() => askSigap('Saya lupa kata sandi dan tidak punya email')}
                                className="text-brand-light mt-1 flex w-full items-center justify-center gap-1.5 font-bold hover:underline"
                            >
                                <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Minta bantuan petugas lewat chat
                            </button>
                        </div>
                        <p className="mt-2 text-center text-xs text-gray-500">Petugas yang lupa kata sandi: hubungi Super Admin.</p>
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}
