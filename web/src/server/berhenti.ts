import 'server-only';

import dc from 'node:diagnostics_channel';
import type { Server } from 'node:http';

// Next.js tidak memberi akses ke http.Server-nya; server dikenali dari request pertama lewat diagnostics_channel.
const daftarServer = new Set<Server>();
dc.subscribe('http.server.request.start', (pesan) => daftarServer.add((pesan as { server: Server }).server));

// Pelengkap cleanup bawaan Next.js 16 (server.close() → nextServer.close() → exit) saat SIGTERM/SIGINT:
// - server.close() hanya menutup koneksi keep-alive yang menganggur saat dipanggil; yang menganggur belakangan
//   baru tertutup setelah keepAliveTimeout, jadi ditutup berkala di sini;
// - batas paksa bila request tidak selesai sebelum batasMs.
export function berhentiAnggun(batasMs: number, keluar: (kode: number) => void = process.exit) {
    let mulai = false;
    return () => {
        if (mulai) return;
        mulai = true;
        setInterval(() => daftarServer.forEach((s) => s.closeIdleConnections()), 100).unref();
        setTimeout(() => keluar(1), batasMs).unref();
    };
}
