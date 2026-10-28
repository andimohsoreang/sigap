import { useForm } from '@inertiajs/react';
import { AtSign, Building2, Link2, Megaphone, Plus, Save, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode } from 'react';

import { PLATFORMS, type KanalPublik, type KanalTautan, type SosmedPlatform } from '@/components/sigap/kanal-resmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Admin → Pengaturan: kanal resmi yang tampil di beranda (strip + modal) dan
 * Katalog (setting `kanal_publik`, lihat App\Services\PublicChannels).
 */

type Form = Omit<KanalPublik, 'kantor'> & {
    kantor: Omit<KanalPublik['kantor'], 'lat' | 'lng'> & { lat: number | string | null; lng: number | string | null };
};

const LINKS: { key: 'lapor' | 'kpk' | 'internal'; hint: string }[] = [
    { key: 'lapor', hint: 'https://sp4n.lapor.go.id/…' },
    { key: 'kpk', hint: 'https://kws.kpk.go.id/' },
    { key: 'internal', hint: 'https://… atau /pengaduan/internal' },
];

const selectClass = 'focus:border-primary h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm outline-none disabled:opacity-60';

export default function KanalPublikForm({ initial, canEdit }: { initial: KanalPublik; canEdit: boolean }) {
    const form = useForm<Form>(initial);
    const { data, errors } = form;
    const err = (key: string) => (errors as Record<string, string | undefined>)[key];

    const set = <K extends keyof Form>(key: K, patch: Partial<Form[K]>) => form.setData((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

    const setAkun = (i: number, patch: Partial<Form['sosmed']['akun'][number]>) =>
        set('sosmed', { akun: data.sosmed.akun.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put('/admin/pengaturan/kanal-publik', { preserveScroll: true });
    };

    return (
        <Card className="border-gray-200 lg:col-span-2">
            <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                    <Megaphone className="text-brand-light h-5 w-5" /> Kanal Resmi di Beranda &amp; Katalog
                </CardTitle>
                <p className="text-xs text-gray-500">
                    Tampil di strip &ldquo;kanal pengaduan resmi lainnya&rdquo; di beranda dan bagian Kanal resmi di Katalog. Kanal yang tidak
                    dicentang &ldquo;Tampilkan&rdquo; disembunyikan dari keduanya.
                </p>
            </CardHeader>
            <CardContent className="p-6">
                <form onSubmit={submit} className="space-y-6">
                    <fieldset disabled={!canEdit} className="space-y-6">
                        {/* Social Media */}
                        <Section
                            icon={AtSign}
                            title="Social Media"
                            desc="Membuka daftar akun, email, dan Hotline WhatsApp."
                            aktif={data.sosmed.aktif}
                            onAktif={(v) => set('sosmed', { aktif: v })}
                            disabled={!canEdit}
                        >
                            <div className="grid gap-4 lg:grid-cols-3">
                                <Field label="Label tombol" error={err('sosmed.label')}>
                                    <Input value={data.sosmed.label} onChange={(e) => set('sosmed', { label: e.target.value })} />
                                </Field>
                                <Field label="Email" error={err('sosmed.email')}>
                                    <Input
                                        type="email"
                                        value={data.sosmed.email ?? ''}
                                        onChange={(e) => set('sosmed', { email: e.target.value || null })}
                                    />
                                </Field>
                                <Field label="Hotline WhatsApp" error={err('sosmed.whatsapp')}>
                                    <Input
                                        value={data.sosmed.whatsapp ?? ''}
                                        onChange={(e) => set('sosmed', { whatsapp: e.target.value || null })}
                                        placeholder="0812-xxxx-xxxx"
                                    />
                                </Field>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-600">Akun media sosial</Label>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <div className="hidden grid-cols-[150px_220px_1fr_40px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-bold tracking-wide text-gray-500 uppercase lg:grid">
                                        <span>Platform</span>
                                        <span>Nama akun</span>
                                        <span>URL</span>
                                        <span className="sr-only">Hapus</span>
                                    </div>
                                    {data.sosmed.akun.length === 0 && <p className="px-3 py-4 text-xs text-gray-400">Belum ada akun.</p>}
                                    {data.sosmed.akun.map((a, i) => {
                                        const rowError =
                                            err(`sosmed.akun.${i}.nama`) ?? err(`sosmed.akun.${i}.url`) ?? err(`sosmed.akun.${i}.platform`);
                                        return (
                                            <div key={i} className="border-b border-gray-100 px-3 py-2.5 last:border-b-0">
                                                <div className="grid grid-cols-[1fr_40px] items-center gap-2 sm:grid-cols-[140px_1fr_40px] lg:grid-cols-[150px_220px_1fr_40px] lg:gap-3">
                                                    <select
                                                        aria-label="Platform"
                                                        value={a.platform}
                                                        onChange={(e) => setAkun(i, { platform: e.target.value as SosmedPlatform })}
                                                        className={cn(selectClass, 'col-start-1 row-start-1')}
                                                    >
                                                        {Object.entries(PLATFORMS).map(([value, p]) => (
                                                            <option key={value} value={value}>
                                                                {p.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <Input
                                                        aria-label="Nama akun"
                                                        value={a.nama}
                                                        onChange={(e) => setAkun(i, { nama: e.target.value })}
                                                        placeholder="@akun"
                                                        className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                                                    />
                                                    <Input
                                                        aria-label="URL akun"
                                                        value={a.url}
                                                        onChange={(e) => setAkun(i, { url: e.target.value })}
                                                        placeholder="https://"
                                                        className="col-span-2 col-start-1 row-start-3 sm:row-start-2 lg:col-span-1 lg:col-start-3 lg:row-start-1"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => set('sosmed', { akun: data.sosmed.akun.filter((_, j) => j !== i) })}
                                                        className="col-start-2 row-start-1 flex h-9 w-9 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 sm:col-start-3 lg:col-start-4 lg:col-start-auto lg:row-start-auto"
                                                        title="Hapus akun"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                {rowError && <p className="mt-1 text-xs font-semibold text-rose-500">{rowError}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                                {data.sosmed.akun.length < 10 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => set('sosmed', { akun: [...data.sosmed.akun, { platform: 'instagram', nama: '', url: '' }] })}
                                    >
                                        <Plus className="h-4 w-4" /> Tambah akun
                                    </Button>
                                )}
                            </div>
                        </Section>

                        {/* Kantor */}
                        <Section
                            icon={Building2}
                            title="Kantor"
                            desc="Membuka alamat lengkap dan peta lokasi."
                            aktif={data.kantor.aktif}
                            onAktif={(v) => set('kantor', { aktif: v })}
                            disabled={!canEdit}
                        >
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Field label="Label tombol" error={err('kantor.label')}>
                                    <Input value={data.kantor.label} onChange={(e) => set('kantor', { label: e.target.value })} />
                                </Field>
                                <Field label="Nama kantor" error={err('kantor.nama')} className="lg:col-span-3">
                                    <Input value={data.kantor.nama} onChange={(e) => set('kantor', { nama: e.target.value })} />
                                </Field>
                                <Field label="Alamat lengkap" error={err('kantor.alamat')} className="sm:col-span-2 lg:col-span-4">
                                    <Textarea rows={2} value={data.kantor.alamat} onChange={(e) => set('kantor', { alamat: e.target.value })} />
                                </Field>
                                <Field label="Telepon" error={err('kantor.telepon')}>
                                    <Input value={data.kantor.telepon ?? ''} onChange={(e) => set('kantor', { telepon: e.target.value || null })} />
                                </Field>
                                <Field label="Jam layanan" error={err('kantor.jam')}>
                                    <Input
                                        value={data.kantor.jam ?? ''}
                                        onChange={(e) => set('kantor', { jam: e.target.value || null })}
                                        placeholder="Senin–Jumat, 08.00–16.00 WIB"
                                    />
                                </Field>
                                <Field label="Latitude" error={err('kantor.lat')}>
                                    <Input
                                        inputMode="decimal"
                                        value={data.kantor.lat ?? ''}
                                        onChange={(e) => set('kantor', { lat: e.target.value === '' ? null : e.target.value })}
                                    />
                                </Field>
                                <Field label="Longitude" error={err('kantor.lng')}>
                                    <Input
                                        inputMode="decimal"
                                        value={data.kantor.lng ?? ''}
                                        onChange={(e) => set('kantor', { lng: e.target.value === '' ? null : e.target.value })}
                                    />
                                </Field>
                            </div>
                            <p className="text-[11px] text-gray-400">
                                Koordinat untuk pin peta: di Google Maps klik kanan lokasi, lalu klik angka koordinatnya untuk menyalin. Kosongkan
                                keduanya untuk menyembunyikan peta.
                            </p>
                        </Section>

                        {/* Tautan langsung */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Link2 className="h-4 w-4 text-gray-500" />
                                <h3 className="text-sm font-bold text-gray-800">Tautan langsung</h3>
                                <span className="hidden text-xs text-gray-500 sm:inline">— langsung membuka URL saat diklik</span>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-3">
                                {LINKS.map(({ key, hint }) => (
                                    <LinkCard
                                        key={key}
                                        item={data[key]}
                                        hint={hint}
                                        onChange={(patch) => set(key, patch)}
                                        errors={{ label: err(`${key}.label`), url: err(`${key}.url`), deskripsi: err(`${key}.deskripsi`) }}
                                        disabled={!canEdit}
                                    />
                                ))}
                            </div>
                        </div>
                    </fieldset>

                    <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                        {form.recentlySuccessful && <span className="text-xs font-semibold text-emerald-600">Tersimpan.</span>}
                        <Button type="submit" disabled={!canEdit || form.processing}>
                            <Save className="h-4 w-4" /> Simpan Kanal
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function Section({
    icon: Icon,
    title,
    desc,
    aktif,
    onAktif,
    disabled,
    children,
}: {
    icon: typeof AtSign;
    title: string;
    desc: string;
    aktif: boolean;
    onAktif: (v: boolean) => void;
    disabled: boolean;
    children: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-lg border border-gray-200">
            <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-gray-500" />
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                        <p className="text-[11px] text-gray-500">{desc}</p>
                    </div>
                </div>
                <Tampilkan aktif={aktif} onAktif={onAktif} disabled={disabled} />
            </header>
            <div className={cn('space-y-4 p-4', !aktif && 'opacity-60')}>{children}</div>
        </section>
    );
}

function LinkCard({
    item,
    hint,
    onChange,
    errors,
    disabled,
}: {
    item: KanalTautan;
    hint: string;
    onChange: (patch: Partial<KanalTautan>) => void;
    errors: { label?: string; url?: string; deskripsi?: string };
    disabled: boolean;
}) {
    return (
        <section className="flex flex-col overflow-hidden rounded-lg border border-gray-200">
            <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <h4 className="truncate text-sm font-bold text-gray-800">{item.label || 'Tautan'}</h4>
                <Tampilkan aktif={item.aktif} onAktif={(v) => onChange({ aktif: v })} disabled={disabled} />
            </header>
            <div className={cn('flex flex-1 flex-col gap-4 p-4', !item.aktif && 'opacity-60')}>
                <Field label="Label tombol" error={errors.label}>
                    <Input value={item.label} onChange={(e) => onChange({ label: e.target.value })} />
                </Field>
                <Field label="URL" error={errors.url}>
                    <Input value={item.url ?? ''} onChange={(e) => onChange({ url: e.target.value || null })} placeholder={hint} />
                </Field>
                <Field label="Deskripsi di Katalog" error={errors.deskripsi} className="flex flex-1 flex-col">
                    <Textarea
                        rows={4}
                        value={item.deskripsi ?? ''}
                        onChange={(e) => onChange({ deskripsi: e.target.value || null })}
                        className="flex-1 resize-none"
                    />
                </Field>
            </div>
        </section>
    );
}

function Tampilkan({ aktif, onAktif, disabled }: { aktif: boolean; onAktif: (v: boolean) => void; disabled: boolean }) {
    return (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-gray-600 has-[:disabled]:cursor-not-allowed">
            <Checkbox checked={aktif} disabled={disabled} onCheckedChange={(v) => onAktif(Boolean(v))} /> Tampilkan
        </label>
    );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: ReactNode }) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label className="text-xs font-bold text-gray-600">{label}</Label>
            {children}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}
