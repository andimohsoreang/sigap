import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    app?: {
        brand: string;
        tagline: string;
        ministry: string;
    };
    /** reCAPTCHA v3 — site_key null = nonaktif (lokal). */
    recaptcha?: {
        site_key: string | null;
    };
    /** Percakapan yang menunggu petugas (sidebar admin; null untuk non-admin). */
    chat_waiting?: { id: number; nama: string; cuplikan: string | null; sejak: string | null }[] | null;
    /** Asisten AI contact center (kotak tanya beranda & widget chat). */
    assistant?: {
        enabled: boolean;
        service_hours: string;
    };
    /** Total pesan chat belum dibaca petugas (hanya admin; null untuk lainnya). */
    chat_unread?: number | null;
    flash?: {
        status?: string | null;
        success?: string | null;
        error?: string | null;
    };
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    username?: string | null;
    role?: string | null;
    is_admin?: boolean;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
