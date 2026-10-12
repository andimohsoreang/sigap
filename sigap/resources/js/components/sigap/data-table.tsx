import { router } from '@inertiajs/react';
import { flexRender } from '@tanstack/react-table';
import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useLegacyTable } from '@tanstack/react-table/legacy';
import type { ColumnFiltersState, ColumnVisibilityState, SortingState } from '@tanstack/table-core';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Search, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Meta tambahan untuk kolom DataTable. */
export interface DataTableColumnMeta {
    /** Label kolom di menu "Tampilkan kolom". */
    label?: string;
    /** Sembunyikan kolom dari menu toggle. */
    disableToggle?: boolean;
    /** Nonaktifkan sorting pada kolom ini. */
    disableSorting?: boolean;
    /** Kelas Tailwind untuk th/td. */
    className?: string;
}

export type DataTableColumn<T extends object> = LegacyColumnDef<T> & { meta?: DataTableColumnMeta };

interface DataTableProps<T extends object> {
    columns: DataTableColumn<T>[];
    data: T[];
    /** Judul panel di toolbar (opsional). */
    toolbarTitle?: string;
    /** Elemen tambahan di sisi kanan toolbar (tombol aksi, dll). */
    toolbarActions?: ReactNode;
    /** Placeholder input pencarian global. */
    searchPlaceholder?: string;
    /** Filter dropdown: nilai 'all' berarti tanpa filter. */
    filters?: {
        columnId: string;
        placeholder: string;
        options: { value: string; label: string }[];
    }[];
    /** Label entitas untuk teks pagination, cth: "tiket". */
    itemLabel?: string;
    /** Pesan saat data kosong. */
    emptyMessage?: string;
    /** Nonaktifkan seluruh fitur client-side (untuk tabel server-only). */
    clientSideDisabled?: boolean;
    /** Kelas kustom per baris, cth untuk menandai baris yang terlambat SLA. */
    rowClassName?: (row: T) => string | undefined;

    /* ----- Mode server-side (opsional) ----- */
    /** Bila diisi, pagination/filter/sort dikirim sebagai query string Inertia. */
    serverSide?: {
        url: string;
        meta: PaginationMeta;
        /** Nilai filter saat ini dari server. */
        currentValues?: Record<string, string>;
        searchKey?: string;
        pageKey?: string;
        perPageKey?: string;
        /** Nama parameter query untuk sort, format "kolom:asc|desc". */
        sortKey?: string;
    };
}

/**
 * DataTable generik ala shadcn/ui untuk admin panel SIGAP.
 *
 * Fitur: pencarian global, filter dropdown per kolom, sorting per kolom,
 * pagination dengan pilihan per-halaman, toggle visibilitas kolom.
 * Default client-side; berikan `serverSide` untuk memakai query string Inertia.
 */
