export const APP_NAME = 'Contact Center';

/**
 * Callback `title` createInertiaApp (sigap/resources/js/app.tsx): judul kosong → nama aplikasi; judul yang sudah
 * memuat nama aplikasi ("Peta — Contact Center") tidak diberi akhiran " - Contact Center" lagi.
 */
export const judulApp = (title: string) => (!title ? APP_NAME : title.includes(APP_NAME) ? title : `${title} - ${APP_NAME}`);
