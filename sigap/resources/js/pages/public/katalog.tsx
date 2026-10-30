import { ArrowRight, ArrowUpRight, AtSign, Briefcase, Globe, type LucideIcon, MessageCircle, UserRound } from 'lucide-react';

import { activeLinks, external, type KanalPublik, type KanalTautan, SosmedList } from '@/components/sigap/kanal-resmi';
import { DIRECTORY_TITLE, type Kantor, KantorAccordion } from '@/components/sigap/kantor-direktori';
import TaraPage, { TaraAvatar, TaraEyebrow } from '@/components/sigap/tara-shell';
import { goToChat } from '@/lib/chat-transition';

/**
 * Logo resmi kanal nasional (desain Wonder). SP4N-LAPOR! memakai logo sebagai
 * judul; KPK menampilkan logo di samping nama kanal.
 */
const LOGO: Record<string, { src: string; width: number; height: number; replacesTitle?: boolean }> = {
    lapor: { src: '/images/brand/logo-lapor.png', width: 109, height: 36, replacesTitle: true },
    kpk: { src: '/images/brand/logo-kpk.png', width: 38, height: 48 },
};

interface Props {
    kanal: KanalPublik;
    kantor: Kantor[];
}

/** https://sp4n.lapor.go.id/instansi/... → sp4n.lapor.go.id; path internal → Formulir Contact Center */
const domain = (url: string) => (url.startsWith('/') ? 'Formulir Contact Center' : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);

export default function Katalog({ kanal, kantor }: Props) {
    const links = activeLinks(kanal);
    const nasional = links.filter((l) => l.key !== 'internal');
    const internal = links.find((l) => l.key === 'internal');
    const balai = kantor.filter((k) => k.kode !== 'pusat').length;

    return (
        <TaraPage
            title="Katalog Pengaduan"
            description="Kanal pengaduan resmi serta alamat dan kontak Kantor Pusat Kementerian Transmigrasi dan balai transmigrasi di daerah."
            active="katalog"
            breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Katalog Pengaduan', href: '/katalog' }, { label: 'Kantor & Balai' }]}
            compact
            eyebrow="Kantor & Balai Layanan"
            heading={DIRECTORY_TITLE}
            subtitle="Datang langsung atau hubungi kantor terdekat dari lokasi Anda. Setiap kantor menerima pertanyaan dan aduan warga di wilayahnya."
            heroAside={
                <dl className="flex gap-3">
                    <Stat value={kantor.length - balai} label="Kantor pusat" />
                    <Stat value={balai} label="Balai daerah" />
                </dl>
            }
        >
            <div className="mx-auto flex max-w-[1312px] flex-col gap-16 px-4 py-14 sm:px-6 lg:px-16 lg:py-16">
                {(kanal.sosmed.aktif || links.length > 0) && (
                    <section aria-labelledby="kanal-resmi" className="flex flex-col gap-5">
                        <TaraEyebrow>
                            <span id="kanal-resmi">Kanal resmi</span>
                        </TaraEyebrow>

                        {kanal.sosmed.aktif && (
                            <article className="flex flex-col gap-5 rounded-[18px] border border-[#e6ebf0] bg-white p-6 sm:p-7">
                                <Heading icon={AtSign} title={kanal.sosmed.label} desc="Akun resmi dan kontak langsung Kementerian Transmigrasi." />
                                <SosmedList
                                    sosmed={kanal.sosmed}
                                    className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:[&>li:last-child]:col-span-2"
                                />
                            </article>
                        )}

                        {(nasional.length > 0 || internal) && (
                            <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
                                {nasional.length > 0 && (
                                    <article className="flex flex-col gap-5 rounded-[18px] bg-[#f1f5f9] p-5 sm:p-6">
                                        <Heading
                                            icon={Globe}
                                            title="Kanal Nasional"
                                            desc="Dikelola instansi nasional dan terhubung ke Kementerian Transmigrasi."
                                            solid
                                        />
                                        <div className="grid flex-1 gap-4 sm:grid-cols-2">
                                            {nasional.map(({ key, icon, item }) => (
                                                <LinkCard
                                                    key={key}
                                                    icon={icon}
                                                    item={item}
                                                    cta={key === 'kpk' ? 'Buka KWS KPK' : `Buka ${item.label}`}
                                                    logo={LOGO[key]}
                                                />
                                            ))}
                                        </div>
                                    </article>
                                )}
                                {internal && (
                                    <article className="flex flex-col gap-5 rounded-[18px] bg-[#f7f3ee] p-5 sm:p-6">
                                        <Heading
                                            icon={Briefcase}
                                            emblem="/images/brand/logo-kementrans.png"
                                            title="Kanal Aduan Pegawai Kementerian Transmigrasi"
                                            desc="Hanya untuk pegawai kementerian."
                                            tone="bronze"
                                        />
                                        <LinkCard icon={UserRound} item={internal.item} cta="Ajukan aduan" tone="bronze" />
                                    </article>
                                )}
                            </div>
                        )}
                    </section>
                )}

                <section aria-labelledby="kantor-balai" className="flex flex-col gap-8 lg:gap-14">
                    <div>
                        <TaraEyebrow>Kantor &amp; balai</TaraEyebrow>
                        <h2 id="kantor-balai" className="font-heading mt-2 text-[22px] leading-[1.33] font-bold text-[var(--t-deep)] sm:text-2xl">
                            Datang langsung ke kantor terdekat
                        </h2>
                    </div>
                    <KantorAccordion
                        offices={kantor}
                        aside={
                            <div className="hidden flex-col items-start gap-3 rounded-[20px] border border-[#ece6dc] bg-white p-5 lg:flex">
                                <TaraAvatar className="h-12 w-12" />
                                <p className="font-heading text-[17px] leading-[1.41] font-bold text-[var(--t-deep)]">Tidak perlu datang langsung?</p>
                                <p className="text-sm leading-relaxed text-[#4a5868]">
                                    Sebagian besar urusan bisa selesai lewat chat. TARA akan meneruskan ke balai yang tepat.
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => goToChat({ source: e.currentTarget })}
                                    className="transi-lift mt-1 flex h-11 items-center gap-2 rounded-full bg-[var(--t-gold)] px-5 font-semibold text-[var(--t-deep)] hover:bg-[#d0a552]"
                                >
                                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> Tanya TARA
                                </button>
                            </div>
                        }
                    />
                </section>
            </div>
        </TaraPage>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex w-[120px] flex-col-reverse gap-0.5 rounded-2xl border border-[#e3dccf] bg-white px-[18px] py-3.5">
            <dt className="text-[13.5px] leading-normal text-[#5b6b7a]">{label}</dt>
            <dd className="font-heading text-[30px] leading-tight font-bold text-[var(--t-deep)]">{value}</dd>
        </div>
    );
}

