import { Card, CardContent } from '@/components/ui/card';
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
        <StaticShell title="Pedoman Layanan Contact Center" subtitle="Panduan resmi alur, kanal, dan standar waktu penanganan pengaduan masyarakat">
            <Head title="Pedoman Layanan — Contact Center" />

            <Section title="Alur Penanganan Pengaduan">
                <ol className="space-y-4">
                    {ALUR.map(([step, desc], idx) => (
                        <li key={step} className="flex gap-4">
                            <span className="bg-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white">
                                {idx + 1}
                            </span>
                            <div>
                                <p className="font-bold text-gray-800">{step}</p>
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
                        <span key={k} className="border-secondary/60 text-primary rounded-full border bg-white px-4 py-2 text-sm font-medium">
                            {k}
                        </span>
                    ))}
                </div>
            </Section>

            <Section title="Standar Waktu Layanan (SLA)">
                <Card className="overflow-hidden border-gray-100">
                    <CardContent className="overflow-x-auto p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold text-gray-600">Kategori Aduan</th>
                                    <th className="px-5 py-3 text-left font-bold text-gray-600">Target Respons Awal</th>
                                    <th className="px-5 py-3 text-left font-bold text-gray-600">Target Penyelesaian</th>
                                </tr>
                            </thead>
                            <tbody>
                                {SLA.map(([kat, resp, done]) => (
                                    <tr key={kat} className="border-t border-gray-50">
                                        <td className="px-5 py-3 font-semibold text-gray-800">{kat}</td>
                                        <td className="px-5 py-3 text-gray-600">{resp}</td>
                                        <td className="px-5 py-3 text-gray-600">{done}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
                <p className="text-sm">
                    Target waktu bersifat estimasi terbaik (best-effort) dan dapat berubah untuk kasus yang memerlukan koordinasi lintas instansi.
                    Jika SLA terlewati, laporan dapat dieskalasi melalui Call Center.
                </p>
            </Section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Section title="Hak Pelapor">
                    <ul className="space-y-2">
                        {[
                            'Mendapat nomor tiket dan status yang dapat dilacak.',
                            'Memilih klasifikasi laporan Anonim atau Rahasia.',
                            'Menerima notifikasi tindak lanjut sesuai SLA.',
                            'Mengajukan eskalasi bila tidak ada respons.',
                        ].map((h) => (
                            <li key={h} className="flex gap-2 text-sm">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {h}
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
                                <CheckCircle2 className="text-brand-light mt-0.5 h-4 w-4 shrink-0" /> {h}
                            </li>
                        ))}
                    </ul>
                </Section>
            </div>
        </StaticShell>
    );
}
