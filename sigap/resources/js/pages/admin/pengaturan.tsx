import { router, useForm, usePage } from '@inertiajs/react';
import { Bell, ListChecks, Plus, Save, Settings2, Timer, Trash2, UserCog } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type SharedData } from '@/types';

interface Props {
    settings: {
        sla_response_minutes: number;
        ews_enabled: boolean;
        auto_disposition: boolean;
        notification: { pic_email: string | null; pic_phone: string | null };
    };
    categories: { id: number; name: string; slug: string; sla_days: number | null }[];
}

export default function Pengaturan({ settings, categories }: Props) {
    const { auth } = usePage<SharedData>().props;
    const [newCategory, setNewCategory] = useState('');

    // SLA + EWS
    const sla = useForm({
        sla_response_minutes: String(settings.sla_response_minutes),
        ews_enabled: settings.ews_enabled,
        auto_disposition: settings.auto_disposition,
    });

    // Profil
    const profil = useForm({ name: auth?.user?.name ?? '', password: '' });

    // Notifikasi internal
    const notif = useForm({
        'notification[pic_email]': settings.notification.pic_email ?? '',
        'notification[pic_phone]': settings.notification.pic_phone ?? '',
    });

    const submitSla = (e: FormEvent) => {
        e.preventDefault();
        sla.put('/admin/pengaturan', { preserveScroll: true });
    };

    const submitProfil = (e: FormEvent) => {
        e.preventDefault();
        // Profil admin: nama + kata sandi (memakai endpoint warga? tidak — khusus admin).
        router.put('/admin/pengaturan', { name: profil.data.name, ...(profil.data.password ? { password: profil.data.password } : {}) }, { preserveScroll: true });
    };

    const submitNotif = (e: FormEvent) => {
        e.preventDefault();
        notif.put('/admin/pengaturan', { preserveScroll: true });
    };

    const addCategory = () => {
        if (!newCategory.trim()) return;
        router.post('/admin/kategori', { name: newCategory }, { preserveScroll: true, onSuccess: () => setNewCategory('') });
    };

    return (
        <AdminLayout title="Pengaturan & Preferensi" subtitle="Profil, SLA/EWS, kategori, dan notifikasi.">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Profil */}
                <Card className="border-gray-200 dark:border-gray-700 dark:bg-dark-card">
                    <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-white">
                            <UserCog className="h-5 w-5 text-brand-light" /> Profil Admin
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={submitProfil} className="space-y-4">
                            <Field label="Nama Lengkap">
                                <Input value={profil.data.name} onChange={(e) => profil.setData('name', e.target.value)} />
                            </Field>
                            <Field label="Kata Sandi Baru">
                                <Input type="password" value={profil.data.password} onChange={(e) => profil.setData('password', e.target.value)} placeholder="Kosongkan jika tidak ingin diubah" />
                            </Field>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={profil.processing}>
                                    <Save className="h-4 w-4" /> Simpan Profil
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* SLA & EWS */}
                <Card className="border-gray-200 dark:border-gray-700 dark:bg-dark-card">
                    <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-white">
                            <Timer className="h-5 w-5 text-brand-light" /> Konfigurasi SLA &amp; EWS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={submitSla} className="space-y-4">
                            <Field label="Batas Waktu Respon Awal (Menit)">
                                <Input type="number" value={sla.data.sla_response_minutes} onChange={(e) => sla.setData('sla_response_minutes', e.target.value)} />
                            </Field>
                            <ToggleRow label="Aktifkan Peringatan EWS" checked={sla.data.ews_enabled} onChange={(v) => sla.setData('ews_enabled', v)} />
                            <ToggleRow label="Otomatisasi Disposisi Tiket" checked={sla.data.auto_disposition} onChange={(v) => sla.setData('auto_disposition', v)} />
                            <div className="flex justify-end">
                                <Button type="submit" disabled={sla.processing}>
                                    <Save className="h-4 w-4" /> Simpan Sistem
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Kategori */}
                <Card className="border-gray-200 dark:border-gray-700 dark:bg-dark-card">
                    <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-white">
                            <ListChecks className="h-5 w-5 text-brand-light" /> Manajemen Kategori Laporan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="mb-4 flex gap-2">
                            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())} placeholder="Tambah kategori baru..." />
                            <Button type="button" onClick={addCategory} className="shrink-0">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                            {categories.map((c) => (
                                <div key={c.id} className="flex items-center justify-between rounded border border-gray-100 bg-white p-2 text-xs font-bold text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                    <span>{c.name}</span>
                                    <button onClick={() => router.delete(`/admin/kategori/${c.id}`, { preserveScroll: true })} className="px-2 text-red-500 hover:text-red-700" title="Hapus kategori">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Notifikasi internal */}
                <Card className="border-gray-200 dark:border-gray-700 dark:bg-dark-card">
                    <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-white">
                            <Bell className="h-5 w-5 text-orange-500" /> Notifikasi Tiket Internal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">Tujuan notifikasi saat pegawai mengirim laporan gangguan sarana &amp; TIK.</p>
                        <form onSubmit={submitNotif} className="space-y-4">
                            <Field label="Email PIC Biro Umum & TIK">
                                <Input type="email" value={notif.data['notification[pic_email]']} onChange={(e) => notif.setData('notification[pic_email]', e.target.value)} placeholder="it-support@kemenatrans.go.id" />
                            </Field>
                            <Field label="No. WhatsApp PIC (Eskalasi Kritis)">
                                <Input value={notif.data['notification[pic_phone]']} onChange={(e) => notif.setData('notification[pic_phone]', e.target.value)} placeholder="081234567890" />
                            </Field>
                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 opacity-60 dark:border-gray-700">
                                <Checkbox checked={false} disabled />
                                <div>
                                    <p className="text-xs font-bold text-gray-800 dark:text-white">Kirim WhatsApp otomatis untuk urgensi Kritis</p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Belum diaktifkan (PRD D10). Notifikasi hanya lewat email &amp; in-app.</p>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={notif.processing} className="bg-orange-500 hover:bg-orange-600">
                                    <Save className="h-4 w-4" /> Simpan Notifikasi
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
                <Settings2 className="h-4 w-4" /> Pengaturan disimpan pada tabel <code>settings</code> dan langsung berlaku pada perhitungan SLA.
            </div>
        </AdminLayout>
    );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
            <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
            <span className="text-xs font-bold text-gray-800 dark:text-white">{label}</span>
        </label>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600 dark:text-gray-400">{label}</Label>
            {children}
        </div>
    );
}