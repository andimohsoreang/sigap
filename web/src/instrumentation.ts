// Dijalankan sekali saat server Next.js start (pola resmi: kode khusus Node.js di berkas terpisah).
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') await import('./instrumentation-node');
}
