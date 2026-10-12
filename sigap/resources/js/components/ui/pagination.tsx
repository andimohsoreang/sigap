import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface PaginationMeta {
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
    from: number | null;
    to: number | null;
}

interface PaginationProps {
    meta: PaginationMeta;
    onPageChange: (page: number) => void;
    onPerPageChange?: (perPage: number) => void;
    perPageOptions?: number[];
    /** Label entitas untuk teks ringkasan, cth: "tiket". */
    itemLabel?: string;
    className?: string;
}

/** Pagination ala shadcn/ui — nomor halaman, jump first/last, dan pilihan per-halaman. */
export function Pagination({
    meta,
    onPageChange,
    onPerPageChange,
    perPageOptions = [10, 15, 25, 50],
    itemLabel = 'data',
    className,
}: PaginationProps) {
    const current = meta.current_page;
    const last = Math.max(meta.last_page, 1);
    const from = meta.from ?? 0;
    const to = meta.to ?? 0;

    /** Deret nomor halaman dengan ellipsis, cth: 1 … 4 5 6 … 12 */
    const pages: (number | 'ellipsis-l' | 'ellipsis-r')[] = [];
    if (last <= 7) {
        for (let p = 1; p <= last; p++) pages.push(p);
    } else {
        pages.push(1);
        if (current > 3) pages.push('ellipsis-l');
        for (let p = Math.max(2, current - 1); p <= Math.min(last - 1, current + 1); p++) pages.push(p);
        if (current < last - 2) pages.push('ellipsis-r');
        pages.push(last);
    }

    if (meta.total === 0) {
        return (
            <div className={cn('px-5 py-4 text-xs text-gray-500', className)}>Tidak ada {itemLabel}.</div>
        );
    }

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 sm:flex-row',
                className,
            )}
        >
            <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">
                    Menampilkan <strong className="text-gray-700">{from}</strong>–
                    <strong className="text-gray-700">{to}</strong> dari{' '}
                    <strong className="text-gray-700">{meta.total}</strong> {itemLabel}
                </span>
                {onPerPageChange && (
                    <Select value={String(meta.per_page)} onValueChange={(v) => onPerPageChange(Number(v))}>
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {perPageOptions.map((n) => (
                                <SelectItem key={n} value={String(n)} className="text-xs">
                                    {n} / halaman
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="flex items-center gap-1">
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={current <= 1}
                    onClick={() => onPageChange(1)}
                    title="Halaman pertama"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={current <= 1}
                    onClick={() => onPageChange(current - 1)}
                    title="Halaman sebelumnya"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {pages.map((p) =>
                    typeof p === 'number' ? (
                        <Button
                            key={p}
                            size="icon"
                            variant={p === current ? 'default' : 'ghost'}
                            className="h-8 w-8 text-xs"
                            onClick={() => p !== current && onPageChange(p)}
                            aria-current={p === current ? 'page' : undefined}
                        >
                            {p}
                        </Button>
                    ) : (
                        <span key={p} className="px-1 text-xs text-gray-400">
                            …
                        </span>
                    ),
                )}

                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={current >= last}
                    onClick={() => onPageChange(current + 1)}
                    title="Halaman berikutnya"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={current >= last}
                    onClick={() => onPageChange(last)}
                    title="Halaman terakhir"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