export function DataTable<T extends object>({
    columns,
    data,
    toolbarTitle,
    toolbarActions,
    searchPlaceholder = 'Cari data...',
    filters = [],
    itemLabel = 'data',
    emptyMessage = 'Belum ada data.',
    rowClassName,
    serverSide,
}: DataTableProps<T>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
    /** Input pencarian mode server-side; dikirim saat Enter ditekan. */
    const [searchInput, setSearchInput] = useState(serverSide?.currentValues?.[serverSide.searchKey ?? 'q'] ?? '');

    const isServer = Boolean(serverSide);

    /** Kirim parameter ke server via Inertia, menjaga filter aktif; reset ke halaman 1. */
    const visitServer = (params: Record<string, string | number | undefined>, keepPage = false) => {
        if (!serverSide) return;
        const base: Record<string, string | number | undefined> = { ...(serverSide.currentValues ?? {}) };
        const pageKey = serverSide.pageKey ?? 'page';
        if (keepPage && serverSide.meta.current_page > 1) {
            base[pageKey] = serverSide.meta.current_page;
        } else {
            delete base[pageKey];
        }
        Object.entries(params).forEach(([k, v]) => {
            if (v === undefined || v === '' || v === 'all') delete base[k];
            else base[k] = v;
        });
        router.get(serverSide.url, base, { preserveState: true, replace: true });
    };

    /** Arah sorting aktif dari query string server, untuk kolom tertentu. */
    const serverSortDir = (columnId: string): 'asc' | 'desc' | false => {
        const raw = serverSide?.currentValues?.[serverSide.sortKey ?? 'sort'] ?? '';
        const [key, dir] = raw.split(':');
        if (key !== columnId) return false;
        return dir === 'desc' ? 'desc' : 'asc';
    };

    const activeColumnFilters: ColumnFiltersState = Object.entries(columnFilters)
        .filter(([, v]) => v !== '' && v !== 'all')
        .map(([id, value]) => ({ id, value }));

    const table = useLegacyTable<T>({
        data,
        columns,
        state: {
            sorting: isServer ? [] : sorting,
            globalFilter: isServer ? '' : globalFilter,
            columnFilters: isServer ? [] : activeColumnFilters,
            columnVisibility,
        },
        onSortingChange: isServer ? undefined : setSorting,
        onGlobalFilterChange: isServer ? undefined : setGlobalFilter,
        onColumnFiltersChange: isServer
            ? undefined
            : (updater) => {
                  const next = typeof updater === 'function' ? updater(activeColumnFilters) : updater;
                  const map: Record<string, string> = {};
                  next.forEach((f) => (map[f.id] = String(f.value)));
                  setColumnFilters(map);
              },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: 'includesString',
        initialState: { pagination: { pageIndex: 0, pageSize: 15 } },
    });

    const pageSize = serverSide?.meta.per_page ?? table.getState().pagination.pageSize;
    const clientMeta: PaginationMeta = serverSide?.meta ?? {
        total: table.getFilteredRowModel().rows.length,
        current_page: table.getState().pagination.pageIndex + 1,
        last_page: Math.max(1, Math.ceil(table.getFilteredRowModel().rows.length / pageSize)),
        per_page: pageSize,
        from: table.getFilteredRowModel().rows.length ? table.getState().pagination.pageIndex * pageSize + 1 : null,
        to: Math.min((table.getState().pagination.pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length),
    };

    const hasActiveFilters = globalFilter.trim() !== '' || activeColumnFilters.length > 0;

    const resetFilters = () => {
        setGlobalFilter('');
        setColumnFilters({});
    };

    return (
        <Card className="overflow-hidden rounded-xl border-gray-200 shadow-md">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center">
                {toolbarTitle && (
                    <h3 className="text-brand-light flex items-center gap-2 text-sm font-bold tracking-[2px] whitespace-nowrap">
                        <span className="bg-brand-light h-[2px] w-5 rounded-full" />
                        {toolbarTitle}
                    </h3>
                )}

                {isServer && serverSide ? (
                    <div className="relative w-full max-w-xs lg:max-w-sm lg:flex-grow">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    visitServer({ [serverSide.searchKey ?? 'q']: searchInput });
                                }
                            }}
                            placeholder={searchPlaceholder}
                            className="h-9 pl-9"
                        />
                    </div>
                ) : (
                    <div className="relative w-full max-w-xs lg:max-w-sm lg:flex-grow">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="h-9 pl-9"
                        />
                    </div>
                )}

                {filters.map((f) => {
                    const current = isServer ? serverSide?.currentValues?.[f.columnId] || 'all' : columnFilters[f.columnId] || 'all';
                    return (
                        <Select
                            key={f.columnId}
                            value={current}
                            onValueChange={(value) => {
                                if (isServer) {
                                    visitServer({ [f.columnId]: value });
                                } else {
                                    setColumnFilters((prev) => ({ ...prev, [f.columnId]: value }));
                                }
                            }}
                        >
                            <SelectTrigger className="h-9 w-auto min-w-[150px] gap-2 text-sm" aria-label={f.placeholder}>
                                <SelectValue placeholder={f.placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{f.placeholder}</SelectItem>
                                {f.options.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    );
                })}

                {!isServer && hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={resetFilters}>
                        <X className="h-3.5 w-3.5" /> Reset
                    </Button>
                )}

                <div className="ml-auto flex items-center gap-2">
                    {toolbarActions}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9">
                                <ChevronDown className="h-4 w-4" /> Kolom
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs">Tampilkan kolom</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {table
                                .getAllColumns()
                                .filter((col) => col.getCanHide() && !(col.columnDef.meta as DataTableColumnMeta | undefined)?.disableToggle)
                                .map((col) => (
                                    <DropdownMenuCheckboxItem
                                        key={col.id}
                                        checked={col.getIsVisible()}
                                        onCheckedChange={(v) => col.toggleVisibility(Boolean(v))}
                                        className="text-xs"
                                    >
                                        {(col.columnDef.meta as DataTableColumnMeta | undefined)?.label ??
                                            (typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id)}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Table>
                <TableHeader className="bg-gray-50">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => {
                                const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
                                const canSort = header.column.getCanSort() && !meta?.disableSorting;
                                const sorted = isServer ? serverSortDir(header.column.id) : header.column.getIsSorted();
                                const toggleSort = () => {
                                    if (isServer) {
                                        const next = sorted === 'asc' ? 'desc' : sorted === 'desc' ? '' : 'asc';
                                        visitServer({ [serverSide!.sortKey ?? 'sort']: next ? `${header.column.id}:${next}` : '' });
                                        return;
                                    }
                                    // Siklus asc → desc → tanpa sorting, sama seperti mode server.
                                    setSorting((prev) => {
                                        const existing = prev.find((s) => s.id === header.column.id);
                                        if (!existing) return [{ id: header.column.id, desc: false }];
                                        if (!existing.desc) return [{ id: header.column.id, desc: true }];
                                        return [];
                                    });
                                };
                                return (
                                    <TableHead key={header.id} className={meta?.className}>
                                        {header.isPlaceholder ? null : canSort ? (
                                            <button
                                                type="button"
                                                onClick={toggleSort}
                                                className="-ml-1 flex cursor-pointer items-center gap-1 hover:text-gray-700"
                                                aria-label={`Urutkan ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.column.id}`}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {sorted === 'asc' ? (
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                ) : sorted === 'desc' ? (
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                                                )}
                                            </button>
                                        ) : (
                                            flexRender(header.column.columnDef.header, header.getContext())
                                        )}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columns.length} className="py-10 text-center text-gray-400">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} className={rowClassName?.(row.original)}>
                                {row.getVisibleCells().map((cell) => {
                                    const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
                                    return (
                                        <TableCell key={cell.id} className={cn('text-gray-700', meta?.className)}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <Pagination
                meta={clientMeta}
                itemLabel={itemLabel}
                onPageChange={(page) => (isServer ? visitServer({ page }, true) : table.setPageIndex(page - 1))}
                onPerPageChange={isServer ? (n) => visitServer({ [serverSide!.perPageKey ?? 'per_page']: n }) : (n) => table.setPageSize(n)}
            />
        </Card>
    );
}
