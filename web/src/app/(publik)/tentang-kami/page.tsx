import TentangKami from '@/halaman/public/tentang-kami';
import { renderInertia } from '@/server/inertia/halaman';

// PublicController::aboutUs → Inertia::render('public/tentang-kami').
export default function Halaman() {
    return renderInertia(TentangKami, 'public/tentang-kami');
}
