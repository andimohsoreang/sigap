import PedomanLayanan from '@/halaman/public/pedoman-layanan';
import { renderInertia } from '@/server/inertia/halaman';

// PublicController::guidelines → Inertia::render('public/pedoman-layanan').
export default function Halaman() {
    return renderInertia(PedomanLayanan, 'public/pedoman-layanan');
}
