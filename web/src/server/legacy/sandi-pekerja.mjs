// Worker thread bcrypt untuk sandi.ts: bcryptjs sinkron di sini agar event loop utama tidak tertahan (±0,4 dtk per cek).
import { parentPort } from 'node:worker_threads';

import bcrypt from 'bcryptjs';

parentPort.on('message', ({ id, sandi, hash, biaya }) => {
    try {
        // hash ada → cek; tidak ada → buat `$2y$` (algoritma sama dengan `$2b$` bawaan bcryptjs).
        const hasil = hash ? bcrypt.compareSync(sandi, hash) : bcrypt.hashSync(sandi, '$2y$' + bcrypt.genSaltSync(biaya).slice(4));
        parentPort.postMessage({ id, hasil });
    } catch (e) {
        parentPort.postMessage({ id, galat: e instanceof Error ? e.message : String(e) });
    }
});
