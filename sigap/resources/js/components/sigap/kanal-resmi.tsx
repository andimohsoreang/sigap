import {
    ArrowRight,
    ArrowUpRight,
    AtSign,
    Briefcase,
    Building2,
    Facebook,
    Globe,
    Instagram,
    Mail,
    Megaphone,
    MessageCircle,
    Music2,
    ShieldAlert,
    Youtube,
    type LucideIcon,
} from 'lucide-react';
import { useState, type CSSProperties, type SVGProps } from 'react';

import { KantorDirectoryDialog, type Kantor } from '@/components/sigap/kantor-direktori';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Strip "N kanal pengaduan resmi lainnya" di beranda. Isinya dari setting
 * `kanal_publik` (Admin → Pengaturan): Social Media dan Kantor membuka modal,
 * sisanya langsung ke URL. Kanal yang dinonaktifkan tidak ditampilkan.
 */

export type SosmedPlatform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'youtube' | 'lainnya';

export type KanalPublik = {
    sosmed: {
        aktif: boolean;
        label: string;
        email: string | null;
        whatsapp: string | null;
        akun: { platform: SosmedPlatform; nama: string; url: string }[];
    };
    kantor: {
        aktif: boolean;
        label: string;
        nama: string;
        alamat: string;
        telepon: string | null;
        jam: string | null;
        lat: number | null;
        lng: number | null;
    };
    lapor: KanalTautan;
    kpk: KanalTautan;
    internal: KanalTautan;
};

export type KanalTautan = {
    aktif: boolean;
    label: string;
    url: string | null;
    deskripsi: string | null;
};

function XLogo(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79zm-1.08 16.17h1.7L7.4 4.73H5.58z" />
        </svg>
    );
}

export const PLATFORMS: Record<SosmedPlatform, { label: string; icon: LucideIcon | typeof XLogo }> = {
    instagram: { label: 'Instagram', icon: Instagram },
    facebook: { label: 'Facebook', icon: Facebook },
    x: { label: 'X (Twitter)', icon: XLogo },
    tiktok: { label: 'TikTok', icon: Music2 },
    youtube: { label: 'YouTube', icon: Youtube },
    lainnya: { label: 'Lainnya', icon: Globe },
};

