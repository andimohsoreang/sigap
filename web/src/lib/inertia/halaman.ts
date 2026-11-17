import { createContext, useContext } from 'react';

// Objek halaman Inertia (bentuk JSON `data-page` Laravel: component, props, url, version, clearHistory,
// encryptHistory). Dibuat di server (src/server/inertia/halaman.tsx), dibaca komponen lewat usePage().

export type PageProps = Record<string, unknown>;

export interface Page<P extends PageProps = PageProps> {
    component: string;
    props: P & { errors: Record<string, string> };
    url: string;
    /** Laravel: hash manifest Vite (hanya dipakai kunjungan XHR Inertia, yang tidak ada di Next.js). */
    version: string | null;
    clearHistory: boolean;
    encryptHistory: boolean;
}

export const PageContext = createContext<Page | undefined>(undefined);
PageContext.displayName = 'InertiaPageContext';

/** usePage() @inertiajs/react 2.0.3: objek halaman utuh; di luar <InertiaApp> melempar galat yang sama. */
export function usePage<P extends PageProps = PageProps>(): Page<P> {
    const page = useContext(PageContext);
    if (!page) throw new Error('usePage must be used within the Inertia component');
    return page as Page<P>;
}
