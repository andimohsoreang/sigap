import Panduan from '@/halaman/public/panduan';
import { renderInertia } from '@/server/inertia/halaman';

// PublicController::guide → Inertia::render('public/panduan').
export default function Halaman() {
    return renderInertia(Panduan, 'public/panduan');
}
