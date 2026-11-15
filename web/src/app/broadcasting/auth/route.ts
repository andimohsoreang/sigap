import type { NextRequest } from 'next/server';

import { prosesIzinKanal } from '@/server/auth/rute';

// /broadcasting/auth (GET & POST) — Broadcast::routes() Laravel: grup `web` TANPA VerifyCsrfToken
// (BroadcastManager::routes → withoutMiddleware), dipakai pusher-js channelAuthorization (src/lib/realtime.ts).
export const GET = (req: NextRequest) => prosesIzinKanal(req);
export const POST = (req: NextRequest) => prosesIzinKanal(req);
