import PublicLayout from '@/layouts/public-layout';
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { type ReactNode } from 'react';

interface StaticShellProps {
    title: string;
    subtitle?: string;
    updated?: string;
    children: ReactNode;
}

export default function StaticShell({ title, subtitle, updated, children }: StaticShellProps) {
    return (
        <PublicLayout title={title}>
            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <Link href="/" className="hover:text-brand-light mb-6 inline-flex items-center gap-1 text-sm text-gray-400 transition">
                    <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
                </Link>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{title}</h1>
                {subtitle && <p className="mt-1 text-gray-500 dark:text-gray-400">{subtitle}</p>}
                {updated && <p className="mt-1 text-xs text-gray-400">Terakhir diperbarui: {updated}</p>}
                <div className="mt-8 space-y-6">{children}</div>
            </div>
        </PublicLayout>
    );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h2 className="text-primary dark:text-brand-light mb-3 text-xl font-bold">{title}</h2>
            <div className="space-y-3 leading-relaxed text-gray-600 dark:text-gray-300">{children}</div>
        </section>
    );
}
