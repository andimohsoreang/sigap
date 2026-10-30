import type { Feature, FeatureCollection, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Minus, Plus, RotateCcw } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, useMap } from 'react-leaflet';

import { cn } from '@/lib/utils';

/**
 * Peta sebaran per provinsi (choropleth) tanpa tile luar: provinsi diwarnai
 * menurut `total`, tooltip saat disorot, klik untuk memilih. Batas 38 provinsi
 * dari /geo/indonesia-provinsi.geojson (properti `provinsi`), turunan
 * OpenStreetMap berlisensi ODbL — atribusi wajib tampil (lihat
 * public/geo/README-ATTRIBUTION.txt).
 */

export interface ProvinceDatum {
    provinsi: string;
    total: number;
}

type ProvinceFeature = Feature<Geometry, { provinsi: string }>;

const GEO_URL = '/geo/indonesia-provinsi.geojson';
const INDONESIA: L.LatLngBoundsExpression = [
    [-11.2, 94.8],
    [6.4, 141.1],
];
/** Skala warna amber, dari sedikit ke banyak; 0 pengaduan = putih. */
const SCALE = ['#f7dd97', '#f1c865', '#e8b13a', '#d6971a', '#b07600'];

const ALIASES: Record<string, string> = {
    jakarta: 'dki jakarta',
    'daerah khusus ibukota jakarta': 'dki jakarta',
    yogyakarta: 'di yogyakarta',
    'daerah istimewa yogyakarta': 'di yogyakarta',
    'bangka belitung': 'kepulauan bangka belitung',
    'kep bangka belitung': 'kepulauan bangka belitung',
    'kep riau': 'kepulauan riau',
    'nanggroe aceh darussalam': 'aceh',
};

