import {
    ArrowUpRight,
    Building2,
    ChevronLeft,
    ChevronRight,
    Factory,
    GraduationCap,
    Handshake,
    LandPlot,
    type LucideIcon,
    MessageCircle,
} from 'lucide-react';
import { type CSSProperties, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { goToChat } from '@/lib/chat-transition';

/**
 * Program 5T di beranda: kartu lima program unggulan, klik → modal berisi
 * uraian resmi. Teks disalin apa adanya dari
 * https://www.transmigrasi.go.id/programunggulan/ (diakses 31-10-2026);
 * perbarui dari halaman itu bila Kementerian mengubahnya.
 */

const SOURCE_URL = 'https://www.transmigrasi.go.id/programunggulan/';

const INTRO =
    'Transmigrasi bukan hanya soal memindahkan penduduk dari satu daerah ke daerah lain, tetapi juga menciptakan peluang baru untuk hidup yang lebih baik. Untuk memastikan program ini berjalan lebih efektif dan memberikan manfaat nyata bagi masyarakat, Kementerian Transmigrasi RI menghadirkan 5 program unggulan yang disebut Program 5T.';

interface Program {
    key: string;
    /** Nama pendek di kartu. */
    short: string;
    /** Judul resmi di halaman sumber. */
    title: string;
    slogan: string;
    icon: LucideIcon;
    body: string[];
}

const PROGRAMS: Program[] = [
    {
        key: 'transtuntas',
        short: 'Trans Tuntas',
        title: 'Trans Tuntas',
        slogan: 'Tuntas Lahan, Tuntas Harapan!',
        icon: LandPlot,
        body: [
            'Trans Tuntas (T²), dengan slogan “Tuntas Lahan, Tuntas Harapan”, adalah program penyelesaian menyeluruh atas persoalan lahan di kawasan transmigrasi, seperti: sengketa, ketidakjelasan hak dan konflik agraria. Melalui pendataan, penyelesaian hukum, sertifikasi, dan revitalisasi serta optimalisasi lahan, program ini memberikan kepastian hak bagi transmigran dan mendorong pemanfaatan lahan yang produktif. Dengan pendekatan kolaboratif dan pemantauan berbasis teknologi, T² hadir sebagai solusi strategis dan adil untuk menciptakan kawasan transmigrasi yang tertata, legal, dan berdaya guna.',
        ],
    },
    {
        key: 'translokal',
        short: 'Trans Lokal',
        title: 'Transmigrasi Lokal',
        slogan: 'Dari Lokal, Maju Global',
        icon: Building2,
        body: [
            'Transmigrasi lokal (Translok), dengan slogan “dari lokal, maju global”, adalah pendekatan baru dalam pembangunan yang berfokus pada penguatan ekonomi dan infrastruktur masyarakat setempat tanpa perlu berpindah jauh. Program ini bertujuan membangun kota baru dari desa, mengurangi urbanisasi, serta meningkatkan kesejahteraan masyarakat melalui pemanfaatan potensi lokal. Dengan strategi pengembangan kawasan, revitalisasi infrastruktur, pemberdayaan ekonomi, kolaborasi multi-pihak, dan integrasi program nasional, Translok diharapkan menciptakan pusat pertumbuhan baru yang mandiri dan kompetitif.',
        ],
    },
    {
        key: 'transpatriot',
        short: 'Trans Patriot',
        title: 'Transmigrasi Patriot',
        slogan: 'Patriot Berkarya, Bangsa Berjaya',
        icon: GraduationCap,
        body: [
            'Transmigrasi Patriot, dengan slogan “Patriot Berkarya, Bangsa Berjaya”, hadir untuk menciptakan kader-kader pembangunan di kawasan transmigrasi yang memiliki semangat pengabdian, keterampilan relevan, dan kemampuan membangun komunitas yang mandiri dan maju. Program ini diluncurkan untuk mengatasi ketimpangan pembangunan antara pusat dan daerah di Indonesia, terutama di wilayah kaya sumber daya yang masih tertinggal.',
            'Melibatkan mahasiswa, lulusan perguruan tinggi, peneliti, dan profesional, Transmigrasi Patriot mempersiapkan peserta sebagai CEO korporasi masyarakat yang mengelola unit usaha berbasis potensi lokal. Mereka tidak hanya mendapatkan pelatihan akademis dan teknis, tetapi juga berperan langsung dalam mengelola usaha strategis. Melalui skema perkuliahan luar negeri dan dalam negeri, peserta ditempa untuk menjadi agen perubahan di kawasan transmigrasi, memastikan transformasi ekonomi berbasis komunitas berjalan efektif dan berkelanjutan. Program ini bertujuan menciptakan pusat-pusat pertumbuhan baru di kawasan transmigrasi, sekaligus mengurangi ketimpangan wilayah melalui penguatan SDM dan ekonomi lokal.',
        ],
    },
    {
        key: 'transkaryanusa',
        short: 'Trans Karya Nusa',
        title: 'Trans Karya Nusantara',
        slogan: 'Kawasan Berkarya, Nusantara Berdaya',
        icon: Factory,
        body: [
            'Trans Karya Nusantara, dengan slogan “Kawasan Berkarya, Nusantara Berdaya”, adalah program yang berfokus pada pengembangan ekonomi berbasis potensi kawasan transmigrasi untuk menciptakan lapangan kerja berkelanjutan. Tidak hanya membangun infrastruktur, program ini mendorong tumbuhnya industri unggulan lokal seperti pertanian, perikanan, pengolahan, dan pariwisata, melalui kemitraan dengan dunia usaha, pelatihan SDM, dan pembangunan sentra ekonomi. Dengan pendekatan terintegrasi dan dukungan investasi, Trans Karya Nusa bertujuan menjadikan kawasan transmigrasi sebagai pusat pertumbuhan ekonomi baru yang kompetitif dan berdaya saing di tingkat nasional maupun global.',
        ],
    },
    {
        key: 'transgotongroyong',
        short: 'Trans Gotong Royong',
        title: 'Trans Gotong Royong',
        slogan: 'Bangun Bersama, Sejahtera Semua',
        icon: Handshake,
        body: [
            'Trans Gotong Royong (Trans GR), dengan slogan “Bangun Bersama, Sejahtera Semua”, adalah program pembangunan kawasan transmigrasi berbasis kolaborasi antara pemerintah, masyarakat, dunia usaha, dan organisasi sosial. Program ini bertujuan mempercepat pembangunan infrastruktur dasar, mendorong kemandirian ekonomi, serta memperkuat harmoni sosial melalui prinsip gotong royong. Melalui pendekatan multi-pihak, revitalisasi kawasan, ekonomi kolaboratif, dan pemberdayaan komunitas, Trans GR membangun ekosistem yang inklusif dan berkelanjutan demi menciptakan wilayah transmigrasi yang sejahtera dan berdaya.',
        ],
    },
];

const num = (i: number) => String(i + 1).padStart(2, '0');

export default function Program5T() {
    const [active, setActive] = useState<number | null>(null);
    const program = active === null ? null : PROGRAMS[active];
    const go = (step: number) => setActive((i) => (i === null ? i : (i + step + PROGRAMS.length) % PROGRAMS.length));

    return (
        <section aria-labelledby="program-5t" className="bg-[var(--tcd-muted,#f6f8fa)] py-14 sm:py-24">
            <div className="mx-auto max-w-[1312px] px-4 sm:px-6 lg:px-16">
                <div className="flex flex-col gap-3 lg:max-w-[820px]">
                    <p data-reveal className="text-xs font-semibold tracking-[0.12em] text-[var(--tcd-bronze,#8b682b)] uppercase sm:text-[13px]">
                        Program unggulan
                    </p>
                    <h2
                        id="program-5t"
                        data-reveal
                        className="font-heading text-[30px] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-[var(--tcd-heading,var(--t-deep))] sm:text-4xl"
                    >
                        Program 5T Kementerian Transmigrasi
                    </h2>
                    <p data-reveal className="text-base leading-[1.65] text-[var(--tcd-text-2,#4a5a68)] sm:text-[17px]">
                        {INTRO}
                    </p>
                </div>

                <ul className="mt-9 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
                    {PROGRAMS.map((p, i) => (
                        // data-reveal di <li> berkelas tetap (lihat catatan di FAQ beranda).
                        <li key={p.key} data-reveal style={{ '--d': `${0.05 * i}s` } as CSSProperties}>
                            <button
                                type="button"
                                onClick={() => setActive(i)}
                                aria-haspopup="dialog"
                                className="group flex h-full w-full flex-row items-center gap-4 rounded-[18px] border border-[var(--tcd-border,#e8edf2)] bg-[var(--tcd-surface,#fff)] p-4 text-left transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[var(--t-gold)] hover:shadow-[0_14px_32px_-18px_rgba(2,43,74,0.35)] sm:flex-col sm:items-start sm:gap-5 sm:p-5"
                            >
                                <span className="flex shrink-0 items-center justify-between sm:w-full">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tcd-info-soft,#e8f0f7)] text-[var(--tcd-link,var(--t-navy))] transition-colors group-hover:bg-[var(--t-gold)] group-hover:text-[var(--t-deep)]">
                                        <p.icon className="h-6 w-6" aria-hidden="true" />
                                    </span>
                                    <span
                                        className="font-heading hidden text-sm font-bold text-[var(--tcd-text-3,#6d7681)] sm:block"
                                        aria-hidden="true"
                                    >
                                        {num(i)}
                                    </span>
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="font-heading text-lg leading-tight font-bold text-[var(--tcd-heading,var(--t-deep))]">
                                        {p.short}
                                    </span>
                                    <span className="text-sm leading-snug text-[var(--tcd-bronze,#8b682b)] italic">{p.slogan}</span>
                                    <span className="mt-1 hidden items-center gap-1 text-sm font-semibold text-[var(--tcd-link,var(--t-navy))] sm:mt-3 sm:flex">
                                        Lihat program
                                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                    </span>
                                </span>
                                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--tcd-text-3,#6d7681)] sm:hidden" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <Dialog open={program !== null} onOpenChange={(v) => !v && setActive(null)}>
                {program && active !== null && (
                    <DialogContent className="transi-page z-[120] flex max-h-[calc(100dvh-32px)] max-w-[calc(100%-32px)] flex-col gap-0 overflow-hidden rounded-[22px] border-[var(--tcd-border,#e8edf2)] bg-[var(--tcd-surface,#fff)] p-0 sm:max-w-[640px] sm:rounded-[22px] [&>button:last-child]:top-5 [&>button:last-child]:right-5 [&>button:last-child]:rounded-full [&>button:last-child]:bg-white/10 [&>button:last-child]:p-2 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/20">
                        <div
                            className="relative shrink-0 px-6 pt-6 pb-6 text-white sm:px-8 sm:pt-8"
                            style={{
                                background: 'radial-gradient(120% 120% at 100% 0%, rgba(11,90,140,0.7) 0%, rgba(2,43,74,0) 60%), var(--t-deep)',
                            }}
                        >
                            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--t-gold)] uppercase">
                                Program {active + 1} dari 5 · Program 5T
                            </p>
                            <div className="mt-3 flex items-center gap-4 pr-10">
                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--t-gold)] text-[var(--t-deep)]">
                                    <program.icon className="h-7 w-7" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <DialogTitle className="font-heading text-2xl leading-tight font-bold text-white sm:text-[28px]">
                                        {program.title}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 text-[15px] text-[#e9d3a6] italic">“{program.slogan}”</DialogDescription>
                                </div>
                            </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-8">
                            {program.body.map((para) => (
                                <p
                                    key={para.slice(0, 24)}
                                    className="mb-4 text-[15px] leading-[1.75] text-[var(--tcd-text,#1f2d3a)] last:mb-0 sm:text-base"
                                >
                                    {para}
                                </p>
                            ))}
                            <p className="mt-5 text-xs text-[var(--tcd-text-3,#6d7681)]">
                                Sumber:{' '}
                                <a
                                    href={`${SOURCE_URL}#${program.key}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-[var(--tcd-link,var(--t-navy))]"
                                >
                                    transmigrasi.go.id — Program Unggulan
                                </a>
                            </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[var(--tcd-border,#e8edf2)] px-6 py-4 sm:px-8">
                            <button
                                type="button"
                                onClick={(e) => {
                                    setActive(null);
                                    goToChat({ question: `Jelaskan program ${program.title}`, source: e.currentTarget });
                                }}
                                className="font-heading flex h-11 items-center gap-2 rounded-full bg-[var(--t-gold)] px-5 text-sm font-bold text-[var(--t-deep)] hover:bg-[#d0a552]"
                            >
                                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Tanya TARA
                            </button>
                            <a
                                href={`${SOURCE_URL}#${program.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-11 items-center gap-1.5 rounded-full border border-[var(--tcd-border-strong,#d5dee6)] px-4 text-sm font-semibold text-[var(--tcd-link,var(--t-navy))] hover:bg-[var(--tcd-muted,#f2f5f8)]"
                            >
                                Situs resmi <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            </a>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => go(-1)}
                                    aria-label={`Program sebelumnya: ${PROGRAMS[(active + 4) % 5].title}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--tcd-border-strong,#d5dee6)] text-[var(--tcd-link,var(--t-navy))] hover:bg-[var(--tcd-muted,#f2f5f8)]"
                                >
                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => go(1)}
                                    aria-label={`Program berikutnya: ${PROGRAMS[(active + 1) % 5].title}`}
                                    className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--tcd-border-strong,#d5dee6)] text-[var(--tcd-link,var(--t-navy))] hover:bg-[var(--tcd-muted,#f2f5f8)]"
                                >
                                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </section>
    );
}
