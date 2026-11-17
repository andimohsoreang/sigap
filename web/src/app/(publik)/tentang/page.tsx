import Tentang from '@/halaman/public/tentang';
import { renderInertia } from '@/server/inertia/halaman';
// SEMENTARA: ganti menjadi '@/server/statistik' saat s1/statistik digabung (lihat berkas stub).
import { ambilStatistikPublik } from '@/server/statistik-sementara';

// PublicController::about → Inertia::render('public/tentang', ['stats' => publicOverview()]). Dinamis per permintaan
// (renderInertia membaca header), tanpa prerender saat build.
export default async function Halaman() {
    return renderInertia(Tentang, 'public/tentang', { stats: await ambilStatistikPublik() });
}
