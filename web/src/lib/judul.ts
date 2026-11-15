import type { Metadata } from 'next';

export const APP_NAME = 'Contact Center';

// Padanan callback `title` di sigap/resources/js/app.tsx: judul yang sudah memuat nama aplikasi
// ("Peta — Contact Center") tidak diberi akhiran " - Contact Center" lagi oleh template root layout.
export function judul(title: string): Metadata['title'] {
    return title.includes(APP_NAME) ? { absolute: title } : title;
}
