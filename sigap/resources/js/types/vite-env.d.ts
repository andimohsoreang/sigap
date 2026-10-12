/// <reference types="vite/client" />

/** Variabel VITE_* yang ditanam saat build (lihat .env.example). */
interface ImportMetaEnv {
    readonly VITE_APP_NAME?: string;
    readonly VITE_REVERB_APP_KEY?: string;
    readonly VITE_REVERB_HOST?: string;
    readonly VITE_REVERB_PORT?: string;
    readonly VITE_REVERB_SCHEME?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
