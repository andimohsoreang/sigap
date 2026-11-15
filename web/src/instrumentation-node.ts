// Next.js hanya mencatat galat hook instrumentation lalu tetap melayani 500, jadi proses dihentikan agar env yang
// salah membuat server gagal start (rencana §9.2), bukan gagal per request.
try {
    await import('./server/env');
} catch (error) {
    console.error(error);
    process.exit(1);
}

// Ditambahkan di samping handler sinyal Next.js (NEXT_MANUAL_SIG_HANDLE tidak dipakai); 25 dtk < stop_grace_period.
const { berhentiAnggun } = await import('./server/berhenti');
const berhenti = berhentiAnggun(25_000);
process.on('SIGTERM', berhenti);
process.on('SIGINT', berhenti);

export {};
