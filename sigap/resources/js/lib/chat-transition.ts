import { router } from '@inertiajs/react';

/**
 * Perpindahan landing ↔ halaman Chat TRANSI.
 *
 * - Desktop: elemen sumber (kotak tanya / kartu chat hero) "membesar" menjadi
 *   panel percakapan lewat View Transitions (nama bersama `transi-chat`).
 * - HP: halaman chat naik dari bawah seperti lembar; kembali = turun.
 * - Browser tanpa View Transitions atau pengguna "kurangi gerakan": pindah
 *   biasa tanpa animasi.
 *
 * Pertanyaan yang diketik di landing disimpan di sessionStorage agar tidak
 * hilang bila halaman chat di-refresh sebelum tamu mengisi nama.
 */

export const PENDING_KEY = 'sigap-chat-pending';
export const CHAT_URL = '/chat';
export const LANDING_URL = '/beranda-baru';

export function setPendingQuestion(question: string): void {
    try {
        sessionStorage.setItem(PENDING_KEY, question.slice(0, 2000));
    } catch {
        /* penyimpanan diblokir: pertanyaan tetap dikirim lewat alur biasa */
    }
}

export function peekPendingQuestion(): string | null {
    try {
        return sessionStorage.getItem(PENDING_KEY);
    } catch {
        return null;
    }
}

export function clearPendingQuestion(): void {
    try {
        sessionStorage.removeItem(PENDING_KEY);
    } catch {
        /* abaikan */
    }
}

type Direction = 'forward' | 'back';

function canAnimate(): boolean {
    return typeof document !== 'undefined' && 'startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function navigate(url: string, direction: Direction, source?: HTMLElement | null): void {
    if (!canAnimate()) {
        router.visit(url);
        return;
    }

    const root = document.documentElement;
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    root.dataset.vt = desktop ? direction : `${direction}-sheet`;

    // Hanya satu elemen boleh memakai nama bersama: pindahkan ke sumber klik.
    const statics = Array.from(document.querySelectorAll<HTMLElement>('.vt-chat-target'));
    if (desktop && source) {
        statics.forEach((el) => {
            if (el !== source) el.style.viewTransitionName = 'none';
        });
        source.style.viewTransitionName = 'transi-chat';
    }

    const transition = (document as Document & { startViewTransition: (cb: () => Promise<void>) => { finished: Promise<void> } }).startViewTransition(
        () =>
            new Promise<void>((resolve) => {
                // Browser menahan frame selama transisi, jadi jangan menunggu
                // requestAnimationFrame. Batas 2,5 dtk agar tidak pernah macet.
                const done = () => window.setTimeout(resolve, 20);
                const guard = window.setTimeout(resolve, 2500);
                router.visit(url, {
                    onSuccess: done,
                    onError: done,
                    onCancel: done,
                    onFinish: () => window.clearTimeout(guard),
                });
            }),
    );

    transition.finished.finally(() => {
        delete root.dataset.vt;
        if (source) source.style.viewTransitionName = '';
    });
}

/** Dari landing ke halaman chat; `question` dikirim sebagai pesan pertama. */
export function goToChat(options: { question?: string; source?: HTMLElement | null } = {}): void {
    const question = options.question?.trim();
    if (question) setPendingQuestion(question);
    navigate(CHAT_URL, 'forward', options.source ?? null);
}

/** Dari halaman chat kembali ke landing (animasi dibalik). */
export function leaveChat(url: string = LANDING_URL): void {
    navigate(url, 'back');
}