function Heading({
    icon: Icon,
    emblem,
    title,
    desc,
    solid = false,
    tone = 'navy',
}: {
    icon: LucideIcon;
    /** Gambar lambang menggantikan ikon (mis. lambang Kementerian). */
    emblem?: string;
    title: string;
    desc: string;
    solid?: boolean;
    tone?: 'navy' | 'bronze';
}) {
    return (
        <div className={'flex gap-3 ' + (solid || emblem ? 'items-center' : 'items-start gap-4')}>
            {emblem ? (
                <img src={emblem} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
            ) : (
                <span
                    className={
                        'flex shrink-0 items-center justify-center ' +
                        (solid ? 'h-9 w-9 rounded-full bg-[var(--t-navy)] text-white' : 'h-11 w-11 rounded-[10px] bg-[#eef3f8] text-[var(--t-navy)]')
                    }
                >
                    <Icon className={solid ? 'h-[18px] w-[18px]' : 'h-5 w-5'} aria-hidden="true" />
                </span>
            )}
            <div>
                <h3 className="font-heading text-lg leading-[1.33] font-bold text-[var(--t-deep)]">{title}</h3>
                <p className={(solid || emblem ? 'text-[13.5px] ' : 'mt-0.5 text-sm ') + (tone === 'bronze' ? 'text-[#4b3f30]' : 'text-[#5b6b7a]')}>
                    {desc}
                </p>
            </div>
        </div>
    );
}

function LinkCard({
    icon: Icon,
    item,
    cta,
    logo,
    tone = 'navy',
}: {
    icon: LucideIcon;
    item: KanalTautan & { url: string };
    cta: string;
    logo?: { src: string; width: number; height: number; replacesTitle?: boolean };
    tone?: 'navy' | 'bronze';
}) {
    const Arrow = item.url.startsWith('http') ? ArrowUpRight : ArrowRight;

    return (
        <div className="flex flex-1 flex-col gap-3 rounded-[14px] border border-[#e6ebf0] bg-white p-5">
            <div className="flex min-h-12 items-center gap-3">
                {logo ? (
                    <img src={logo.src} alt={logo.replacesTitle ? item.label : ''} width={logo.width} height={logo.height} className="shrink-0" />
                ) : (
                    <span
                        className={
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[var(--t-navy)] ' +
                            (tone === 'bronze' ? 'bg-[#f7f3ee]' : 'bg-[#eef3f8]')
                        }
                    >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                )}
                <h4 className={'font-heading text-lg leading-[1.33] font-bold text-[var(--t-deep)]' + (logo?.replacesTitle ? ' sr-only' : '')}>
                    {item.label}
                </h4>
            </div>
            {item.deskripsi && <p className="text-sm leading-[1.625] text-[#5b6b7a]">{item.deskripsi}</p>}
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#e6ebf0] pt-3.5">
                <a
                    href={item.url}
                    {...external(item.url)}
                    className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--t-deep)] hover:text-[var(--t-navy)] hover:underline"
                >
                    {cta} <Arrow className="h-4 w-4" aria-hidden="true" />
                </a>
                <span className="truncate text-[13px] text-[#5b6b7a]">{domain(item.url)}</span>
            </div>
        </div>
    );
}
