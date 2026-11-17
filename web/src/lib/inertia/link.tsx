import { createElement, forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';

// <Link> @inertiajs/react 2.0.3 (src/Link.ts) untuk GET tanpa opsi kunjungan: DOM persis sama (`<a {...props} href>`,
// urutan atribut ikut), klik menjadi navigasi biasa browser (halaman tujuan dimuat penuh). Opsi Inertia lain
// (method, as, data, prefetch, replace, preserveScroll, callback kunjungan, …) belum dipakai halaman yang sudah pindah:
// galat jelas agar porter berikutnya menambahkannya di sini, bukan diam-diam berperilaku lain.

const OPSI_INERTIA = [
    'as',
    'data',
    'method',
    'headers',
    'preserveScroll',
    'preserveState',
    'replace',
    'only',
    'except',
    'onCancelToken',
    'onBefore',
    'onStart',
    'onProgress',
    'onFinish',
    'onCancel',
    'onSuccess',
    'onError',
    'queryStringArrayFormat',
    'async',
    'prefetch',
    'cacheFor',
] as const;

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode } & Partial<
        Record<(typeof OPSI_INERTIA)[number], unknown>
    >;

/** mergeDataIntoQueryString(method 'get', href, {}) @inertiajs/core: bentuk href yang dirender Inertia. */
export function hrefInertia(href: string): string {
    const hasHost = /^https?:\/\//.test(href);
    const hasAbsolutePath = hasHost || href.startsWith('/');
    const hasRelativePath = !hasAbsolutePath && !href.startsWith('#') && !href.startsWith('?');
    const url = new URL(href, 'http://localhost');
    return [
        hasHost ? `${url.protocol}//${url.host}` : '',
        hasAbsolutePath ? url.pathname : '',
        hasRelativePath ? url.pathname.substring(1) : '',
        href.includes('?') ? url.search : '',
        href.includes('#') ? url.hash : '',
    ].join('');
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function InertiaLink({ children, href, ...props }, ref) {
    const dipakai = OPSI_INERTIA.filter((k) => Object.hasOwn(props, k));
    if (dipakai.length > 0) throw new Error(`Link: opsi ${dipakai.join(', ')} belum didukung lapisan kompatibilitas Inertia (src/lib/inertia)`);
    // Urutan sama dengan createElement Inertia: props, href, ref, handler, data-loading (undefined → tidak dirender).
    return createElement('a', { ...props, href: hrefInertia(href || ''), ref }, children);
});
Link.displayName = 'InertiaLink';
