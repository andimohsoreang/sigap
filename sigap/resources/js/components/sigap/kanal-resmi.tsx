import {
    ArrowUpRight,
    AtSign,
    Briefcase,
    Building2,
    Clock,
    Facebook,
    Globe,
    Instagram,
    Mail,
    MapPin,
    Megaphone,
    MessageCircle,
    Music2,
    Navigation,
    Phone,
    ShieldAlert,
    Youtube,
    type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode, type SVGProps } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Strip "N kanal pengaduan resmi lainnya" di beranda. Isinya dari setting
 * `kanal_publik` (Admin → Pengaturan): Social Media dan Kantor membuka modal,
 * sisanya langsung ke URL. Kanal yang dinonaktifkan tidak ditampilkan.
 */

const KantorMap = lazy(() => import('@/components/sigap/kantor-map'));

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

const chipClass =
    'transi-lift flex items-center gap-2 rounded-[10px] bg-[#f6f8fa] px-3.5 py-2.5 text-sm font-medium text-[#2a3a48] hover:bg-[#eef3f7] hover:text-[var(--t-navy)]';

export default function KanalResmi({ kanal }: { kanal: KanalPublik }) {
    const [open, setOpen] = useState<'sosmed' | 'kantor' | null>(null);

    const links = activeLinks(kanal);

    const count = Number(kanal.sosmed.aktif) + Number(kanal.kantor.aktif) + links.length;
    if (count === 0) return null;

    return (
        <div data-reveal className="flex flex-col gap-5 rounded-[20px] border border-[#e8edf2] p-6 sm:p-8 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex items-center gap-3">
                <span className="font-heading text-5xl leading-none font-bold text-[var(--t-gold)]">{count}</span>
                <span className="text-[15px] leading-[1.3] font-semibold text-[var(--t-deep)]">
                    kanal pengaduan
                    <br />
                    resmi lainnya
                </span>
            </div>
            <span className="hidden h-12 w-px bg-[#e8edf2] lg:block" aria-hidden="true" />
            <ul className="flex flex-1 flex-wrap gap-2.5 lg:justify-between">
                {kanal.sosmed.aktif && (
                    <li>
                        <button type="button" onClick={() => setOpen('sosmed')} className={chipClass}>
                            <AtSign className="h-4 w-4 text-[var(--t-navy)]" aria-hidden="true" />
                            {kanal.sosmed.label}
                        </button>
                    </li>
                )}
                {kanal.kantor.aktif && (
                    <li>
                        <button type="button" onClick={() => setOpen('kantor')} className={chipClass}>
                            <Building2 className="h-4 w-4 text-[var(--t-navy)]" aria-hidden="true" />
                            {kanal.kantor.label}
                        </button>
                    </li>
                )}
                {links.map(({ key, icon: Icon, item }) => (
                    <li key={key}>
                        <a href={item.url} {...external(item.url)} className={chipClass}>
                            <Icon className="h-4 w-4 text-[var(--t-navy)]" aria-hidden="true" />
                            {item.label}
                        </a>
                    </li>
                ))}
            </ul>

            <Dialog open={open === 'sosmed'} onOpenChange={(v) => !v && setOpen(null)}>
                <DialogContent className="transi-page max-w-[calc(100%-32px)] rounded-[20px] border-[#e8edf2] bg-white p-6 sm:max-w-md sm:rounded-[20px]">
                    <DialogHeader className="text-left">
                        <DialogTitle className="font-heading text-xl text-[var(--t-deep)]">{kanal.sosmed.label}</DialogTitle>
                        <DialogDescription className="text-[#5b6b7a]">Akun resmi dan kontak langsung Kementerian Transmigrasi.</DialogDescription>
                    </DialogHeader>
                    <SosmedList sosmed={kanal.sosmed} />
                </DialogContent>
            </Dialog>

            <Dialog open={open === 'kantor'} onOpenChange={(v) => !v && setOpen(null)}>
                <DialogContent className="transi-page max-w-[calc(100%-32px)] gap-0 overflow-hidden rounded-[20px] border-[#e8edf2] bg-white p-0 sm:max-w-xl sm:rounded-[20px] [&>button:last-child]:rounded-full [&>button:last-child]:bg-white [&>button:last-child]:p-1.5 [&>button:last-child]:opacity-100 [&>button:last-child]:shadow-md">
                    <KantorMapPanel kantor={kanal.kantor} className="h-56 sm:h-64" />
                    <div className="space-y-4 p-6">
                        <DialogHeader className="text-left">
                            <DialogTitle className="font-heading text-xl text-[var(--t-deep)]">{kanal.kantor.nama}</DialogTitle>
                            <DialogDescription className="sr-only">Alamat lengkap dan lokasi kantor.</DialogDescription>
                        </DialogHeader>
                        <KantorInfo kantor={kanal.kantor} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
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

/** Peta pin kantor; tidak tampil bila koordinat kosong. */
export function KantorMapPanel({ kantor, className }: { kantor: KanalPublik['kantor']; className?: string }) {
    if (kantor.lat === null || kantor.lng === null) return null;

    return (
        <div className={`relative z-0 bg-[#eef3f7] ${className ?? ''}`}>
            <Suspense fallback={null}>
                <KantorMap lat={kantor.lat} lng={kantor.lng} />
            </Suspense>
        </div>
    );
}

/** Alamat, telepon, jam layanan, dan tombol Google Maps. */
export function KantorInfo({ kantor }: { kantor: KanalPublik['kantor'] }) {
    const query = kantor.lat !== null && kantor.lng !== null ? `${kantor.lat},${kantor.lng}` : kantor.alamat;

    return (
        <>
            <dl className="space-y-3 text-[15px] text-[#2a3a48]">
                <InfoRow icon={MapPin} label="Alamat">
                    {kantor.alamat}
                </InfoRow>
                {kantor.telepon && (
                    <InfoRow icon={Phone} label="Telepon">
                        <a href={`tel:${kantor.telepon.replace(/[^\d+]/g, '')}`} className="hover:text-[var(--t-navy)] hover:underline">
                            {kantor.telepon}
                        </a>
                    </InfoRow>
                )}
                {kantor.jam && (
                    <InfoRow icon={Clock} label="Jam layanan">
                        {kantor.jam}
                    </InfoRow>
                )}
            </dl>
            <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transi-lift font-heading inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[var(--t-navy)] px-5 text-[15px] font-semibold text-white hover:bg-[var(--t-deep)]"
            >
                <Navigation className="h-4 w-4" aria-hidden="true" /> Buka di Google Maps
            </a>
        </>
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

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
    return (
        <div className="flex gap-3">
            <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--t-navy)]" aria-hidden="true" />
            <div>
                <dt className="text-[13px] font-semibold text-[#5b6b7a]">{label}</dt>
                <dd>{children}</dd>
            </div>
        </div>
    );
}
