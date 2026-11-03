import { Head } from '@inertiajs/react';
import { Building2, Mail, Phone } from 'lucide-react';
import StaticShell, { Section, staticCard } from './static-shell';

export default function TentangKami() {
    return (
        <StaticShell
            eyebrow="Tentang Kami"
            pose="menyapa"
            title="Tentang Kami"
            subtitle="Mengenal Contact Center dan unit pengelola layanan pengaduan"
        >
            <Head title="Tentang Kami — Contact Center" />

            <Section title="Sekilas Contact Center">
                <p>
                    <strong>Contact Center Kementerian Transmigrasi</strong> adalah sistem pengaduan pelayanan publik milik Kementerian Transmigrasi
                    Republik Indonesia yang mengelola laporan warga terkait kawasan dan program transmigrasi di seluruh Indonesia, terintegrasi dengan
                    SP4N-LAPOR!.
                </p>
            </Section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className={staticCard}>
                    <h3 className="font-heading mb-2 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">Visi</h3>
                    <p className="text-[15px] leading-relaxed text-[var(--tcd-text-2,#4a5868)]">
                        Mewujudkan layanan pengaduan masyarakat yang cepat, transparan, dan akuntabel di seluruh kawasan transmigrasi Indonesia.
                    </p>
                </div>
                <div className={staticCard}>
                    <h3 className="font-heading mb-2 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">Misi</h3>
                    <ul className="list-inside list-disc space-y-1 text-[15px] leading-relaxed text-[var(--tcd-text-2,#4a5868)]">
                        <li>Mempermudah akses pelaporan lewat 5 kanal resmi;</li>
                        <li>Menjamin tindak lanjut sesuai standar waktu layanan;</li>
                        <li>Melindungi kerahasiaan data pelapor sesuai UU PDP.</li>
                    </ul>
                </div>
            </div>

            <Section title="Unit Pengelola">
                <p>
                    Contact Center dikelola oleh Unit Pelayanan Pengaduan Masyarakat pada Biro Hubungan Masyarakat dan Layanan Informasi, Kementerian
                    Transmigrasi Republik Indonesia, bekerja sama dengan Admin Kawasan di setiap satuan permukiman transmigrasi.
                </p>
            </Section>

            <Section title="Kontak Resmi">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className={`${staticCard} flex items-start gap-3 p-5 text-[15px]`}>
                        <Mail className="mt-1 h-4 w-4 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                        <span>biro.umum@kemenatrans.go.id</span>
                    </div>
                    <div className={`${staticCard} flex items-start gap-3 p-5 text-[15px]`}>
                        <Phone className="mt-1 h-4 w-4 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                        <span>Call Center: 1500-XXX · Senin–Jumat, 08.00–16.00 WIB</span>
                    </div>
                    <div className={`${staticCard} flex items-start gap-3 p-5 text-[15px]`}>
                        <Building2 className="mt-1 h-4 w-4 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                        <span>Gedung Kementerian Transmigrasi RI, Jakarta, Indonesia</span>
                    </div>
                </div>
            </Section>
        </StaticShell>
    );
}
