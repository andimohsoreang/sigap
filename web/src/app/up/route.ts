// Healthcheck container (tanpa DB). Rute /up publik tetap dilayani Laravel sampai dipindah.
export const dynamic = 'force-dynamic';

export function GET() {
    return new Response('OK', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
