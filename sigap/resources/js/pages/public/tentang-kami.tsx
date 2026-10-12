import { Head } from '@inertiajs/react';
import { Building2, Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import StaticShell, { Section } from './static-shell';

export default function TentangKami() {
    return (
        <StaticShell title="Tentang Kami" subtitle="Mengenal SIGAP dan unit pengelola layanan pengaduan">
            <Head title="Tentang Kami — SIGAP" />

            <Section title="Sekilas SIGAP">
                <p>
                    <strong>SIGAP</strong> — Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas — adalah sistem pengaduan pelayanan publik milik Kementerian
                    Transmigrasi Republik Indonesia yang mengelola laporan warga terkait kawasan dan program transmigrasi di seluruh Indonesia, terintegrasi dengan
                    SP4N-LAPOR!.
                </p>
            </Section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card className="border-gray-100 dark:border-gray-800 dark:bg-dark-card">
                    <CardContent className="p-6">
                        <h2 className="mb-2 text-lg font-bold text-primary dark:text-brand-light">Visi</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Mewujudkan layanan pengaduan masyarakat yang cepat, transparan, dan akuntabel di seluruh kawasan transmigrasi Indonesia.
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-gray-100 dark:border-gray-800 dark:bg-dark-card">
                    <CardContent className="p-6">
                        <h2 className="mb-2 text-lg font-bold text-primary dark:text-brand-light">Misi</h2>
                        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <li>Mempermudah akses pelaporan lewat 5 kanal resmi;</li>
                            <li>Menjamin tindak lanjut sesuai standar waktu layanan;</li>
                            <li>Melindungi kerahasiaan data pelapor sesuai UU PDP.</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <Section title="Unit Pengelola">
                <p>
                    SIGAP dikelola oleh Unit Pelayanan Pengaduan Masyarakat pada Biro Hubungan Masyarakat dan Layanan Informasi, Kementerian Transmigrasi Republik
                    Indonesia, bekerja sama dengan Admin Kawasan di setiap satuan permukiman transmigrasi.
                </p>
            </Section>

            <Section title="Kontak Resmi">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="flex items-start gap-3 text-sm">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                        <span>biro.umum@kemenatrans.go.id</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                        <span>Call Center: 1500-XXX · Senin–Jumat, 08.00–16.00 WIB</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                        <span>Gedung Kementerian Transmigrasi RI, Jakarta, Indonesia</span>
                    </div>
                </div>
            </Section>
        </StaticShell>
    );
}