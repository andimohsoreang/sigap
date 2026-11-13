import 'server-only';

import dc from 'node:diagnostics_channel';
import type { Server } from 'node:http';

// Next.js tidak memberi akses ke http.Server-nya; server dikenali dari request pertama lewat diagnostics_channel.
const daftarServer = new Set<Server>();
dc.subscribe('http.server.request.start', (pesan) => daftarServer.add((pesan as { server: Server }).server));

// Handler SIGTERM/SIGINT (NEXT_MANUAL_SIG_HANDLE=true): berhenti menerima koneksi, tunggu request berjalan selesai,
// lalu keluar 0; bila melewati batasMs keluar 1.
export function berhentiAnggun(batasMs: number, keluar: (kode: number) => void = process.exit) {
    let mulai = false;
    return () => {
        if (mulai) return;
        mulai = true;
        setTimeout(() => keluar(1), batasMs).unref();
        // close() hanya menutup koneksi keep-alive yang menganggur saat dipanggil; yang selesai belakangan ditutup di sini.
        setInterval(() => daftarServer.forEach((s) => s.closeIdleConnections()), 100).unref();
        void Promise.all([...daftarServer].map((s) => new Promise((selesai) => s.close(selesai)))).then(() => keluar(0));
    };
}
