import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// Server HTTP lokal untuk test klien; tanpa internet.
export async function serverUji(handler: (req: IncomingMessage, res: ServerResponse) => void, port = 0) {
    const permintaan: IncomingMessage[] = [];
    const server = createServer((req, res) => {
        permintaan.push(req);
        handler(req, res);
    });
    await new Promise<void>((ok) => server.listen(port, '127.0.0.1', ok));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { url, permintaan, tutup: () => new Promise<void>((ok) => server.close(() => ok())) };
}
