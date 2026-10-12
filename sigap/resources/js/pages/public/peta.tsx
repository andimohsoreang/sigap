import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PublicLayout from '@/layouts/public-layout';
import { Head } from '@inertiajs/react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

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

export default function Peta({ regions, points }: Props) {
    const [mounted, setMounted] = useState(false);
    const [province, setProvince] = useState('all');

    useEffect(() => setMounted(true), []);

    const provinces = Array.from(new Set(points.map((p) => p.province).filter(Boolean))) as string[];
    const filtered = province === 'all' ? points : points.filter((p) => p.province === province);
    const center: [number, number] = filtered.length ? [filtered[0].latitude, filtered[0].longitude] : [-2.5, 118.0];

    return (
        <PublicLayout title="Peta Kawasan">
            <Head title="Peta Kawasan — SIGAP" />

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                            SIGAP <span className="text-primary dark:text-brand-light">Peta</span>
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {regions} Kawasan Transmigrasi · {points.reduce((s, p) => s + p.kk_count, 0)} KK
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Kawasan / Wilayah</span>
                        <Select value={province} onValueChange={setProvince}>
                            <SelectTrigger className="w-52">
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
                </div>

                <Card className="dark:bg-dark-card overflow-hidden border-gray-100 dark:border-gray-800">
                    <CardContent className="p-0">
                        {mounted ? (
                            <MapContainer center={center} zoom={5} scrollWheelZoom className="h-[520px] w-full">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {filtered.map((p) => (
                                    <Marker key={p.id} position={[p.latitude, p.longitude]}>
                                        <Popup>
                                            <strong>{p.name}</strong>
                                            <br />
                                            {p.province}
                                            <br />
                                            Status: {p.infrastructure_status ?? '-'} · {p.kk_count} KK
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        ) : (
                            <div className="flex h-[520px] items-center justify-center text-gray-400">Memuat peta…</div>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((p) => (
                        <Card key={p.id} className="dark:bg-dark-card border-gray-100 dark:border-gray-800">
                            <CardContent className="p-4">
                                <p className="text-secondary text-xs font-bold">{p.code}</p>
                                <p className="font-bold text-gray-800 dark:text-white">{p.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {p.province} · {p.kk_count} KK
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </PublicLayout>
    );
}
