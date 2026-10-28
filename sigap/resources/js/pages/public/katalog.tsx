import { ArrowRight, ArrowUpRight, AtSign, Building2, Database, HandCoins, type LucideIcon, Route, Sprout, Tag } from 'lucide-react';
import { type ReactNode } from 'react';

import { activeLinks, external, type KanalPublik, KantorInfo, KantorMapPanel, SosmedList } from '@/components/sigap/kanal-resmi';
import TaraPage, { AskTaraCard, TaraEyebrow } from '@/components/sigap/tara-shell';

interface Props {
    /** Kanal resmi (setting `kanal_publik`), sama dengan strip di beranda. */
    kanal: KanalPublik;
    categories: { id: number; name: string; slug: string }[];
}

/** Ikon kategori ditebak dari namanya; kategori baru memakai ikon label. */
function categoryIcon(name: string): LucideIcon {
    const n = name.toLowerCase();
    if (n.includes('infrastruktur') || n.includes('jalan')) return Route;
    if (n.includes('lahan') || n.includes('tanah')) return Sprout;
    if (n.includes('bantuan') || n.includes('sosial')) return HandCoins;
    if (n.includes('data') || n.includes('tik')) return Database;
    return Tag;
}

export default function Katalog({ kanal, categories }: Props) {
    const links = activeLinks(kanal);

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
                {(kanal.sosmed.aktif || kanal.kantor.aktif || links.length > 0) && (
                    <section aria-labelledby="kanal-resmi" className="flex flex-col gap-5">
                        <TaraEyebrow>
                            <span id="kanal-resmi">Kanal resmi</span>
                        </TaraEyebrow>

                        {(kanal.sosmed.aktif || kanal.kantor.aktif) && (
                            <div className="grid gap-5 lg:grid-cols-2">
                                {kanal.sosmed.aktif && (
                                    <article className="flex flex-col gap-5 rounded-[18px] border border-[#e6ebf0] bg-white p-6 sm:p-7">
                                        <CardHeading icon={AtSign} title={kanal.sosmed.label}>
                                            Akun resmi dan kontak langsung Kementerian Transmigrasi.
                                        </CardHeading>
                                        <SosmedList sosmed={kanal.sosmed} className="grid gap-2.5 sm:grid-cols-2" />
                                    </article>
                                )}
                                {kanal.kantor.aktif && (
                                    <article className="flex flex-col overflow-hidden rounded-[18px] border border-[#e6ebf0] bg-white">
                                        <KantorMapPanel kantor={kanal.kantor} className="h-56" />
                                        <div className="flex flex-1 flex-col gap-5 p-6 sm:p-7">
                                            <CardHeading icon={Building2} title={kanal.kantor.label}>
                                                {kanal.kantor.nama}
                                            </CardHeading>
                                            <KantorInfo kantor={kanal.kantor} />
                                        </div>
                                    </article>
                                )}
                            </div>
                        )}

                        {links.length > 0 && (
                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {links.map(({ key, icon: Icon, item }) => {
                                    const Arrow = item.url.startsWith('http') ? ArrowUpRight : ArrowRight;
                                    return (
                                        <article key={key} className="flex flex-col rounded-[18px] border border-[#e6ebf0] bg-white p-6">
                                            <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#eef3f8]">
                                                <Icon className="h-5 w-5 text-[var(--t-navy)]" aria-hidden="true" />
                                            </span>
                                            <h3 className="font-heading mt-5 text-lg font-bold text-[var(--t-deep)]">{item.label}</h3>
                                            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#5b6b7a]">{item.deskripsi}</p>
                                            <div className="mt-5 border-t border-[#e6ebf0] pt-4">
                                                <a
                                                    href={item.url}
                                                    {...external(item.url)}
                                                    className="flex w-fit items-center gap-1.5 text-[15px] font-semibold text-[var(--t-deep)] hover:text-[var(--t-navy)]"
                                                >
                                                    Buka <Arrow className="h-4 w-4" aria-hidden="true" />
                                                </a>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
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

function CardHeading({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
    return (
        <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#eef3f8]">
                <Icon className="h-5 w-5 text-[var(--t-navy)]" aria-hidden="true" />
            </span>
            <div>
                <h3 className="font-heading text-lg font-bold text-[var(--t-deep)]">{title}</h3>
                <p className="mt-0.5 text-sm text-[#5b6b7a]">{children}</p>
            </div>
        </div>
    );
}
