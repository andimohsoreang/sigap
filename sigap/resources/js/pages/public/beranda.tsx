import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Building2, ChevronDown, Clock, Database, FileSignature, Hash, Headset, MapPin, Search, ShieldAlert, Ticket, Volume2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

interface Channel {
    id: number;
    type: string;
    name: string;
    account_name: string | null;
    url: string | null;
}

interface Stats {
    total: number;
    kanal_count: number;
    by_status: Record<string, number>;
    by_category: { name: string; total: number }[];
}

interface Props {
    stats: Stats;
    channels: Channel[];
    faqs: { question: string; answer: string }[];
}

const CHANNEL_ICONS: Record<string, typeof Building2> = {
    sosmed: Hash,
    kantor: Building2,
    nasional: Volume2,
    internal: ShieldAlert,
};

export default function Beranda({ stats, channels, faqs }: Props) {
    const [query, setQuery] = useState('');
    const [faqSearch, setFaqSearch] = useState('');

    const submitTrack = (e: FormEvent) => {
        e.preventDefault();
        if (query.trim()) router.get('/lacak', { ticket: query.trim().toUpperCase() });
    };

    const filteredFaqs = faqs.filter((f) => f.question.toLowerCase().includes(faqSearch.toLowerCase()));

    const quickActions = [
        { page: 'katalog', label: 'Buat Tiket', sub: 'Baru', icon: Ticket },
        { page: 'peta', label: 'Peta Aduan', sub: 'Kawasan', icon: MapPin },
        { page: 'tentang', label: 'Data', sub: 'SIGAP', icon: Database },
    ];

    return (
        <PublicLayout title="Beranda">
            <Head title="Beranda — SIGAP" />

            {/* HERO */}
            <section className="bg-primary relative overflow-hidden pt-16 pb-24 lg:pt-20 lg:pb-32">
                <div className="from-primary to-brand-light absolute inset-0 bg-gradient-to-br" />
                <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 sm:px-6 lg:px-8">
                    <h2 className="mb-2 text-center text-lg font-bold tracking-wide text-white drop-shadow-md md:text-3xl">
                        Selamat Datang di Pusat Bantuan SIGAP
                    </h2>
                    <p className="text-brand-soft mb-8 max-w-2xl text-center text-sm font-medium italic drop-shadow md:text-base">
                        "Komitmen Melayani, Menuntaskan Tanpa Henti"
                    </p>

                    <div className="mb-10 flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-2 shadow-sm backdrop-blur-md md:gap-4 md:px-6 md:py-2.5">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                            </span>
                            <span className="text-xs font-bold tracking-wide text-white sm:text-sm">Layanan Aktif</span>
                        </div>
                        <span className="hidden text-white/30 sm:inline">|</span>
                        <div className="flex items-center gap-2 text-white/90">
                            <Clock className="text-secondary h-4 w-4" />
                            <span className="text-xs font-medium sm:text-sm">Senin - Jumat (08:00 - 16:00 WIB)</span>
                        </div>
                    </div>

                    <form
                        onSubmit={submitTrack}
                        className="mb-12 flex w-full max-w-4xl flex-col items-center rounded-2xl border-2 border-white/20 bg-white p-2 shadow-lg backdrop-blur-sm md:flex-row md:rounded-full"
                    >
                        <div className="flex w-full flex-grow items-center py-2 pl-4">
                            <Ticket className="mr-3 hidden h-4 w-4 text-gray-400 md:block" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Masukkan Nomor Tiket (Cth: TKT-261012-7KQ4MZ)…"
                                className="border-0 bg-transparent text-gray-700 shadow-none focus-visible:ring-0 md:text-lg"
                            />
                        </div>
                        <Button type="submit" className="mt-2 w-full rounded-xl md:mt-0 md:w-auto md:rounded-full">
                            <Search className="h-4 w-4" /> Cari
                        </Button>
                    </form>

                    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {quickActions.map(({ page, label, sub, icon: Icon }) => (
                            <Link
                                key={page}
                                href={`/${page === 'tentang' ? 'tentang' : page}`}
                                className="group relative flex flex-col items-start overflow-hidden rounded-3xl border border-white bg-white/95 p-6 shadow-md transition-all duration-300 hover:shadow-xl"
                            >
                                <Icon className="absolute -right-4 -bottom-4 h-24 w-24 text-gray-800 opacity-5 transition duration-500 group-hover:scale-110" />
                                <div className="bg-brand-soft text-primary mb-12 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-inner">
                                    <Icon className="h-7 w-7" />
                                </div>
                                <h3 className="group-hover:text-brand-light relative z-10 text-xl leading-tight font-extrabold text-gray-800 transition-colors">
                                    {label}
                                    <br />
                                    {sub}
                                </h3>
                            </Link>
                        ))}
                        <div className="group relative flex cursor-pointer flex-col items-start overflow-hidden rounded-3xl border border-white bg-white/95 p-6 shadow-md transition-all duration-300 hover:shadow-xl">
                            <Headset className="absolute -right-4 -bottom-4 h-24 w-24 text-gray-800 opacity-5 transition duration-500 group-hover:scale-110" />
                            <div className="bg-brand-soft text-primary mb-12 flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner">
                                <Headset className="h-7 w-7" />
                            </div>
                            <h3 className="group-hover:text-brand-light relative z-10 text-xl leading-tight font-extrabold text-gray-800 transition-colors">
                                Kontak Kami
                                <br />
                                SIGAP
                            </h3>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5 KANAL */}
            <section className="relative z-20 mx-auto my-16 max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center gap-6 rounded-3xl border border-gray-100 bg-white p-8 shadow-sm md:flex-row md:items-start md:gap-12 md:p-12">
                    <div className="flex shrink-0 items-start gap-4 md:w-1/3">
                        <span className="text-secondary text-7xl leading-none font-black md:text-8xl">{stats.kanal_count || 5}</span>
                        <h2 className="text-primary pt-1 text-2xl leading-tight font-bold md:text-3xl">
                            Kanal
                            <br />
                            Pengaduan
                            <br />
                            Resmi
                        </h2>
                    </div>
                    <div className="border-secondary/40 relative flex w-full flex-col gap-4 rounded-3xl border-y-2 border-l-2 p-6 md:w-2/3 md:border-r-2 md:p-8">
                        {channels.map((ch) => {
                            const Icon = CHANNEL_ICONS[ch.type] ?? Volume2;
                            return (
                                <a
                                    key={ch.id}
                                    href={ch.url ?? '#'}
                                    className="border-secondary text-primary hover:bg-secondary flex w-fit items-center gap-4 rounded-full border bg-white px-6 py-3 font-semibold transition hover:text-white"
                                >
                                    <Icon className="h-5 w-5 shrink-0" />
                                    <span className="text-left text-sm leading-tight md:text-base">{ch.name}</span>
                                </a>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* MAKLUMAT */}
            <section className="mx-auto mb-16 max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="border-l-primary flex flex-col overflow-hidden rounded-xl border border-l-8 border-gray-100 bg-white shadow-lg transition-all duration-300 hover:shadow-xl md:flex-row">
                    <div className="bg-brand-soft/50 flex flex-col items-center justify-center border-b border-gray-200 p-8 text-center md:w-1/3 md:border-r md:border-b-0">
                        <div className="relative mb-4">
                            <div className="bg-primary absolute inset-0 rounded-lg opacity-20 blur-md" />
                            <div className="text-primary relative flex h-24 w-20 items-center justify-center rounded-lg border border-gray-200 bg-white text-4xl shadow-md">
                                <FileSignature className="h-9 w-9" />
                                <span className="absolute right-2 bottom-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    PDF
                                </span>
                            </div>
                        </div>
                        <h3 className="mb-1 font-bold text-gray-800">Dokumen Resmi Maklumat</h3>
                        <p className="mb-5 text-xs text-gray-500">Diperbarui: Jan 2026 | Ukuran: 1.2 MB</p>
                        <Button size="sm">
                            <FileSignature className="h-4 w-4" /> Unduh File
                        </Button>
                    </div>
                    <div className="flex flex-col justify-center p-8 md:w-2/3">
                        <span className="mb-3 w-fit rounded bg-green-100 px-2 py-1 text-xs font-bold tracking-wider text-green-700 uppercase">
                            Komitmen SIGAP
                        </span>
                        <h2 className="mb-4 text-2xl font-bold text-gray-800">Maklumat Pelayanan dan Penilaian</h2>
                        <p className="mb-6 leading-relaxed text-gray-600">
                            "Kami Pimpinan dan Seluruh Agen SIGAP menyatakan sanggup menyelenggarakan pelayanan publik pada program transformasi 5T
                            yang sesuai standar pelayanan. Apabila kami tidak menepati maklumat ini, kami siap menerima sanksi sesuai dengan peraturan
                            perundang-undangan."
                        </p>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="mx-auto mb-16 max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto mb-10 max-w-4xl text-center">
                    <h2 className="mb-4 text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
                    <div className="relative mx-auto mt-6 max-w-md">
                        <Search className="absolute top-3.5 left-4 h-4 w-4 text-gray-400" />
                        <Input
                            value={faqSearch}
                            onChange={(e) => setFaqSearch(e.target.value)}
                            placeholder="Cari pertanyaan... (Cth: login, dokumen)"
                            className="rounded-full pl-10"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                    {filteredFaqs.map((faq) => (
                        <details
                            key={faq.question}
                            className="group rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md"
                        >
                            <summary className="flex list-none items-center gap-4 p-5">
                                <div className="bg-brand-light flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white">
                                    <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
                                </div>
                                <h3 className="text-sm leading-snug font-bold text-gray-800 md:text-[15px]">{faq.question}</h3>
                            </summary>
                            <div className="border-t border-gray-50 px-5 pt-4 pb-5 pl-[72px] text-sm whitespace-pre-line text-gray-500">
                                {faq.answer}
                            </div>
                        </details>
                    ))}
                </div>
                {filteredFaqs.length === 0 && (
                    <p className="mt-8 text-center text-gray-500 italic">Maaf, pertanyaan yang Anda cari tidak ditemukan.</p>
                )}
            </section>
        </PublicLayout>
    );
}
