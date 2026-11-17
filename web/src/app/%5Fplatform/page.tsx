import type { Metadata } from 'next';

// Halaman teknis S0 agar build punya rute; tanpa gaya baru.
export const metadata: Metadata = { title: 'Platform - Contact Center' };

export default function Platform() {
    return <p>Contact Center</p>;
}
