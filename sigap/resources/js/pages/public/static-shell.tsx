import { type ReactNode, useEffect, useRef, useState } from 'react';

import TaraPage, { AskTaraCard, type TaraPose } from '@/components/sigap/tara-shell';
import { cn } from '@/lib/utils';

interface StaticShellProps {
    title: string;
    subtitle?: string;
    updated?: string;
    eyebrow?: string;
    pose?: TaraPose;
    children: ReactNode;
}

/** Kartu konten bergaya TARA untuk halaman informasi (dipakai di dalam StaticShell). */
export const staticCard = 'rounded-[20px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)] p-6';

function slug(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Bingkai halaman informasi & kebijakan (Pedoman, Syarat, Privasi, Tentang Kami)
 * bergaya TARA: hero krem, daftar isi melekat di layar lebar, dan ajakan Tanya TARA.
 */
export default function StaticShell({
    title,
    subtitle,
    updated,
    eyebrow = 'Informasi & Kebijakan',
    pose = 'menjelaskan',
    children,
}: StaticShellProps) {
    const content = useRef<HTMLDivElement>(null);
    const [toc, setToc] = useState<{ id: string; label: string }[]>([]);

    // Daftar isi dibangun dari judul bagian yang benar-benar tampil.
    useEffect(() => {
        const headings = content.current?.querySelectorAll<HTMLHeadingElement>('h2[id]') ?? [];
        setToc(Array.from(headings).map((h) => ({ id: h.id, label: h.textContent ?? '' })));
    }, []);

    return (
        <TaraPage
            title={title}
            description={subtitle}
            breadcrumb={[{ label: 'Beranda', href: '/' }, { label: title }]}
            eyebrow={eyebrow}
            heading={title}
            subtitle={
                subtitle || updated ? (
                    <>
                        {subtitle && <p>{subtitle}</p>}
                        {updated && <p className="mt-2 text-sm text-[var(--tcd-text-2,#5b6875)]">Terakhir diperbarui: {updated}</p>}
                    </>
                ) : undefined
            }
            pose={pose}
            compact
        >
            <div className="mx-auto grid max-w-[1312px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-16 lg:py-14">
                <nav aria-label="Daftar isi" className={cn('hidden lg:block', toc.length < 2 && 'lg:hidden')}>
                    <div className="sticky top-24">
                        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--tcd-bronze,#8b682b)] uppercase">Daftar isi</p>
                        <ol className="mt-3 flex flex-col gap-1 border-l border-[var(--tcd-border,#e6ebf0)]">
                            {toc.map((t) => (
                                <li key={t.id}>
                                    <a
                                        href={`#${t.id}`}
                                        className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-[var(--tcd-text-2,#4a5868)] hover:border-[var(--tcd-link,var(--t-navy))] hover:text-[var(--tcd-heading,var(--t-deep))]"
                                    >
                                        {t.label}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </div>
                </nav>
                <div className={cn('flex min-w-0 flex-col gap-10', toc.length < 2 && 'lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-[880px]')}>
                    <div ref={content} className="flex max-w-[820px] flex-col gap-10">
                        {children}
                    </div>
                    <div className="max-w-[820px]">
                        <AskTaraCard title="Masih ada pertanyaan?" desc="TARA siap membantu menjawab dan meneruskan ke petugas bila perlu." />
                    </div>
                </div>
            </div>
        </TaraPage>
    );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
    const id = slug(title);

    return (
        <section aria-labelledby={id} className="scroll-mt-24">
            <h2 id={id} className="font-heading mb-4 text-2xl leading-tight font-bold text-[var(--tcd-heading,var(--t-deep))]">
                {title}
            </h2>
            <div className="space-y-3 text-[16px] leading-relaxed text-[var(--tcd-text-2,#3f4d5b)] [&_strong]:font-semibold [&_strong]:text-[var(--tcd-heading,var(--t-deep))]">
                {children}
            </div>
        </section>
    );
}