/** 0812-9001-9358 → https://wa.me/6281290019358 */
export function waLink(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/${digits.startsWith('0') ? `62${digits.slice(1)}` : digits}`;
}

/** Kanal tautan langsung yang aktif dan punya URL, urut tampilan. */
export function activeLinks(kanal: KanalPublik): { key: string; icon: LucideIcon; item: KanalTautan & { url: string } }[] {
    return (
        [
            { key: 'lapor', icon: Megaphone, item: kanal.lapor },
            { key: 'kpk', icon: ShieldAlert, item: kanal.kpk },
            { key: 'internal', icon: Briefcase, item: kanal.internal },
        ] as { key: string; icon: LucideIcon; item: KanalTautan }[]
    ).filter((l): l is { key: string; icon: LucideIcon; item: KanalTautan & { url: string } } => l.item.aktif && Boolean(l.item.url));
}

export const external = (url: string) => (url.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {});

/** Label tombol singkat sesuai desain; kanal lain memakai "Buka <nama>". */
const CTA: Record<string, string> = { lapor: 'Buka LAPOR!', kpk: 'Buka KWS KPK', internal: 'Ajukan aduan' };

type KanalKartu = { key: string; icon: LucideIcon; title: string; desc: string; cta: string } & (
    | { href: string; onClick?: never }
    | { onClick: () => void; href?: never }
);

/**
 * Bagian "Kanal pengaduan resmi" di beranda (desain Wonder "SIGAP Beranda Hero
 * Makarti"): satu kartu per kanal aktif. Social Media dan Kantor membuka
 * modal; kanal lain langsung ke URL-nya.
 */
export default function KanalResmi({ kanal, kantor }: { kanal: KanalPublik; kantor: Kantor[] }) {
    const [open, setOpen] = useState<'sosmed' | 'kantor' | null>(null);

    const cards: KanalKartu[] = [
        ...(kanal.sosmed.aktif
            ? [
                  {
                      key: 'sosmed',
                      icon: AtSign,
                      title: kanal.sosmed.label,
                      desc: 'Kirim pesan langsung ke akun resmi Kementerian Transmigrasi.',
                      cta: 'Lihat akun',
                      onClick: () => setOpen('sosmed'),
                  },
              ]
            : []),
        ...(kanal.kantor.aktif && kantor.length > 0
            ? [
                  {
                      key: 'kantor',
                      icon: Building2,
                      title: kanal.kantor.label,
                      desc: 'Datang ke kantor pusat atau balai transmigrasi, Senin–Jumat 08.00–16.00 WIB.',
                      cta: 'Lihat alamat',
                      onClick: () => setOpen('kantor'),
                  },
              ]
            : []),
        ...activeLinks(kanal).map(({ key, icon, item }) => ({
            key,
            icon,
            title: item.label,
            desc: item.deskripsi ?? '',
            cta: CTA[key] ?? `Buka ${item.label}`,
            href: item.url,
        })),
    ];
    if (cards.length === 0) return null;

    return (
        <section aria-labelledby="kanal-pengaduan" className="bg-[#f2f5f8] py-14 sm:py-24">
            <div className="mx-auto flex max-w-[1312px] flex-col gap-10 px-4 sm:px-6 lg:px-16">
                <div data-reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                    <div className="flex flex-col gap-3">
                        <p className="text-xs font-semibold tracking-[0.12em] text-[#87652a] uppercase sm:text-[12.5px]">Kanal pengaduan resmi</p>
                        <h2
                            id="kanal-pengaduan"
                            className="font-heading text-[30px] leading-[1.2] font-bold tracking-[-0.015em] text-balance text-[var(--t-deep)] sm:text-[40px]"
                        >
                            Sampaikan aduan lewat kanal pilihan Anda
                        </h2>
                        <p className="max-w-[780px] text-base leading-[1.65] text-[#4a5a68] sm:text-[17px]">
                            Aduan dari kanal berikut dicatat, diteruskan ke unit terkait, dan dipantau sampai tuntas.
                        </p>
                    </div>
                    <p className="flex shrink-0 items-center gap-3.5">
                        <span className="font-heading text-5xl leading-none font-bold tracking-[-1.68px] text-[#87652a] sm:text-[56px]">
                            {cards.length}
                        </span>
                        <span className="w-[110px] text-[15px] leading-[1.33] font-semibold text-[var(--t-deep)]">kanal resmi selain chat</span>
                    </p>
                </div>

                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {cards.map((c, i) => {
                        const Arrow = c.href?.startsWith('http') ? ArrowUpRight : ArrowRight;
                        const body = (
                            <>
                                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f2f5f8] text-[var(--t-navy)] transition-colors group-hover:bg-[var(--t-navy)] group-hover:text-white">
                                    <c.icon className="h-[22px] w-[22px]" aria-hidden="true" />
                                </span>
                                <span className="font-heading mt-5 block min-h-11 text-[17px] leading-[1.3] font-bold text-[var(--t-deep)]">
                                    {c.title}
                                </span>
                                <span className="mt-2 block text-[14.5px] leading-[1.52] text-[#4a5a68]">{c.desc}</span>
                                <span className="mt-auto flex h-10 items-center gap-1.5 pt-4 text-[14.5px] font-semibold text-[var(--t-navy)]">
                                    {c.cta}
                                    <Arrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                                </span>
                            </>
                        );
                        const cls =
                            'group flex h-full min-h-[260px] w-full flex-col rounded-[18px] border border-[#e8edf2] bg-white p-6 text-left transition-shadow hover:shadow-[0_12px_30px_rgba(2,43,74,0.08)]';

                        return (
                            <li key={c.key} data-reveal style={{ '--d': `${0.05 * i}s` } as CSSProperties}>
                                {c.href ? (
                                    <a href={c.href} {...external(c.href)} className={cls}>
                                        {body}
                                    </a>
                                ) : (
                                    <button type="button" onClick={c.onClick} className={cls}>
                                        {body}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <Dialog open={open === 'sosmed'} onOpenChange={(v) => !v && setOpen(null)}>
                <DialogContent className="transi-page max-w-[calc(100%-32px)] rounded-[20px] border-[#e8edf2] bg-white p-6 sm:max-w-md sm:rounded-[20px]">
                    <DialogHeader className="text-left">
                        <DialogTitle className="font-heading text-xl text-[var(--t-deep)]">{kanal.sosmed.label}</DialogTitle>
                        <DialogDescription className="text-[#5b6b7a]">Akun resmi dan kontak langsung Kementerian Transmigrasi.</DialogDescription>
                    </DialogHeader>
                    <SosmedList sosmed={kanal.sosmed} />
                </DialogContent>
            </Dialog>

            <KantorDirectoryDialog offices={kantor} open={open === 'kantor'} onOpenChange={(v) => !v && setOpen(null)} />
        </section>
    );
}

/** Daftar akun media sosial, email, dan Hotline WhatsApp. */
export function SosmedList({ sosmed, className = 'space-y-2' }: { sosmed: KanalPublik['sosmed']; className?: string }) {
    return (
        <ul className={className}>
            {sosmed.akun.map((a) => {
                const p = PLATFORMS[a.platform] ?? PLATFORMS.lainnya;
                return <ContactRow key={`${a.platform}-${a.url}`} href={a.url} icon={p.icon} title={a.nama} hint={p.label} />;
            })}
            {sosmed.email && <ContactRow href={`mailto:${sosmed.email}`} icon={Mail} title={sosmed.email} hint="Email" />}
            {sosmed.whatsapp && (
                <ContactRow href={waLink(sosmed.whatsapp)} icon={MessageCircle} title={sosmed.whatsapp} hint="Hotline WhatsApp" highlight />
            )}
        </ul>
    );
}

function ContactRow({
    href,
    icon: Icon,
    title,
    hint,
    highlight = false,
}: {
    href: string;
    icon: LucideIcon | typeof XLogo;
    title: string;
    hint: string;
    highlight?: boolean;
}) {
    return (
        <li>
            <a
                href={href}
                {...external(href)}
                className={
                    'group flex items-center gap-3 rounded-[12px] border px-4 py-3 transition-colors ' +
                    (highlight ? 'border-[#cfe9de] bg-[#eef8f3] hover:bg-[#e3f3eb]' : 'border-[#e8edf2] hover:bg-[#f6f8fa]')
                }
            >
                <span
                    className={
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
                        (highlight ? 'bg-[#0d7a5f] text-white' : 'bg-[#eef3f7] text-[var(--t-navy)]')
                    }
                >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[var(--t-deep)]" title={title}>
                        {title}
                    </span>
                    <span className="block text-[13px] text-[#5b6b7a]">{hint}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8a96a3] group-hover:text-[var(--t-navy)]" aria-hidden="true" />
            </a>
        </li>
    );
}
