import type { NextRequest } from 'next/server';

import { prosesKeluar } from '@/server/auth/rute';

// POST /keluar — sigap/routes/web.php:85 (auth) → MasukController::destroy.
export const POST = (req: NextRequest) => prosesKeluar(req);
