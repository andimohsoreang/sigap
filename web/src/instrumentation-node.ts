// Next.js hanya mencatat galat hook instrumentation lalu tetap melayani 500, jadi proses dihentikan agar env yang
// salah membuat server gagal start (rencana §9.2), bukan gagal per request.
try {
    await import('./server/env');
} catch (error) {
    console.error(error);
    process.exit(1);
}

export {};
