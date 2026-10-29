import { ArrowRight, ArrowUpRight, AtSign, Briefcase, Landmark, type LucideIcon, MessageCircle } from 'lucide-react';

import { activeLinks, external, type KanalPublik, type KanalTautan, SosmedList } from '@/components/sigap/kanal-resmi';
import { DIRECTORY_TITLE, type Kantor, KantorAccordion } from '@/components/sigap/kantor-direktori';
import TaraPage, { TaraAvatar, TaraEyebrow } from '@/components/sigap/tara-shell';
import { goToChat } from '@/lib/chat-transition';

interface Props {
    kanal: KanalPublik;
    kantor: Kantor[];
}

/** https://sp4n.lapor.go.id/instansi/... → sp4n.lapor.go.id; path internal → Formulir SIGAP */
const domain = (url: string) => (url.startsWith('/') ? 'Formulir SIGAP' : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);

export default function KantorBalai({ kanal, kantor }: Props) {
    const links = activeLinks(kanal);
    const nasional = links.filter((l) => l.key !== 'internal');
    const internal = links.find((l) => l.key === 'internal');
    const balai = kantor.filter((k) => k.kode !== 'pusat').length;

    return (
        <TaraPage
            title="Kantor & Balai"
            description="Alamat, kontak, dan lokasi Kantor Pusat Kementerian Transmigrasi serta balai transmigrasi di daerah."
            active="katalog"
            breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Katalog Pengaduan', href: '/katalog' }, { label: 'Kantor & Balai' }]}
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
                                            icon={Landmark}
                                            title="Kanal Nasional"
                                            desc="Dikelola instansi nasional dan terhubung ke Kementerian Transmigrasi."
                                            solid
                                        />
                                        <div className="grid flex-1 gap-4 sm:grid-cols-2">
                                            {nasional.map(({ key, icon, item }) => (
                                                <LinkCard key={key} icon={icon} item={item} cta={`Buka ${item.label}`} />
                                            ))}
                                        </div>
                                    </article>
                                )}
                                {internal && (
                                    <article className="flex flex-col gap-5 rounded-[18px] bg-[#f7f3ee] p-5 sm:p-6">
                                        <Heading
                                            icon={Briefcase}
                                            title="Kanal Aduan Pegawai Kementerian Transmigrasi"
                                            desc="Hanya untuk pegawai kementerian."
                                            tone="bronze"
                                        />
                                        <LinkCard icon={internal.icon} item={internal.item} cta="Ajukan aduan" />
                                    </article>
                                )}
                            </div>
                        )}
                    </section>
                )}

                <section aria-labelledby="kantor-balai" className="flex flex-col gap-6">
                    <div>
                        <TaraEyebrow>Kantor &amp; balai</TaraEyebrow>
                        <h2 id="kantor-balai" className="font-heading mt-2 text-[26px] font-bold text-[var(--t-deep)] sm:text-[30px]">
                            Datang langsung ke kantor terdekat
                        </h2>
                    </div>
                    <KantorAccordion
                        offices={kantor}
                        aside={
                            <div className="hidden flex-col items-start gap-3 rounded-[18px] border border-[#ece6dc] bg-white p-5 lg:flex">
                                <TaraAvatar className="h-12 w-12" />
                                <p className="font-heading text-lg font-bold text-[var(--t-deep)]">Tidak perlu datang langsung?</p>
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
        <div className="flex min-w-[108px] flex-col-reverse rounded-[14px] border border-[#ece6dc] bg-white px-4 py-3">
            <dt className="mt-1.5 text-[13px] text-[#6b5d4a]">{label}</dt>
            <dd className="font-heading text-[28px] leading-none font-bold text-[var(--t-deep)]">{value}</dd>
        </div>
    );
}

function Heading({
    icon: Icon,
    title,
    desc,
    solid = false,
    tone = 'navy',
}: {
    icon: LucideIcon;
    title: string;
    desc: string;
    solid?: boolean;
    tone?: 'navy' | 'bronze';
}) {
    return (
        <div className="flex items-start gap-3.5">
            <span
                className={
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full ' +
                    (solid ? 'bg-[var(--t-navy)] text-white' : tone === 'bronze' ? 'bg-white text-[#9a7330]' : 'bg-[#eef3f8] text-[var(--t-navy)]')
                }
            >
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
                <h3 className="font-heading text-lg leading-snug font-bold text-[var(--t-deep)]">{title}</h3>
                <p className="mt-0.5 text-sm text-[#5b6b7a]">{desc}</p>
            </div>
        </div>
    );
}

function LinkCard({ icon: Icon, item, cta }: { icon: LucideIcon; item: KanalTautan & { url: string }; cta: string }) {
    const Arrow = item.url.startsWith('http') ? ArrowUpRight : ArrowRight;

    return (
        <div className="flex flex-1 flex-col rounded-[14px] bg-white p-5">
            <p className="font-heading flex items-center gap-2.5 text-[17px] font-bold text-[var(--t-deep)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#eef3f8]">
                    <Icon className="h-[18px] w-[18px] text-[var(--t-navy)]" aria-hidden="true" />
                </span>
                {item.label}
            </p>
            {item.deskripsi && <p className="mt-3 flex-1 text-sm leading-relaxed text-[#5b6b7a]">{item.deskripsi}</p>}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e6ebf0] pt-4">
                <a
                    href={item.url}
                    {...external(item.url)}
                    className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--t-deep)] hover:text-[var(--t-navy)]"
                >
                    {cta} <Arrow className="h-4 w-4" aria-hidden="true" />
                </a>
                <span className="truncate text-xs text-[#8a96a3]">{domain(item.url)}</span>
            </div>
        </div>
    );
}