/** Nama provinsi pembanding: huruf kecil, tanpa "provinsi"/tanda baca, alias umum. */
export function normaliseProvince(name: string): string {
    const n = name
        .toLowerCase()
        .replace(/^prov(insi|\.)?\s+/, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return ALIASES[n] ?? n;
}

let geoCache: Promise<FeatureCollection<Geometry, { provinsi: string }>> | null = null;
function loadGeo() {
    geoCache ??= fetch(GEO_URL).then((r) => {
        if (!r.ok) throw new Error(`Peta provinsi tidak dapat dimuat (${r.status}).`);
        return r.json();
    });
    return geoCache;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function Controls() {
    const map = useMap();
    const button = 'flex h-10 w-10 items-center justify-center text-[#33414e] hover:bg-[#f1f4f7]';

    return (
        <div className="absolute top-3 right-3 z-[500] flex flex-col overflow-hidden rounded-xl border border-[#e3e8ee] bg-white shadow-sm">
            <button type="button" className={button} onClick={() => map.zoomIn()} aria-label="Perbesar">
                <Plus className="h-4 w-4" />
            </button>
            <button type="button" className={cn(button, 'border-y border-[#e3e8ee]')} onClick={() => map.zoomOut()} aria-label="Perkecil">
                <Minus className="h-4 w-4" />
            </button>
            <button type="button" className={button} onClick={() => map.fitBounds(INDONESIA)} aria-label="Kembali ke seluruh Indonesia">
                <RotateCcw className="h-4 w-4" />
            </button>
        </div>
    );
}

function Scale() {
    const map = useMap();
    useEffect(() => {
        const scale = L.control.scale({ metric: true, imperial: false, position: 'topleft' }).addTo(map);
        return () => {
            scale.remove();
        };
    }, [map]);
    return null;
}

export default function ProvinceMap<T extends ProvinceDatum>({
    data,
    selected,
    onSelect,
    tooltip,
    hint,
    className,
}: {
    data: T[];
    /** Nama provinsi terpilih (seperti di data), atau null = nasional. */
    selected: string | null;
    onSelect?: (provinsi: string) => void;
    /** Isi tooltip untuk provinsi; `datum` null bila belum ada pengaduan. */
    tooltip: (name: string, datum: T | null) => ReactNode;
    /** Baris bawah tooltip, mis. "Klik untuk menyaring wilayah ini". */
    hint?: string;
    className?: string;
}) {
    const [geo, setGeo] = useState<FeatureCollection<Geometry, { provinsi: string }> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadGeo().then(setGeo, (e: Error) => setError(e.message));
    }, []);

    const byName = useMemo(() => new Map(data.map((d) => [normaliseProvince(d.provinsi), d])), [data]);
    const max = Math.max(0, ...data.map((d) => d.total));
    const selectedKey = selected ? normaliseProvince(selected) : null;
    const unmapped = useMemo(() => {
        if (!geo) return [];
        const names = new Set(geo.features.map((f) => normaliseProvince(f.properties.provinsi)));
        return data.filter((d) => d.total > 0 && !names.has(normaliseProvince(d.provinsi)));
    }, [geo, data]);

    const fill = (total: number) =>
        total <= 0 || max === 0 ? '#ffffff' : SCALE[Math.min(SCALE.length - 1, Math.floor((total / max) * SCALE.length - 1e-9))];

    const style = (feature?: ProvinceFeature): L.PathOptions => {
        const key = normaliseProvince(feature?.properties.provinsi ?? '');
        const datum = byName.get(key);
        const isSelected = key === selectedKey;
        return {
            fillColor: fill(datum?.total ?? 0),
            fillOpacity: selectedKey && !isSelected ? 0.55 : 1,
            color: isSelected ? '#17232f' : '#94a3b8',
            weight: isSelected ? 2.2 : 0.7,
        };
    };

    const onEachFeature = (feature: ProvinceFeature, layer: L.Layer) => {
        const name = feature.properties.provinsi;
        const datum = byName.get(normaliseProvince(name)) ?? null;
        const path = layer as L.Path;
        if (datum && datum.total > 0) {
            path.bindTooltip(escapeHtml(name), { permanent: true, direction: 'center', className: 'prov-label', interactive: false });
        }
        const position = (e: L.LeafletMouseEvent) => {
            const rect = box.current?.getBoundingClientRect();
            if (rect) setHover({ name, x: e.originalEvent.clientX - rect.left, y: e.originalEvent.clientY - rect.top });
        };
        path.on({
            mouseover: (e: L.LeafletMouseEvent) => {
                path.setStyle({ weight: 2, color: '#17232f' });
                path.bringToFront();
                position(e);
            },
            mousemove: position,
            mouseout: () => {
                path.setStyle(style(feature));
                setHover(null);
            },
            click: () => onSelect?.(datum?.provinsi ?? name),
        });
    };

    const hovered = hover ? (byName.get(normaliseProvince(hover.name)) ?? null) : null;
    const width = box.current?.clientWidth ?? 0;

    return (
        <div className={cn('relative', className)}>
            <div ref={box} className="province-map relative h-[360px] overflow-hidden rounded-2xl border border-[#dbe5ef] sm:h-[460px] lg:h-[520px]">
                {geo ? (
                    <MapContainer
                        bounds={INDONESIA}
                        zoomSnap={0.25}
                        minZoom={3.5}
                        maxZoom={9}
                        scrollWheelZoom={false}
                        zoomControl={false}
                        attributionControl={false}
                        className="h-full w-full !bg-transparent"
                    >
                        {/* Kunci berubah saat data/pilihan berubah agar gaya & label dirender ulang. */}
                        <GeoJSON
                            key={`${selectedKey ?? 'nasional'}-${data.map((d) => `${d.provinsi}:${d.total}`).join('|')}`}
                            data={geo}
                            style={style}
                            onEachFeature={onEachFeature}
                        />
                        <Controls />
                        <Scale />
                    </MapContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[#667382]">{error ?? 'Memuat peta…'}</div>
                )}

                {hover && (
                    <div
                        className="pointer-events-none absolute z-[600] w-[290px] rounded-xl bg-[#27303d] p-4 text-[13px] text-white shadow-xl"
                        style={{ left: Math.min(hover.x + 16, Math.max(8, width - 300)), top: Math.max(8, hover.y - 20) }}
                        role="tooltip"
                    >
                        <p className="flex items-center gap-2 text-[15px] font-semibold">
                            <MapPin className="h-4 w-4 shrink-0 text-[#5fd0b5]" aria-hidden="true" />
                            {hovered?.provinsi ?? hover.name}
                        </p>
                        <div className="mt-3 border-t border-white/15 pt-3">{tooltip(hover.name, hovered)}</div>
                        {hint && <p className="mt-3 border-t border-white/15 pt-2.5 text-center text-xs text-white/70">{hint}</p>}
                    </div>
                )}

                <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-[#e3e8ee] bg-white/95 px-3 py-2 text-[11px] text-[#4a5868]">
                    <p className="mb-1 font-semibold">Jumlah pengaduan</p>
                    <div className="flex items-center gap-1">
                        <span className="h-3 w-5 rounded-sm border border-[#cbd5e1] bg-white" aria-hidden="true" />
                        {SCALE.map((c) => (
                            <span key={c} className="h-3 w-5 rounded-sm" style={{ background: c }} aria-hidden="true" />
                        ))}
                    </div>
                    <div className="mt-0.5 flex justify-between tabular-nums">
                        <span>0</span>
                        <span>{max.toLocaleString('id-ID')}</span>
                    </div>
                </div>
            </div>

            <p className="mt-1.5 text-right text-[11px] text-[#667382]">
                Batas provinsi ©{' '}
                <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[#33414e]"
                >
                    OpenStreetMap contributors
                </a>{' '}
                (ODbL)
            </p>

            {unmapped.length > 0 && (
                <p className="mt-2 text-xs text-[#667382]">
                    Belum terpetakan (nama provinsi kawasan tidak dikenali):{' '}
                    {unmapped.map((d) => `${d.provinsi} (${d.total.toLocaleString('id-ID')})`).join(', ')}
                </p>
            )}
        </div>
    );
}

/** Satu baris tooltip: label kiri, nilai kanan. */
export function TooltipRow({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
    return (
        <p className="flex items-baseline justify-between gap-4 py-0.5">
            <span className="text-white/70">{label}</span>
            <span className={cn('font-semibold tabular-nums', tone)}>{value}</span>
        </p>
    );
}
