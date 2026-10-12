import { Head, Link, router } from '@inertiajs/react';
import { Building2, ChevronDown, Clock, Database, FileSignature, Hash, Headset, MapPin, Search, ShieldAlert, Ticket, Volume2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PublicLayout from '@/layouts/public-layout';

/**
 * PEMBANDING TAMPILAN — versi gaya absol.id dari halaman beranda.
 *
 * Struktur section, kartu, dan materi teks sengaja TIDAK diubah; yang diganti
 * hanya bahasa visualnya: tipografi Space Grotesk (uppercase) + Jost, section
 * tag + accent line, kartu bergaris dengan hover-lift, ikon dalam bulatan, dan
 * tombol pill uppercase. Palet warna tetap brand SIGAP (teal + gold).
 */

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

export default function BerandaAbsol({ stats, channels, faqs }: Props) {
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
            <Head title="Beranda — SIGAP">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=space-grotesk:500,700|jost:300,400,500,600,700"
                    head-key="absol-fonts"
                />
            </Head>

            {/* Seluruh konten memakai Jost (body); heading di-override Space Grotesk. */}
            <div className="font-body">
                {/* HERO */}
                <section className="bg-brand relative overflow-hidden pt-14 pb-20 lg:pt-16 lg:pb-28">
                    <div className="from-brand via-brand to-brand-light absolute inset-0 bg-gradient-to-br" />
                    <div
                        className="absol-grid-pan absolute inset-0 opacity-10"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
                            backgroundSize: '56px 56px',
                        }}
                    />
                    <div className="absol-orb absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                    <div
                        className="absol-orb bg-brand-light/20 absolute -bottom-32 -left-24 h-96 w-96 rounded-full blur-3xl"
                        style={{ animationDelay: '-8s', animationDuration: '20s' }}
                    />

                    <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 sm:px-6 lg:px-8">
                        <span className="text-secondary mb-4 inline-flex items-center gap-3 text-xs font-bold tracking-[3px] uppercase">
                            <span className="bg-secondary hidden h-[2px] w-6 sm:block" />
                            Pusat Bantuan SIGAP
                            <span className="bg-secondary hidden h-[2px] w-6 sm:block" />
                        </span>

                        <h2 className="font-heading mb-5 max-w-3xl text-center text-3xl leading-tight font-extrabold tracking-tight text-white uppercase md:text-5xl">
                            Selamat Datang di Pusat Bantuan SIGAP
                        </h2>

                        <div className="bg-secondary mb-6 h-[3px] w-20 rounded-full" />

                        <p className="mb-8 max-w-2xl text-center text-base font-medium text-white/85 italic md:text-lg">
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
                            className="mb-12 flex w-full max-w-4xl flex-col items-center rounded-3xl border border-white/25 bg-white p-2.5 shadow-2xl md:flex-row md:rounded-full"
                        >
                            <div className="flex w-full flex-grow items-center py-2 pl-4">
                                <Search className="mr-3 hidden h-4 w-4 text-gray-400 md:block" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Masukkan Nomor Tiket (Cth: TKT-261012-7KQ4MZ)…"
                                    className="border-0 bg-transparent font-medium text-gray-700 shadow-none focus-visible:ring-0 md:text-lg"
                                />
                            </div>
                            <Button
                                type="submit"
                                className="font-heading mt-2 w-full rounded-2xl font-bold tracking-wider uppercase md:mt-0 md:w-auto md:rounded-full"
                            >
                                <Search className="h-4 w-4" /> Cari
                            </Button>
                        </form>

                        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {quickActions.map(({ page, label, sub, icon: Icon }) => (
                                <Link
                                    key={page}
                                    href={`/${page === 'tentang' ? 'tentang' : page}`}
                                    className="group border-border/70 relative flex flex-col items-start overflow-hidden rounded-xl border bg-white/95 p-6 shadow-md backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-white hover:shadow-2xl"
                                >
                                    <Icon className="text-brand absolute -right-4 -bottom-4 h-24 w-24 opacity-5 transition duration-500 group-hover:scale-110" />
                                    <div className="bg-brand-light/10 text-brand-light group-hover:bg-brand-light mb-8 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300 group-hover:text-white">
                                        <Icon className="h-7 w-7" />
                                    </div>
                                    <h3 className="font-heading text-brand group-hover:text-brand-light relative z-10 text-lg leading-tight font-bold tracking-tight uppercase transition-colors">
                                        {label}
                                        <br />
                                        {sub}
                                    </h3>
                                </Link>
                            ))}
                            <div className="group border-border/70 relative flex cursor-pointer flex-col items-start overflow-hidden rounded-xl border bg-white/95 p-6 shadow-md backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-white hover:shadow-2xl">
                                <Headset className="text-brand absolute -right-4 -bottom-4 h-24 w-24 opacity-5 transition duration-500 group-hover:scale-110" />
                                <div className="bg-brand-light/10 text-brand-light group-hover:bg-brand-light mb-8 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300 group-hover:text-white">
                                    <Headset className="h-7 w-7" />
                                </div>
                                <h3 className="font-heading text-brand group-hover:text-brand-light relative z-10 text-lg leading-tight font-bold tracking-tight uppercase transition-colors">
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
                    <div className="flex flex-col items-center gap-6 rounded-xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow duration-300 hover:shadow-lg md:flex-row md:items-start md:gap-12 md:p-12">
                        <div className="flex shrink-0 items-start gap-4 md:w-1/3">
                            <span className="text-secondary font-heading text-7xl leading-none font-extrabold md:text-8xl">
                                {stats.kanal_count || 5}
                            </span>
                            <div className="pt-1">
                                <span className="text-brand-light mb-2 block text-xs font-bold tracking-[3px] uppercase">Kanal Resmi</span>
                                <h2 className="font-heading text-brand text-2xl leading-tight font-bold tracking-tight uppercase md:text-3xl">
                                    Kanal
                                    <br />
                                    Pengaduan
                                    <br />
                                    Resmi
                                </h2>
                                <div className="bg-brand-light mt-4 h-[3px] w-16 rounded-full" />
                            </div>
                        </div>
                        <div className="border-brand-light/30 relative flex w-full flex-col gap-4 rounded-xl border-y-2 border-l-2 p-6 md:w-2/3 md:border-r-2 md:p-8">
                            {channels.map((ch) => {
                                const Icon = CHANNEL_ICONS[ch.type] ?? Volume2;
                                return (
                                    <a
                                        key={ch.id}
                                        href={ch.url ?? '#'}
                                        className="border-brand-light/40 text-brand hover:bg-brand-light font-heading hover:border-brand-light flex w-fit items-center gap-4 rounded-full border-2 bg-white px-6 py-3 font-bold tracking-wide uppercase transition hover:text-white"
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
                    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md transition-shadow duration-300 hover:shadow-xl md:flex-row">
                        <div className="bg-brand-light/5 relative flex flex-col items-center justify-center border-b border-gray-100 p-8 text-center md:w-1/3 md:border-r md:border-b-0">
                            <span className="bg-brand-light absolute top-0 left-0 h-full w-1 md:w-1.5" />
                            <div className="relative mb-4">
                                <div className="bg-brand-light absolute inset-0 rounded-xl opacity-20 blur-md" />
                                <div className="text-brand relative flex h-24 w-20 items-center justify-center rounded-xl border border-gray-200 bg-white text-4xl shadow-md">
                                    <FileSignature className="h-9 w-9" />
                                    <span className="absolute right-2 bottom-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                        PDF
                                    </span>
                                </div>
                            </div>
                            <h3 className="font-heading text-brand mb-1 font-bold tracking-tight uppercase">Dokumen Resmi Maklumat</h3>
                            <p className="mb-5 text-xs text-gray-500">Diperbarui: Jan 2026 | Ukuran: 1.2 MB</p>
                            <Button size="sm" className="font-heading rounded-full font-bold tracking-wide uppercase">
                                <FileSignature className="h-4 w-4" /> Unduh File
                            </Button>
                        </div>
                        <div className="flex flex-col justify-center p-8 md:w-2/3">
                            <span className="text-brand-light mb-3 w-fit text-xs font-bold tracking-[3px] uppercase">Komitmen SIGAP</span>
                            <h2 className="font-heading text-brand mb-4 text-2xl font-bold tracking-tight uppercase">
                                Maklumat Pelayanan dan Penilaian
                            </h2>
                            <div className="bg-brand-light mb-6 h-[3px] w-20 rounded-full" />
                            <p className="leading-relaxed text-gray-600">
                                "Kami Pimpinan dan Seluruh Agen SIGAP menyatakan sanggup menyelenggarakan pelayanan publik pada program transformasi
                                5T yang sesuai standar pelayanan. Apabila kami tidak menepati maklumat ini, kami siap menerima sanksi sesuai dengan
                                peraturan perundang-undangan."
                            </p>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="mx-auto mb-16 max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto mb-10 max-w-4xl text-center">
                        <span className="text-brand-light mb-3 block text-xs font-bold tracking-[3px] uppercase">Pertanyaan Umum</span>
                        <h2 className="font-heading text-brand text-3xl font-extrabold tracking-tight uppercase md:text-4xl">
                            Frequently Asked Questions
                        </h2>
                        <div className="bg-brand-light mx-auto mt-5 h-[3px] w-20 rounded-full" />
                        <div className="relative mx-auto mt-8 max-w-md">
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
                                className="group hover:border-brand-light/40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                            >
                                <summary className="flex cursor-pointer list-none items-center gap-4 p-5">
                                    <div className="bg-brand-light flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white">
                                        <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
                                    </div>
                                    <h3 className="font-heading text-brand text-sm leading-snug font-bold tracking-tight md:text-[15px]">
                                        {faq.question}
                                    </h3>
                                </summary>
                                <div className="border-t border-gray-50 px-5 pt-4 pb-5 pl-[72px] text-sm text-gray-500">{faq.answer}</div>
                            </details>
                        ))}
                    </div>
                    {filteredFaqs.length === 0 && (
                        <p className="mt-8 text-center text-gray-500 italic">Maaf, pertanyaan yang Anda cari tidak ditemukan.</p>
                    )}
                </section>
            </div>
        </PublicLayout>
    );
}
