import { useSyncExternalStore } from 'react';

/**
 * Preferensi tampilan pengunjung (tema & aksesibilitas), disimpan di browser
 * masing-masing (localStorage) tanpa akun. Kelas di <html> dipasang lebih dulu
 * oleh skrip di resources/views/app.blade.php agar tidak berkedip; modul ini
 * memakai nama kunci & kelas yang sama — ubah keduanya bersamaan.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export interface A11yPrefs {
    /** 0 = 100%, 1 = 115%, 2 = 130%. */
    text: 0 | 1 | 2;
    contrast: boolean;
    links: boolean;
    dyslexia: boolean;
    motion: boolean;
    focus: boolean;
    gray: boolean;
}

export const THEME_KEY = 'cc-theme';
export const A11Y_KEY = 'cc-a11y';
export const DEFAULT_A11Y: A11yPrefs = { text: 0, contrast: false, links: false, dyslexia: false, motion: false, focus: false, gray: false };

const EVENT = 'cc-preferences';

function read(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key: string, value: string | null): void {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // Mode privat / penyimpanan diblokir: preferensi berlaku sampai halaman ditutup.
    }
}

let memoryTheme: ThemeChoice | null = null;
let memoryA11y: A11yPrefs | null = null;

export function getTheme(): ThemeChoice {
    const v = memoryTheme ?? read(THEME_KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
}

export function getA11y(): A11yPrefs {
    if (memoryA11y) return memoryA11y;
    try {
        const parsed = JSON.parse(read(A11Y_KEY) ?? '{}') as Partial<A11yPrefs>;
        const text = parsed.text === 1 || parsed.text === 2 ? parsed.text : 0;
        memoryA11y = { ...DEFAULT_A11Y, ...pickBooleans(parsed), text };
    } catch {
        memoryA11y = { ...DEFAULT_A11Y };
    }
    return memoryA11y;
}

function pickBooleans(p: Partial<A11yPrefs>): Partial<A11yPrefs> {
    const out: Partial<A11yPrefs> = {};
    for (const k of ['contrast', 'links', 'dyslexia', 'motion', 'focus', 'gray'] as const) {
        if (typeof p[k] === 'boolean') out[k] = p[k];
    }
    return out;
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function isDark(theme: ThemeChoice = getTheme()): boolean {
    return theme === 'dark' || (theme === 'system' && systemDark());
}

/** Pasang kelas tema & aksesibilitas di <html>. */
export function applyPreferences(): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const a = getA11y();
    html.classList.toggle('dark', isDark());
    html.classList.toggle('a11y-text-1', a.text === 1);
    html.classList.toggle('a11y-text-2', a.text === 2);
    html.classList.toggle('a11y-contrast', a.contrast);
    html.classList.toggle('a11y-links', a.links);
    html.classList.toggle('a11y-dyslexia', a.dyslexia);
    html.classList.toggle('a11y-motion', a.motion);
    html.classList.toggle('a11y-focus', a.focus);
    html.classList.toggle('a11y-gray', a.gray);
}

function changed(): void {
    applyPreferences();
    window.dispatchEvent(new Event(EVENT));
}

export function setTheme(theme: ThemeChoice): void {
    memoryTheme = theme;
    write(THEME_KEY, theme === 'light' ? null : theme);
    changed();
}

export function setA11y(patch: Partial<A11yPrefs>): void {
    memoryA11y = { ...getA11y(), ...patch };
    const isDefault = (Object.keys(DEFAULT_A11Y) as (keyof A11yPrefs)[]).every((k) => memoryA11y![k] === DEFAULT_A11Y[k]);
    write(A11Y_KEY, isDefault ? null : JSON.stringify(memoryA11y));
    changed();
}

export function resetA11y(): void {
    setA11y({ ...DEFAULT_A11Y });
}

function subscribe(onChange: () => void): () => void {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onSystem = () => {
        if (getTheme() === 'system') changed();
    };
    const onStorage = (e: StorageEvent) => {
        if (e.key === THEME_KEY) memoryTheme = null;
        if (e.key === A11Y_KEY) memoryA11y = null;
        if (e.key === THEME_KEY || e.key === A11Y_KEY) changed();
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    media?.addEventListener('change', onSystem);
    return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener('storage', onStorage);
        media?.removeEventListener('change', onSystem);
    };
}

// Snapshot harus stabil antar-render: string ringkas, diurai di hook.
const snapshot = () => `${getTheme()}|${isDark() ? 1 : 0}|${JSON.stringify(getA11y())}`;
const serverSnapshot = () => `light|0|${JSON.stringify(DEFAULT_A11Y)}`;

export function usePreferences(): { theme: ThemeChoice; dark: boolean; a11y: A11yPrefs } {
    const snap = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    const [theme, dark, a11y] = snap.split('|');
    return { theme: theme as ThemeChoice, dark: dark === '1', a11y: JSON.parse(a11y) as A11yPrefs };
}
