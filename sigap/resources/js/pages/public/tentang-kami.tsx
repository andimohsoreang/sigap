import { Card, CardContent } from '@/components/ui/card';
import { Head } from '@inertiajs/react';
import { Building2, Mail, Phone } from 'lucide-react';
import StaticShell, { Section } from './static-shell';

export default function TentangKami() {
    return (
        <StaticShell title="Tentang Kami" subtitle="Mengenal Contact Center dan unit pengelola layanan pengaduan">
            <Head title="Tentang Kami — Contact Center" />

            <Section title="Sekilas Contact Center">
                <p>
                    <strong>Contact Center Kementerian Transmigrasi</strong> adalah sistem pengaduan pelayanan publik milik Kementerian Transmigrasi
                    Republik Indonesia yang mengelola laporan warga terkait kawasan dan program transmigrasi di seluruh Indonesia, terintegrasi dengan
                    SP4N-LAPOR!.
                </p>
            </Section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card className="border-gray-100">
                    <CardContent className="p-6">
                        <h2 className="text-primary mb-2 text-lg font-bold">Visi</h2>
                        <p className="text-sm text-gray-600">
                            Mewujudkan layanan pengaduan masyarakat yang cepat, transparan, dan akuntabel di seluruh kawasan transmigrasi Indonesia.
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-gray-100">
                    <CardContent className="p-6">
                        <h2 className="text-primary mb-2 text-lg font-bold">Misi</h2>
                        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                            <li>Mempermudah akses pelaporan lewat 5 kanal resmi;</li>
                            <li>Menjamin tindak lanjut sesuai standar waktu layanan;</li>
                            <li>Melindungi kerahasiaan data pelapor sesuai UU PDP.</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <Section title="Unit Pengelola">
                <p>
                    Contact Center dikelola oleh Unit Pelayanan Pengaduan Masyarakat pada Biro Hubungan Masyarakat dan Layanan Informasi, Kementerian
                    Transmigrasi Republik Indonesia, bekerja sama dengan Admin Kawasan di setiap satuan permukiman transmigrasi.
                </p>
            </Section>

            <Section title="Kontak Resmi">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="flex items-start gap-3 text-sm">
                        <Mail className="text-brand-light mt-0.5 h-4 w-4 shrink-0" />
                        <span>biro.umum@kemenatrans.go.id</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                        <Phone className="text-brand-light mt-0.5 h-4 w-4 shrink-0" />
                        <span>Call Center: 1500-XXX · Senin–Jumat, 08.00–16.00 WIB</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                        <Building2 className="text-brand-light mt-0.5 h-4 w-4 shrink-0" />
                        <span>Gedung Kementerian Transmigrasi RI, Jakarta, Indonesia</span>
                    </div>
                </div>
            </Section>
        </StaticShell>
    );
}
