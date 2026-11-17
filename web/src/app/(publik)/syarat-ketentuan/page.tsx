import SyaratKetentuan from '@/halaman/public/syarat-ketentuan';
import { renderInertia } from '@/server/inertia/halaman';

// PublicController::terms → Inertia::render('public/syarat-ketentuan').
export default function Halaman() {
    return renderInertia(SyaratKetentuan, 'public/syarat-ketentuan');
}
