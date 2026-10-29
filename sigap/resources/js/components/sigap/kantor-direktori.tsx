import { Building2, ChevronDown, ChevronRight, Clock, Globe, Mail, MapPin, MessageCircle, Navigation, Phone, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';

import { PLATFORMS, waLink, type SosmedPlatform } from '@/components/sigap/kanal-resmi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Direktori Kantor Pusat & balai transmigrasi (PublicChannels::offices()).
 * Dipakai modal "Kantor" di beranda dan halaman Katalog → Kantor & Balai.
 */

const KantorMap = lazy(() => import('@/components/sigap/kantor-map'));

export type Kantor = {
    kode: string;
    jenis: string;
    provinsi: string;
    nama: string;
    singkat: string;
    lokasi: string;
    alamat: string;
    telepon: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
    sosmed: { platform: SosmedPlatform; nama: string; url: string }[];
    jam: string | null;
    lat: number | null;
    lng: number | null;
    maps: string;
};

export const DIRECTORY_TITLE = 'Kantor Kementerian Transmigrasi & Balai Transmigrasi';

/** Kantor Pusat memakai nama lengkap; balai memakai singkatan yang dikenal warga. */
const judul = (k: Kantor) => (k.kode === 'pusat' ? k.nama : k.singkat);

/** https://www.transmigrasi.go.id/bppmtdenpasar/ → transmigrasi.go.id/bppmtdenpasar */
const tampilUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** Ringkasan satu baris untuk akordeon tertutup. */
function ringkasan(k: Kantor): string {
    const kontak = k.telepon && k.telepon === k.whatsapp ? `${k.telepon} (Telepon & WA)` : k.telepon;
    return [k.lokasi, kontak, k.whatsapp && k.telepon !== k.whatsapp ? 'WhatsApp tersedia' : null].filter(Boolean).join(' · ');
}

export function KantorEyebrow({ kantor, small = false }: { kantor: Kantor; small?: boolean }) {
    return (
        <p className={cn('font-semibold text-[#9a7330] uppercase', small ? 'text-xs tracking-[1.4px]' : 'text-[12.5px] tracking-[1.5px]')}>
            {kantor.jenis} · {kantor.provinsi}
        </p>
    );
}

/** Daftar lokasi (kolom kiri modal & halaman). Di layar sempit bergulir mendatar. */
export function KantorList({ offices, selected, onSelect }: { offices: Kantor[]; selected: string | null; onSelect: (kode: string) => void }) {
    return (
        <div className="flex min-w-0 flex-col gap-3">
            <p className="px-1 text-[12.5px] font-semibold tracking-[1.5px] text-[#5b6b7a] uppercase">{offices.length} lokasi</p>
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
                {offices.map((k) => {
                    const active = k.kode === selected;
                    return (
                        <li key={k.kode} className="shrink-0 sm:shrink">
                            <button
                                type="button"
                                onClick={() => onSelect(k.kode)}
                                aria-current={active ? 'true' : undefined}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors',
                                    active ? 'border-[var(--t-navy)] bg-white shadow-sm' : 'border-transparent hover:bg-white/70',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]',
                                        active ? 'bg-[var(--t-navy)] text-white' : 'bg-white text-[var(--t-navy)]',
                                    )}
                                >
                                    <Building2 className="h-[18px] w-[18px]" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold whitespace-nowrap text-[var(--t-deep)] sm:whitespace-normal">
                                        {k.singkat}
                                    </span>
                                    <span className="block text-[13px] whitespace-nowrap text-[#5b6b7a] sm:whitespace-normal">{k.lokasi}</span>
                                </span>
                                {active && <ChevronRight className="hidden h-4 w-4 shrink-0 text-[var(--t-navy)] sm:block" aria-hidden="true" />}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** Alamat, kontak, media sosial, dan tombol aksi satu kantor. */
export function KantorDetail({ kantor }: { kantor: Kantor }) {
    return (
        <div className="flex flex-col gap-5">
            <dl className="divide-y divide-[#e8edf2] border-t border-[#e8edf2] text-[15px] text-[#2a3a48]">
                <Row icon={MapPin} label="Alamat">
                    {kantor.alamat}
                </Row>
                {kantor.telepon && (
                    <Row icon={Phone} label="Telepon">
                        <a href={`tel:${kantor.telepon.replace(/[^\d+]/g, '')}`} className="hover:text-[var(--t-navy)] hover:underline">
                            {kantor.telepon}
                        </a>
                    </Row>
                )}
                {kantor.whatsapp && (
                    <Row icon={MessageCircle} label="WhatsApp">
                        <a
                            href={waLink(kantor.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--t-navy)] hover:underline"
                        >
                            {kantor.whatsapp}
                        </a>
                    </Row>
                )}
                {kantor.email && (
                    <Row icon={Mail} label="Email">
                        <a href={`mailto:${kantor.email}`} className="break-all hover:text-[var(--t-navy)] hover:underline">
                            {kantor.email}
                        </a>
                    </Row>
                )}
                {kantor.website && (
                    <Row icon={Globe} label="Website">
                        <a
                            href={kantor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all hover:text-[var(--t-navy)] hover:underline"
                        >
                            {tampilUrl(kantor.website)}
                        </a>
                    </Row>
                )}
                {kantor.jam && (
                    <Row icon={Clock} label="Jam layanan">
                        {kantor.jam}
                    </Row>
                )}
            </dl>

            {kantor.sosmed.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <p className="text-[13.5px] font-semibold text-[#5b6b7a]">Media sosial</p>
                    <ul className="flex flex-wrap gap-2">
                        {kantor.sosmed.map((a) => {
                            const p = PLATFORMS[a.platform] ?? PLATFORMS.lainnya;
                            const Icon = p.icon;
                            return (
                                <li key={`${a.platform}-${a.url}`}>
                                    <a
                                        href={a.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 rounded-full border border-[#e3e8ee] px-3.5 py-2 text-sm font-medium text-[var(--t-deep)] hover:border-[var(--t-navy)] hover:bg-[#f6f8fa]"
                                    >
                                        <Icon className="h-4 w-4 text-[var(--t-navy)]" aria-hidden="true" />
                                        {a.nama}
                                        <span className="sr-only">({p.label}, membuka tab baru)</span>
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <a
                    href={kantor.maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transi-lift font-heading inline-flex h-11 items-center gap-2 rounded-full bg-[var(--t-navy)] px-5 text-[15px] font-semibold text-white hover:bg-[var(--t-deep)]"
                >
                    <Navigation className="h-4 w-4" aria-hidden="true" /> Buka di Google Maps
                </a>
                {kantor.whatsapp && (
                    <a
                        href={waLink(kantor.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transi-lift font-heading inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-[var(--t-navy)] px-5 text-[15px] font-semibold text-[var(--t-navy)] hover:bg-[#f2f6fa]"
                    >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" /> Chat WhatsApp
                    </a>
                )}
            </div>
        </div>
    );
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[18px_1fr] gap-x-3 gap-y-0.5 py-3.5 sm:grid-cols-[18px_104px_1fr]">
            <Icon className="mt-0.5 h-[18px] w-[18px] text-[var(--t-navy)]" aria-hidden="true" />
            <dt className="text-[13.5px] leading-[1.63] font-semibold text-[#5b6b7a]">{label}</dt>
            <dd className="col-start-2 min-w-0 text-[15px] leading-[1.47] text-[#2a3a48] sm:col-start-3">{children}</dd>
        </div>
    );
}

/** Peta pin kantor; tidak tampil bila koordinat kosong. */
export function KantorPeta({ kantor, className }: { kantor: Kantor; className?: string }) {
    if (kantor.lat === null || kantor.lng === null) return null;

    return (
        <div className={cn('relative z-0 overflow-hidden bg-[#eef3f7]', className)}>
            <Suspense fallback={null}>
                {/* key: Leaflet tidak memindah pusat peta saat prop berubah. */}
                <KantorMap key={kantor.kode} lat={kantor.lat} lng={kantor.lng} />
            </Suspense>
        </div>
    );
}

/** Modal direktori kantor (strip "Kantor" di beranda). */
export function KantorDirectoryDialog({ offices, open, onOpenChange }: { offices: Kantor[]; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [selected, setSelected] = useState(offices[0]?.kode ?? null);
    const kantor = offices.find((k) => k.kode === selected) ?? offices[0];
    if (!kantor) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="transi-page flex max-h-[calc(100dvh-32px)] max-w-[calc(100%-32px)] flex-col gap-0 overflow-hidden rounded-[22px] border-[#e8edf2] bg-white p-0 sm:max-w-[900px] sm:rounded-[22px] [&>button:last-child]:top-6 [&>button:last-child]:right-6 [&>button:last-child]:rounded-full [&>button:last-child]:bg-[#f1f4f7] [&>button:last-child]:p-2 [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-[#e6ebf0]">
                <DialogHeader className="border-b border-[#e8edf2] px-6 py-5 pr-16 text-left sm:px-8">
                    <DialogTitle className="font-heading text-xl leading-snug text-[var(--t-deep)] sm:text-[22px]">{DIRECTORY_TITLE}</DialogTitle>
                    <DialogDescription className="text-[15px] text-[#5b6b7a]">
                        Datang langsung atau hubungi kantor terdekat dari lokasi Anda.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:grid-cols-[300px_minmax(0,1fr)] sm:overflow-hidden">
                    <div className="min-w-0 border-b border-[#e8edf2] bg-[#f3f5f8] p-4 sm:overflow-y-auto sm:border-r sm:border-b-0 sm:p-5">
                        <KantorList offices={offices} selected={kantor.kode} onSelect={setSelected} />
                    </div>
                    <div className="flex min-w-0 flex-col gap-4 p-6 sm:overflow-y-auto sm:p-8" aria-live="polite">
                        <div>
                            <KantorEyebrow kantor={kantor} />
                            <h3 className="font-heading mt-1.5 text-[22px] leading-snug font-bold text-[var(--t-deep)]">{judul(kantor)}</h3>
                            {kantor.kode !== 'pusat' && <p className="mt-1 text-sm text-[#5b6b7a]">{kantor.nama}</p>}
                        </div>
                        <KantorDetail kantor={kantor} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Akordeon kantor di halaman Kantor & Balai: satu kantor terbuka lengkap
 * dengan peta, sisanya ringkas. Pilihan di daftar kiri membuka & menggulir.
 */
export function KantorAccordion({ offices, aside }: { offices: Kantor[]; aside?: ReactNode }) {
    const [open, setOpen] = useState<string | null>(offices[0]?.kode ?? null);
    const refs = useRef<Record<string, HTMLElement | null>>({});

    const pick = (kode: string) => {
        setOpen(kode);
        requestAnimationFrame(() => refs.current[kode]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    };

    return (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
            <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24">
                <div className="rounded-[20px] border border-[#e6ebf0] bg-[#f2f5f8] p-4">
                    <KantorList offices={offices} selected={open} onSelect={pick} />
                </div>
                {aside}
            </div>

            <ul className="flex min-w-0 flex-col gap-4">
                {offices.map((k) => {
                    const expanded = k.kode === open;
                    const panelId = `kantor-${k.kode}`;
                    return (
                        <li
                            key={k.kode}
                            ref={(el) => {
                                refs.current[k.kode] = el;
                            }}
                            className={cn(
                                'scroll-mt-24 overflow-hidden rounded-[20px] border bg-white transition-shadow',
                                expanded ? 'border-[var(--t-navy)] shadow-[0_8px_24px_rgba(2,43,74,0.08)]' : 'border-[#e6ebf0]',
                            )}
                        >
                            {expanded ? (
                                <div id={panelId} className="grid lg:grid-cols-[1fr_300px]">
                                    <div className="flex min-w-0 flex-col gap-5 p-6 sm:p-8">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <KantorEyebrow kantor={k} />
                                                <h3 className="font-heading mt-1.5 text-[22px] leading-[1.25] font-bold text-[var(--t-deep)] sm:text-2xl">
                                                    {judul(k)}
                                                </h3>
                                                {k.kode !== 'pusat' && <p className="mt-1 text-sm text-[#5b6b7a]">{k.nama}</p>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setOpen(null)}
                                                aria-expanded="true"
                                                aria-controls={panelId}
                                                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--t-navy)] pr-3 pl-4 text-sm font-semibold text-white hover:bg-[var(--t-deep)]"
                                            >
                                                Tutup <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                                            </button>
                                        </div>
                                        <KantorDetail kantor={k} />
                                    </div>
                                    <KantorPeta kantor={k} className="h-64 lg:h-auto lg:min-h-[522px]" />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => pick(k.kode)}
                                    aria-expanded="false"
                                    className="flex w-full items-center gap-4 px-5 py-5 text-left hover:bg-[#fafbfc] sm:px-6"
                                >
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef3f8] text-[var(--t-navy)]">
                                        <Building2 className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                                        <KantorEyebrow kantor={k} small />
                                        <span className="font-heading block text-lg leading-[1.3] font-bold text-[var(--t-deep)] sm:text-xl">
                                            {judul(k)}
                                        </span>
                                        <span className="block text-sm text-[#5b6b7a]">{ringkasan(k)}</span>
                                    </span>
                                    <span className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--t-navy)] pr-2.5 pl-3.5 text-sm font-semibold text-[var(--t-navy)] sm:flex">
                                        Lihat detail <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                                    </span>
                                    <ChevronDown className="h-5 w-5 shrink-0 text-[#5b6b7a] sm:hidden" aria-hidden="true" />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
