import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { House, Map as MapIcon, MapPinned, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import TaraPage from '@/components/sigap/tara-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Point {
    id: number;
    code: string;
    name: string;
    province: string | null;
    latitude: number;
    longitude: number;
    infrastructure_status: string | null;
    kk_count: number;
}

interface Props {
    regions: number;
    points: Point[];
}

const HOUSE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Pin kawasan: lingkaran navy berikon rumah + label nama; pin terpilih berwarna emas. */
function pinIcon(name: string, selected: boolean): L.DivIcon {
    return L.divIcon({
        className: 'tara-pin',
        html: `<div class="tara-pin__wrap${selected ? ' is-selected' : ''}"><span class="tara-pin__dot">${HOUSE_SVG}</span><span class="tara-pin__label">${escapeHtml(name)}</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -22],
    });
}

function statusTone(status: string | null): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('memadai') || s.includes('baik')) return 'bg-[#e7f4ef] text-[#0d7a5f]';
    if (s.includes('berkembang') || s.includes('sedang')) return 'bg-[#fdf3e1] text-[#9a5b00]';
    if (s.includes('kurang') || s.includes('rusak')) return 'bg-[#fdecea] text-[#b42318]';
    return 'bg-[#eef1f4] text-[#4a5868]';
}

/** Memusatkan peta ke kawasan terpilih atau ke seluruh titik yang tampil. */
function FitView({ points, selected }: { points: Point[]; selected: Point | null }) {
    const map = useMap();
    useEffect(() => {
        if (selected) {
            map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 7), { duration: 0.8 });
            return;
        }
        if (points.length === 0) return;
        const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
    }, [map, points, selected]);
    return null;
}

export default function Peta({ regions, points }: Props) {
    const [mounted, setMounted] = useState(false);
    const [province, setProvince] = useState('all');
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => setMounted(true), []);

    const provinces = useMemo(() => Array.from(new Set(points.map((p) => p.province).filter(Boolean))) as string[], [points]);
    const filtered = useMemo(() => (province === 'all' ? points : points.filter((p) => p.province === province)), [points, province]);
    const selected = filtered.find((p) => p.id === selectedId) ?? null;
    const totalKk = points.reduce((s, p) => s + p.kk_count, 0);

    const selectProvince = (v: string) => {
        setProvince(v);
        setSelectedId(null);
    };

    return (
        <TaraPage
            title="Peta Kawasan"
            description="Peta kawasan transmigrasi yang dilayani SIGAP."
            active="peta"
            eyebrow="Peta Kawasan"
            heading="Peta Kawasan Transmigrasi"
            subtitle={
                <span className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium text-[var(--t-deep)]">
                    <span className="flex items-center gap-2">
                        <MapPinned className="h-5 w-5 text-[#9a7330]" aria-hidden="true" /> {regions.toLocaleString('id-ID')} Kawasan Transmigrasi
                    </span>
                    <span className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#9a7330]" aria-hidden="true" /> {totalKk.toLocaleString('id-ID')} KK
                    </span>
                </span>
            }
            heroAside={
                <div className="w-full lg:w-[300px]">
                    <label className="mb-2 block text-sm font-semibold text-[var(--t-deep)]">Kawasan / Wilayah</label>
                    <Select value={province} onValueChange={selectProvince}>
                        <SelectTrigger className="h-[52px] gap-2.5 rounded-full border-[#e6ded1] bg-white px-5 text-[15px] font-medium text-[var(--t-deep)] [&>span]:flex-1 [&>span]:text-left">
                            <MapIcon className="h-[18px] w-[18px] shrink-0 text-[var(--t-navy)]" aria-hidden="true" />
                            <SelectValue placeholder="Semua Wilayah" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Wilayah</SelectItem>
                            {provinces.map((p) => (
                                <SelectItem key={p} value={p}>
                                    {p}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            }
        >
            <div className="mx-auto flex max-w-[1312px] flex-col gap-6 px-4 py-12 sm:px-6 lg:px-16 lg:py-14">
                <div className="tara-map overflow-hidden rounded-[24px] border border-[#e6ebf0] bg-[#aad3df]">
                    {mounted ? (
                        <MapContainer center={[-2.5, 118]} zoom={5} scrollWheelZoom={false} className="h-[420px] w-full sm:h-[560px] lg:h-[640px]">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FitView points={filtered} selected={selected} />
                            {filtered.map((p) => (
                                <Marker
                                    key={`${p.id}-${p.id === selectedId}`}
                                    position={[p.latitude, p.longitude]}
                                    icon={pinIcon(p.name, p.id === selectedId)}
                                    eventHandlers={{ click: () => setSelectedId(p.id) }}
                                >
                                    <Popup className="tara-popup" closeButton={false}>
                                        <p className="font-heading text-lg font-bold text-[var(--t-deep)]">{p.name}</p>
                                        <p className="text-sm text-[#5b6b7a]">{p.province ?? '—'}</p>
                                        <p className="mt-3 flex items-center gap-3">
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold',
                                                    statusTone(p.infrastructure_status),
                                                )}
                                            >
                                                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                                                {p.infrastructure_status ?? 'Belum dinilai'}
                                            </span>
                                            <span className="text-sm font-semibold text-[var(--t-deep)]">
                                                {p.kk_count.toLocaleString('id-ID')} KK
                                            </span>
                                        </p>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    ) : (
                        <div className="flex h-[420px] items-center justify-center text-[#5b6b7a] sm:h-[560px] lg:h-[640px]">Memuat peta…</div>
                    )}
                </div>

                {filtered.length > 0 ? (
                    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((p) => {
                            const active = p.id === selectedId;
                            return (
                                <li key={p.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(p.id)}
                                        aria-pressed={active}
                                        className={cn(
                                            'flex w-full items-center gap-4 rounded-[20px] border p-5 text-left transition-colors',
                                            active ? 'border-[var(--t-gold)] bg-[#f7f3ee]' : 'border-[#e6ebf0] bg-white hover:border-[#cdd6df]',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                                                active ? 'bg-[var(--t-gold)] text-[var(--t-deep)]' : 'bg-[#eef3f8] text-[var(--t-navy)]',
                                            )}
                                        >
                                            <House className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-mono text-[13px] font-semibold text-[#9a7330]">{p.code}</span>
                                            <span className="font-heading block truncate text-lg font-bold text-[var(--t-deep)]">{p.name}</span>
                                            <span className="block text-sm text-[#5b6b7a]">
                                                {p.province ?? '—'} · {p.kk_count.toLocaleString('id-ID')} KK
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                'hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold sm:inline-flex lg:hidden xl:inline-flex',
                                                statusTone(p.infrastructure_status),
                                            )}
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                                            {p.infrastructure_status ?? 'Belum dinilai'}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="text-center text-[#5b6b7a]">Belum ada kawasan dengan koordinat di wilayah ini.</p>
                )}
            </div>
        </TaraPage>
    );
}
