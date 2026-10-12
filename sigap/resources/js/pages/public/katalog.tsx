import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link } from '@inertiajs/react';
import { Building2, Hash, ShieldAlert, Ticket, Volume2 } from 'lucide-react';

interface Channel {
    id: number;
    type: string;
    type_label: string;
    name: string;
    account_name: string | null;
    url: string | null;
    status: string;
}

interface Props {
    channels: Channel[];
    categories: { id: number; name: string; slug: string }[];
}

const TYPE_STYLE: Record<string, { badge: string; label: string; icon: typeof Ticket; action: string; href: string }> = {
    sosmed: { badge: 'bg-secondary text-white', label: 'Kanal Media Sosial', icon: Hash, action: 'Buka Kanal', href: '#' },
    kantor: { badge: 'bg-gray-700 text-white', label: 'Kanal Kantor', icon: Building2, action: 'Kunjungi Loket', href: '#' },
    nasional: { badge: 'bg-primary text-white', label: 'Nasional', icon: Volume2, action: 'Buka', href: '#' },
    internal: { badge: 'bg-orange-500 text-white', label: 'Internal', icon: ShieldAlert, action: 'Lapor Gangguan', href: '#' },
};

export default function Katalog({ channels, categories }: Props) {
    const cards = [
        {
            key: 'sigap',
            badge: 'bg-secondary text-white',
            title: 'Layanan SIGAP',
            desc: 'Layanan portal pengaduan mandiri terintegrasi: Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas.',
            action: 'Buka Formulir',
            href: '/pengaduan/baru',
            buttonClass: 'bg-brand-light hover:bg-primary',
        },
        {
            key: 'internal',
            badge: 'bg-gray-700 text-white',
            title: 'Pengaduan Internal Pegawai',
            desc: 'Laporkan gangguan sarana & TIK kantor — internet mati, listrik padam, perangkat rusak, dll. Khusus pegawai Kementerian Transmigrasi.',
            action: 'Lapor Gangguan',
            href: '/pengaduan/internal',
            buttonClass: 'bg-orange-500 hover:bg-orange-600',
        },
    ];

    return (
        <PublicLayout title="Katalog Pengaduan">
            <Head title="Katalog Pengaduan — SIGAP" />

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <h1 className="mb-2 text-3xl font-bold text-gray-800">Katalog Pengaduan</h1>
                <p className="mb-8 text-gray-500">Pilih kanal pengaduan resmi yang sesuai dengan kebutuhan Anda.</p>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {cards.map((c) => (
                        <div key={c.key} className="relative pt-4">
                            <span className={`absolute top-1 left-5 z-10 rounded px-3 py-1 text-[10px] font-bold shadow-sm ${c.badge}`}>
                                {c.key === 'internal' ? 'Internal' : 'Pengaduan'}
                            </span>
                            <Card className="h-full border-gray-100 pt-8 shadow-sm">
                                <CardContent className="flex flex-grow flex-col p-5">
                                    <h3 className="mb-2 text-[17px] font-bold text-gray-800">{c.title}</h3>
                                    <p className="mb-6 flex-grow text-xs text-gray-500">{c.desc}</p>
                                    <Button asChild className={`w-fit ${c.buttonClass}`}>
                                        <Link href={c.href}>{c.action}</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    ))}

                    {channels.map((ch) => {
                        const style = TYPE_STYLE[ch.type] ?? TYPE_STYLE.sosmed;
                        const Icon = style.icon;
                        return (
                            <div key={ch.id} className="relative pt-4">
                                <span className={`absolute top-1 left-5 z-10 rounded px-3 py-1 text-[10px] font-bold shadow-sm ${style.badge}`}>
                                    {style.label}
                                </span>
                                <Card className="h-full border-gray-100 pt-8 shadow-sm">
                                    <CardContent className="flex flex-grow flex-col p-5">
                                        <div className="mb-2 flex items-center gap-2">
                                            <Icon className="text-primary h-5 w-5" />
                                            <h3 className="text-[17px] font-bold text-gray-800">{ch.name}</h3>
                                        </div>
                                        <p className="mb-6 flex-grow text-xs text-gray-500">
                                            {ch.account_name ?? 'Kanal pengaduan resmi Kementerian Transmigrasi.'}
                                        </p>
                                        <Button asChild variant="outline" className="w-fit">
                                            <a href={ch.url ?? '#'}>{style.action}</a>
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12">
                    <h2 className="mb-4 text-lg font-bold text-gray-800">Kategori Aduan</h2>
                    <div className="flex flex-wrap gap-3">
                        {categories.map((cat) => (
                            <span
                                key={cat.id}
                                className="border-secondary/60 text-primary rounded-full border bg-white px-4 py-2 text-sm font-medium"
                            >
                                {cat.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
