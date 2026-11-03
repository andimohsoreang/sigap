import { Head } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import StaticShell, { Section } from './static-shell';

const ALUR = [
    ['Ajukan', 'Warga mengirim aduan lewat salah satu dari 5 kanal resmi.'],
    ['Verifikasi', 'Agen Contact Center memeriksa kelengkapan & kategori aduan.'],
    ['Disposisi', 'Aduan diteruskan ke admin kawasan/unit terkait.'],
    ['Ditindaklanjuti', 'Progres dapat dipantau berkala melalui Lacak Tiket.'],
    ['Selesai', 'Notifikasi hasil dikirim ke pelapor.'],
];

const KANAL = ['Portal Web Contact Center', 'PPID & Inspektorat Jenderal', 'SP4N-LAPOR!', 'Media Sosial', 'Loket Kantor'];

const SLA = [
    ['Darurat / Keselamatan', 'Maks. 1 x 24 jam', '3 hari kerja'],
    ['Prioritas', 'Maks. 3 x 24 jam', '7 hari kerja'],
    ['Umum', 'Maks. 5 hari kerja', '14 hari kerja'],
];

export default function PedomanLayanan() {
    return (
        <StaticShell
            eyebrow="Pedoman Layanan"
            pose="menunjuk"
            title="Pedoman Layanan Contact Center"
            subtitle="Panduan resmi alur, kanal, dan standar waktu penanganan pengaduan masyarakat"
        >
            <Head title="Pedoman Layanan — Contact Center" />

            <Section title="Alur Penanganan Pengaduan">
                <ol className="space-y-4">
                    {ALUR.map(([step, desc], idx) => (
                        <li key={step} className="flex gap-4">
                            <span className="font-heading flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tcd-primary,var(--t-deep))] font-bold text-white">
                                {idx + 1}
                            </span>
                            <div>
                                <p className="font-semibold text-[var(--tcd-heading,var(--t-deep))]">{step}</p>
                                <p className="text-sm">{desc}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </Section>

            <Section title="Kanal Pengaduan Resmi">
                <p>Contact Center menyediakan 5 kanal resmi berikut. Laporan di luar kanal ini tidak dapat dijamin diproses.</p>
                <div className="flex flex-wrap gap-3">
                    {KANAL.map((k) => (
                        <span
                            key={k}
                            className="rounded-full border border-[var(--tcd-border-warm,#e6ded1)] bg-[var(--tcd-cream,#f7f3ee)] px-4 py-2 text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]"
                        >
                            {k}
                        </span>
                    ))}
                </div>
            </Section>

            <Section title="Standar Waktu Layanan (SLA)">
                <div
                    className="overflow-x-auto rounded-[20px] border border-[var(--tcd-border,#e6ebf0)]"
                    tabIndex={0}
                    role="region"
                    aria-label="Tabel standar waktu layanan"
                >
                    <table className="w-full min-w-[520px] text-[15px]">
                        <thead className="bg-[var(--tcd-muted,#f6f8fa)]">
                            <tr>
                                <th className="px-5 py-3 text-left font-semibold text-[var(--tcd-heading,var(--t-deep))]">Kategori Aduan</th>
                                <th className="px-5 py-3 text-left font-semibold text-[var(--tcd-heading,var(--t-deep))]">Target Respons Awal</th>
                                <th className="px-5 py-3 text-left font-semibold text-[var(--tcd-heading,var(--t-deep))]">Target Penyelesaian</th>
                            </tr>
                        </thead>
                        <tbody>
                            {SLA.map(([kat, resp, done]) => (
                                <tr key={kat} className="border-t border-[var(--tcd-border,#e6ebf0)]">
                                    <td className="px-5 py-3 font-semibold text-[var(--tcd-heading,var(--t-deep))]">{kat}</td>
                                    <td className="px-5 py-3">{resp}</td>
                                    <td className="px-5 py-3">{done}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm">
                    Target waktu bersifat estimasi terbaik (best-effort) dan dapat berubah untuk kasus yang memerlukan koordinasi lintas instansi.
                    Jika SLA terlewati, laporan dapat dieskalasi melalui Call Center.
                </p>
            </Section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 [&>section]:rounded-[20px] [&>section]:border [&>section]:border-[var(--tcd-border,#e6ebf0)] [&>section]:p-6">
                <Section title="Hak Pelapor">
                    <ul className="space-y-2">
                        {[
                            'Mendapat nomor tiket dan status yang dapat dilacak.',
                            'Memilih klasifikasi laporan Anonim atau Rahasia.',
                            'Menerima notifikasi tindak lanjut sesuai SLA.',
                            'Mengajukan eskalasi bila tidak ada respons.',
                        ].map((h) => (
                            <li key={h} className="flex gap-2 text-sm">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tcd-success,#047857)]" /> {h}
                            </li>
                        ))}
                    </ul>
                </Section>
                <Section title="Kewajiban Pelapor">
                    <ul className="space-y-2">
                        {[
                            'Memberikan informasi yang benar dan dapat dipertanggungjawabkan.',
                            'Melampirkan bukti pendukung bila tersedia.',
                            'Tidak menyalahgunakan sistem untuk laporan palsu atau fitnah.',
                            'Menjaga kerahasiaan nomor tiket miliknya.',
                        ].map((h) => (
                            <li key={h} className="flex gap-2 text-sm">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tcd-link,var(--t-navy))]" /> {h}
                            </li>
                        ))}
                    </ul>
                </Section>
            </div>
        </StaticShell>
    );
}
