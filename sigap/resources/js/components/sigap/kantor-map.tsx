import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

/**
 * Peta lokasi kantor di modal "Kantor" beranda. Dimuat lazy agar Leaflet
 * tidak ikut bundel beranda; pin memakai gaya `.tara-pin` halaman Peta.
 */

const BUILDING_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></svg>';

const pin = L.divIcon({
    className: 'tara-pin',
    html: `<div class="tara-pin__wrap is-selected"><span class="tara-pin__dot">${BUILDING_SVG}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

export default function KantorMap({ lat, lng }: { lat: number; lng: number }) {
    return (
        <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[lat, lng]} icon={pin} keyboard={false} />
        </MapContainer>
    );
}
