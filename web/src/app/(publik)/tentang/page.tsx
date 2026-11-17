import Tentang from '@/halaman/public/tentang';
import { renderInertia } from '@/server/inertia/halaman';
import { ambilStatistikPublik } from '@/server/statistik';

// PublicController::about → Inertia::render('public/tentang', ['stats' => publicOverview()]). Dinamis per permintaan
// (renderInertia membaca header), tanpa prerender saat build.
export default async function Halaman() {
    return renderInertia(Tentang, 'public/tentang', { stats: await ambilStatistikPublik() });
}
