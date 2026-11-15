import type { NextRequest } from 'next/server';

import { prosesMasuk } from '@/server/auth/rute';

// POST /masuk — sigap/routes/web.php:75 (guest + throttle:login) → MasukController::store. Halaman GET /masuk milik
// slice S15; saat itu berkas ini diganti page.tsx + Server Action yang memanggil prosesMasuk yang sama.
export const POST = (req: NextRequest) => prosesMasuk(req);
