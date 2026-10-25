import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUpRight,
    AtSign,
    Building2,
    Database,
    FilePenLine,
    HandCoins,
    IdCard,
    Landmark,
    type LucideIcon,
    Megaphone,
    Route,
    ShieldCheck,
    Sprout,
    Star,
    Tag,
} from 'lucide-react';

import TaraPage, { AskTaraCard, TaraEyebrow } from '@/components/sigap/tara-shell';

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

const CHANNEL_STYLE: Record<string, { icon: LucideIcon; action: string; external: boolean }> = {
    sosmed: { icon: AtSign, action: 'Buka Kanal', external: true },
    kantor: { icon: Landmark, action: 'Kunjungi Loket', external: false },
    nasional: { icon: Megaphone, action: 'Buka', external: true },
};

/** Ikon kategori ditebak dari namanya; kategori baru memakai ikon label. */
function categoryIcon(name: string): LucideIcon {
    const n = name.toLowerCase();
    if (n.includes('infrastruktur') || n.includes('jalan')) return Route;
    if (n.includes('lahan') || n.includes('tanah')) return Sprout;
    if (n.includes('bantuan') || n.includes('sosial')) return HandCoins;
    if (n.includes('data') || n.includes('tik')) return Database;
    return Tag;
}

export default function Katalog({ channels, categories }: Props) {
    // Kanal internal sudah diwakili kartu "Pengaduan Internal Pegawai".
    const others = channels.filter((c) => c.type !== 'internal');

    return (
        <TaraPage
            title="Katalog Pengaduan"
            description="Pilih kanal pengaduan resmi Kementerian Transmigrasi yang sesuai dengan kebutuhan Anda."
            active="katalog"
            eyebrow="Katalog Pengaduan"
            heading="Katalog Pengaduan"
            subtitle="Pilih kanal pengaduan resmi yang sesuai dengan kebutuhan Anda."
            pose="menunjuk"
            poseAlt="TARA menunjuk ke pilihan kanal pengaduan"
        >
            <div className="mx-auto flex max-w-[1312px] flex-col gap-14 px-4 py-14 sm:px-6 lg:px-16 lg:py-16">
                <div className="grid gap-6 lg:grid-cols-2">
                    <article className="relative flex flex-col gap-5 overflow-hidden rounded-[24px] bg-[radial-gradient(120%_120%_at_85%_0%,#0a5a91_0%,#022b4a_60%)] p-7 text-white sm:p-9">
                        <div className="flex items-start justify-between gap-4">
                            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-white/10">
                                <FilePenLine className="h-6 w-6 text-[var(--t-gold)]" aria-hidden="true" />
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold">
                                <Star className="h-3.5 w-3.5" aria-hidden="true" /> Kanal utama
                            </span>
                        </div>
                        <h2 className="font-heading text-[26px] font-bold sm:text-[28px]">Layanan SIGAP</h2>
                        <p className="max-w-[560px] text-[15.5px] leading-relaxed text-[#c9d6e2]">
                            Layanan portal pengaduan mandiri terintegrasi: Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas.
                        </p>
                        <Link
                            href="/pengaduan/baru"
                            className="transi-lift mt-1 flex h-12 w-fit items-center gap-2 rounded-full bg-[var(--t-gold)] px-6 font-semibold text-[var(--t-deep)] hover:bg-[#d0a552]"
                        >
                            <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" /> Buka Formulir
                        </Link>
                    </article>

                    <article className="flex flex-col gap-5 rounded-[24px] border border-[#ece6dc] bg-[#f7f3ee] p-7 sm:p-9">
                        <div className="flex items-start justify-between gap-4">
                            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-white">
                                <Building2 className="h-6 w-6 text-[var(--t-navy)]" aria-hidden="true" />
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-[#9a7330]">
                                <IdCard className="h-3.5 w-3.5" aria-hidden="true" /> Khusus pegawai
                            </span>
                        </div>
                        <h2 className="font-heading text-[26px] font-bold text-[var(--t-deep)] sm:text-[28px]">Pengaduan Internal Pegawai</h2>
                        <p className="max-w-[560px] text-[15.5px] leading-relaxed text-[#4b3f30]">
                            Laporkan gangguan sarana &amp; TIK kantor — internet mati, listrik padam, perangkat rusak, dll. Khusus pegawai Kementerian
                            Transmigrasi.
                        </p>
                        <Link
                            href="/pengaduan/internal"
                            className="transi-lift mt-1 flex h-12 w-fit items-center gap-2 rounded-full bg-[var(--t-navy)] px-6 font-semibold text-white hover:bg-[#00508a]"
                        >
                            <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" /> Lapor Gangguan
                        </Link>
                    </article>
                </div>

                {others.length > 0 && (
                    <section aria-labelledby="kanal-lain" className="flex flex-col gap-5">
                        <TaraEyebrow>
                            <span id="kanal-lain">Kanal resmi lainnya</span>
                        </TaraEyebrow>
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {others.map((ch) => {
                                const isWbs = /whistle|inspektorat|wbs/i.test(`${ch.name} ${ch.account_name ?? ''}`);
                                const style = CHANNEL_STYLE[ch.type] ?? CHANNEL_STYLE.nasional;
                                const Icon = isWbs ? ShieldCheck : style.icon;
                                const Arrow = style.external ? ArrowUpRight : ArrowRight;
                                return (
                                    <article key={ch.id} className="flex flex-col rounded-[18px] border border-[#e6ebf0] bg-white p-6">
                                        <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#eef3f8]">
                                            <Icon className="h-5 w-5 text-[var(--t-navy)]" aria-hidden="true" />
                                        </span>
                                        <h3 className="font-heading mt-5 text-lg font-bold text-[var(--t-deep)]">{ch.name}</h3>
                                        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#5b6b7a]">
                                            {ch.account_name ?? 'Kanal pengaduan resmi Kementerian Transmigrasi.'}
                                        </p>
                                        <div className="mt-5 border-t border-[#e6ebf0] pt-4">
                                            {ch.url ? (
                                                <a
                                                    href={ch.url}
                                                    target={style.external ? '_blank' : undefined}
                                                    rel={style.external ? 'noopener noreferrer' : undefined}
                                                    className="flex w-fit items-center gap-1.5 text-[15px] font-semibold text-[var(--t-deep)] hover:text-[var(--t-navy)]"
                                                >
                                                    {style.action} <Arrow className="h-4 w-4" aria-hidden="true" />
                                                </a>
                                            ) : (
                                                // Kanal tanpa tautan (mis. loket kantor): alamat & jam layanan ada di Pedoman Layanan.
                                                <Link
                                                    href="/pedoman-layanan"
                                                    className="flex w-fit items-center gap-1.5 text-[15px] font-semibold text-[var(--t-deep)] hover:text-[var(--t-navy)]"
                                                >
                                                    {style.action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                                </Link>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}

                {categories.length > 0 && (
                    <section
                        aria-labelledby="kategori-aduan"
                        className="flex flex-col gap-5 rounded-[24px] bg-[#f7f3ee] p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between"
                    >
                        <div className="shrink-0">
                            <TaraEyebrow tone="bronze">Kategori aduan</TaraEyebrow>
                            <h2 id="kategori-aduan" className="font-heading mt-2 text-[24px] font-bold text-[var(--t-deep)]">
                                Jenis aduan yang ditangani
                            </h2>
                        </div>
                        <ul className="flex flex-wrap gap-3 lg:justify-end">
                            {categories.map((cat) => {
                                const Icon = categoryIcon(cat.name);
                                return (
                                    <li
                                        key={cat.id}
                                        className="flex items-center gap-2 rounded-full border border-[#e3dccf] bg-white px-4 py-2.5 text-[15px] text-[#22313f]"
                                    >
                                        <Icon className="h-4 w-4 text-[var(--t-navy)]" aria-hidden="true" /> {cat.name}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                <AskTaraCard title="Bingung harus lewat kanal mana?" desc="Ceritakan saja ke TARA, nanti diarahkan ke kanal yang tepat." />
            </div>
        </TaraPage>
    );
}
