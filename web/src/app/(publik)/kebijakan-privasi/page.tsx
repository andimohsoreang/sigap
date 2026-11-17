import KebijakanPrivasi from '@/halaman/public/kebijakan-privasi';
import { renderInertia } from '@/server/inertia/halaman';

// PublicController::privacy → Inertia::render('public/kebijakan-privasi').
export default function Halaman() {
    return renderInertia(KebijakanPrivasi, 'public/kebijakan-privasi');
}
