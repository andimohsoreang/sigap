import { useForm } from '@inertiajs/react';
import { Megaphone, Plus, Save, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode } from 'react';

import { PLATFORMS, type KanalPublik, type KanalTautan, type SosmedPlatform } from '@/components/sigap/kanal-resmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Admin → Pengaturan: strip "kanal pengaduan resmi lainnya" di beranda
 * publik (setting `kanal_publik`, lihat App\Services\PublicChannels).
 */

type Form = Omit<KanalPublik, 'kantor'> & {
    kantor: Omit<KanalPublik['kantor'], 'lat' | 'lng'> & { lat: number | string | null; lng: number | string | null };
};

const LINKS: { key: 'lapor' | 'kpk' | 'internal'; hint: string }[] = [
    { key: 'lapor', hint: 'Contoh: https://sp4n.lapor.go.id/…' },
    { key: 'kpk', hint: 'Contoh: https://kws.kpk.go.id/' },
    { key: 'internal', hint: 'URL penuh atau path internal, mis. /pengaduan/internal' },
];

const selectClass = 'focus:border-primary h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm outline-none';

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
                    <Megaphone className="text-brand-light h-5 w-5" /> Kanal Resmi di Beranda Publik
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <p className="mb-5 text-xs text-gray-500">
                    Strip &ldquo;kanal pengaduan resmi lainnya&rdquo; di beranda. Social Media dan Kantor membuka jendela info; kanal lain langsung
                    membuka URL. Kanal yang dinonaktifkan disembunyikan dan jumlahnya ikut menyesuaikan.
                </p>
                <form onSubmit={submit}>
                    <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Social Media */}
                        <Section title="Social Media" aktif={data.sosmed.aktif} onAktif={(v) => set('sosmed', { aktif: v })} disabled={!canEdit}>
                            <Field label="Label tombol" error={err('sosmed.label')}>
                                <Input value={data.sosmed.label} onChange={(e) => set('sosmed', { label: e.target.value })} />
                            </Field>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-600">Akun media sosial</Label>
                                {data.sosmed.akun.map((a, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="grid grid-cols-[110px_1fr_auto] gap-2">
                                            <select
                                                aria-label="Platform"
                                                value={a.platform}
                                                onChange={(e) => setAkun(i, { platform: e.target.value as SosmedPlatform })}
                                                className={selectClass}
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
                                            />
                                            <button
                                                type="button"
                                                onClick={() => set('sosmed', { akun: data.sosmed.akun.filter((_, j) => j !== i) })}
                                                className="px-2 text-red-500 hover:text-red-700 disabled:opacity-40"
                                                title="Hapus akun"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <Input
                                            aria-label="URL akun"
                                            value={a.url}
                                            onChange={(e) => setAkun(i, { url: e.target.value })}
                                            placeholder="https://"
                                        />
                                        {(err(`sosmed.akun.${i}.nama`) || err(`sosmed.akun.${i}.url`)) && (
                                            <p className="text-xs font-semibold text-rose-500">
                                                {err(`sosmed.akun.${i}.nama`) ?? err(`sosmed.akun.${i}.url`)}
                                            </p>
                                        )}
                                    </div>
                                ))}
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
                        </Section>

                        <div className="space-y-6">
                            {/* Kantor */}
                            <Section title="Kantor" aktif={data.kantor.aktif} onAktif={(v) => set('kantor', { aktif: v })} disabled={!canEdit}>
                                <Field label="Label tombol" error={err('kantor.label')}>
                                    <Input value={data.kantor.label} onChange={(e) => set('kantor', { label: e.target.value })} />
                                </Field>
                                <Field label="Nama kantor" error={err('kantor.nama')}>
                                    <Input value={data.kantor.nama} onChange={(e) => set('kantor', { nama: e.target.value })} />
                                </Field>
                                <Field label="Alamat lengkap" error={err('kantor.alamat')}>
                                    <Textarea rows={3} value={data.kantor.alamat} onChange={(e) => set('kantor', { alamat: e.target.value })} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Telepon" error={err('kantor.telepon')}>
                                        <Input
                                            value={data.kantor.telepon ?? ''}
                                            onChange={(e) => set('kantor', { telepon: e.target.value || null })}
                                        />
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
                                    Koordinat untuk pin peta; salin dari Google Maps (klik kanan pada lokasi). Kosongkan keduanya untuk menyembunyikan
                                    peta.
                                </p>
                            </Section>

                            {/* Tautan langsung */}
                            {LINKS.map(({ key, hint }) => (
                                <LinkSection
                                    key={key}
                                    item={data[key]}
                                    hint={hint}
                                    onChange={(patch) => set(key, patch)}
                                    errors={{ label: err(`${key}.label`), url: err(`${key}.url`) }}
                                    disabled={!canEdit}
                                />
                            ))}
                        </div>
                    </fieldset>
                    <div className="mt-6 flex justify-end">
                        <Button type="submit" disabled={!canEdit || form.processing}>
                            <Save className="h-4 w-4" /> Simpan Kanal Beranda
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function Section({
    title,
    aktif,
    onAktif,
    disabled,
    children,
}: {
    title: string;
    aktif: boolean;
    onAktif: (v: boolean) => void;
    disabled: boolean;
    children?: ReactNode;
}) {
    return (
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-600 has-[:disabled]:cursor-not-allowed">
                    <Checkbox checked={aktif} disabled={disabled} onCheckedChange={(v) => onAktif(Boolean(v))} /> Tampilkan
                </label>
            </div>
            {children}
        </div>
    );
}

function LinkSection({
    item,
    hint,
    onChange,
    errors,
    disabled,
}: {
    item: KanalTautan;
    hint: string;
    onChange: (patch: Partial<KanalTautan>) => void;
    errors: { label?: string; url?: string };
    disabled: boolean;
}) {
    return (
        <Section title={item.label || 'Tautan'} aktif={item.aktif} onAktif={(v) => onChange({ aktif: v })} disabled={disabled}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                <Field label="Label tombol" error={errors.label}>
                    <Input value={item.label} onChange={(e) => onChange({ label: e.target.value })} />
                </Field>
                <Field label="URL" error={errors.url}>
                    <Input value={item.url ?? ''} onChange={(e) => onChange({ url: e.target.value || null })} placeholder={hint} />
                </Field>
            </div>
        </Section>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{label}</Label>
            {children}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}
